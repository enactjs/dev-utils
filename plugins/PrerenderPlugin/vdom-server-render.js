/*
 *  vdom-server-render.js
 *
 *  Uses a domserver component like react-dom/server to render the HTML string
 *  for a given javascript virtualdom Enact codebase.
 */

const fs = require('fs');
const path = require('path');
const requireUncached = require('import-fresh');
const reroute = require('mock-require');
const FileXHR = require('./FileXHR');

require('console.mute');

let chunkTarget;
let prerenderCache;

function clearReactModules () {
	Object.keys(require.cache)
		.filter(c => /[\\/]node_modules[\\/]react(-dom)?[\\/]/.test(c))
		.forEach(c => delete require.cache[c]);
}

function getPrerenderCache () {
	if (prerenderCache) return prerenderCache;

	try {
		const findCacheDirectory = require('find-cache-directory');
		prerenderCache = path.join(
			findCacheDirectory({
				name: 'enact-dev',
				create: true
			}),
			'prerender'
		);
	} catch (e) {
		prerenderCache = path.join(process.cwd(), 'node_modules', '.cache', 'enact-dev', 'prerender');
	}

	fs.mkdirSync(prerenderCache, {recursive: true});
	return prerenderCache;
}

// Skip using the polyfills embedded within the bundle and instead use a local core-js,
// since the bundle's target may differ in compatibility from the active Node process
// (and repeated renders cause memory leaks when embedded polyfills are used).
global.skipPolyfills = true;
require('core-js');

module.exports = {
	/*
		Stages a target chunk of sourcecode to a temporary directory to be prerendered.
		Parameters:
			code 				Target chunk's sourcecode string
			opts:
				chunk 			Chunk filename; used to visually note within thrown errors
				externals		Filepath to external Enact framework to use with rendering
	*/
	stage: function (code, opts) {
		code = code.replace('__webpack_require__.e =', '__webpack_require__.e = function() {}; var origE =');
		code = code.replace(
			'function webpackAsyncContext(req) {',
			'function webpackAsyncContext(req) {\n\treturn new Promise(function() {});'
		);

		if (opts.externals) {
			// Add external Enact framework filepath if it's used.
			code = code.replace(
				/require\(["']enact_framework["']\)/g,
				'require("' + path.resolve(path.join(opts.externals, 'enact.js')) + '")'
			);
		}
		chunkTarget = path.join(getPrerenderCache(), opts.chunk);
		fs.writeFileSync(chunkTarget, code, {encoding: 'utf8'});
	},

	/*
		Renders the staged chunk with desired options used.
		Parameters:
			opts:
				server			ReactDomServer or server with compatible APIs
				locale 			Specific locale to use in rendering
				externals		Filepath to external Enact framework to use with rendering
				fontGenerator	Optional font-generator which can be used to dynamically generate locale-specific font settings
		Returns:
			HTML static rendered string of the app's initial state.
	*/
	render: function (opts) {
		if (!chunkTarget) throw new Error('Source code not staged, unable render vdom into HTML string.');
		let style, rendered;

		if (opts.locale) {
			global.XMLHttpRequest = FileXHR;
		} else {
			delete global.XMLHttpRequest;
		}

		try {
			console.mute();

			try {
				const generator = require(path.resolve(opts.fontGenerator));
				const locale = opts.locale || 'en-US';
				style = generator(locale);
				if (generator.fontOverrideGenerator) style += generator.fontOverrideGenerator(locale);
			} catch (e) {
				// Temporary fallback to use deprecated global hook.
				global.enactHooks = global.enactHooks || {};
				global.enactHooks.prerender = function (hook) {
					if (hook.appendToHead) {
						style = hook.appendToHead;
					}
				};
			}

			global.process.env.LANG = opts.locale;

			clearReactModules();

			if (opts.externals) {
				const frameworkPath = path.resolve(path.join(opts.externals, 'enact.js'));
				let framework = requireUncached(frameworkPath);
				if (framework && typeof framework.default === 'function') {
					framework = framework.default;
				}
				if (typeof framework !== 'function') {
					const previousFramework = global.enact_framework;
					delete global.enact_framework;
					requireUncached(frameworkPath);
					framework = global.enact_framework;
					if (previousFramework !== undefined) {
						global.enact_framework = previousFramework;
					} else {
						delete global.enact_framework;
					}
				}
				if (typeof framework !== 'function') {
					throw new Error('External Enact framework must export enact_framework(id).');
				}
				global.enact_framework = framework;
				global.React = framework('react');
			} else if (!global.React) {
				global.React = require('react');
			}

			reroute('react', global.React);

			const chunk = requireUncached(path.resolve(chunkTarget));
			let server;
			if (opts.externals && global.enact_framework) {
				const domServer = global.enact_framework('react-dom/server');
				server = domServer.default || domServer;
			} else {
				server = requireUncached(opts.server);
			}
			rendered = server.renderToString(chunk['default'] || chunk);
			reroute.stop('react');

			if (style) {
				rendered = '<!-- head append start -->\n' + style + '\n<!-- head append end -->' + rendered;
			}

			// If --expose-gc is used in NodeJS, force garbage collect after prerender for minimal memory usage.
			if (global.gc) global.gc();

			console.resume();
		} catch (e) {
			console.resume();
			throw e;
		}
		return rendered;
	},

	/*
		Deletes any staged sourcecode cunks
	*/
	unstage: function () {
		if (chunkTarget && fs.existsSync(chunkTarget)) fs.unlinkSync(chunkTarget);
	}
};
