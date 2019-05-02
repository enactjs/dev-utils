/*
 *  vdom-server-render.js
 *
 *  Uses a domserver component like react-dom/server to render the HTML string
 *  for a given javascript virtualdom Enact codebase.
 */

const fs = require('fs');
const path = require('path');
const findCacheDir = require('find-cache-dir');
const requireUncached = require('import-fresh');
const reroute = require('mock-require');
const FileXHR = require('./FileXHR');

require('console.mute');

const prerenderCache = path.join(
	findCacheDir({
		name: 'enact-dev',
		create: true
	}),
	'prerender'
);
let chunkTarget;

if (!fs.existsSync(prerenderCache)) fs.mkdirSync(prerenderCache);

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
	stage: function(code, opts) {
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
		chunkTarget = path.join(prerenderCache, opts.chunk);
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
	render: function(opts) {
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
				global.enactHooks.prerender = function(hook) {
					if (hook.appendToHead) {
						style = hook.appendToHead;
					}
				};
			}

			if (opts.externals) {
				// Ensure locale switching  support is loaded globally with external framework usage.
				const framework = require(path.resolve(path.join(opts.externals, 'enact.js')));
				global.iLibLocale = framework('@enact/i18n/locale');
				global.React = framework('react');
			} else {
				delete global.React;
				delete global.iLibLocale;
			}

			const chunk = requireUncached(path.resolve(chunkTarget));

			// Update locale if needed.
			if (opts.locale && global.iLibLocale && global.iLibLocale.updateLocale) {
				console.resume();
				global.iLibLocale.updateLocale(opts.locale);
				console.mute();
			}

			// Clear any server-related children modules from cache
			Object.keys(require.cache)
				.filter(c => c.startsWith(path.dirname(opts.server)))
				.forEach(c => delete require.cache[c]);

			// Use the specified server, optionally with exposed React, and generate HTML string
			if (global.React) reroute('react', global.React);
			const server = requireUncached(opts.server);
			rendered = server.renderToString(chunk['default'] || chunk);
			if (global.React) reroute.stop('react');

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
	unstage: function() {
		if (chunkTarget && fs.existsSync(chunkTarget)) fs.unlinkSync(chunkTarget);
	}
};
