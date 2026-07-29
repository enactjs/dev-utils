/*
 *  vdom-server-render.js
 *
 *  Uses a domserver component like react-dom/server to render the HTML string
 *  for a given javascript virtualdom Enact codebase.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');
const requireUncached = require('import-fresh');
const reroute = require('mock-require');
const FileXHR = require('./FileXHR');

require('console.mute');

let chunkTarget;
let prerenderCache;

const ILIB_LOCALEMATCH_GLOBAL = '__ENACT_PRERENDER_LOCALEMATCH__';
const ILIB_DATA_INIT_PATTERN =
	/cache: \{\} \}, typeof module2 != "undefined" && \(module2\.exports = ilib, module2\.exports\.ilib = ilib\)/g;
const ILIB_DATA_INIT_SEED =
	'cache: {} }, global.' +
	ILIB_LOCALEMATCH_GLOBAL +
	'&&(ilib.data.localematch=global.' +
	ILIB_LOCALEMATCH_GLOBAL +
	'), typeof module2 != "undefined" && (module2.exports = ilib, module2.exports.ilib = ilib)';

/**
 * Load a staged chunk in a vm context that shares Node require / prerender
 * globals but intentionally omits window/document/self so browser-only paths
 * see typeof window === 'undefined' without regex-rewriting the bundle text.
 */
function loadStagedChunk(chunkPath) {
	const code = fs.readFileSync(chunkPath, {encoding: 'utf8'});
	const moduleObject = {exports: {}};
	const localRequire = Module.createRequire(chunkPath);
	const context = {
		module: moduleObject,
		exports: moduleObject.exports,
		require: localRequire,
		__filename: chunkPath,
		__dirname: path.dirname(chunkPath),
		console,
		process,
		Buffer,
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		setImmediate,
		clearImmediate,
		queueMicrotask,
		URL,
		URLSearchParams,
		Promise,
		Object,
		Array,
		String,
		Number,
		Boolean,
		Symbol,
		Math,
		Date,
		RegExp,
		Error,
		TypeError,
		RangeError,
		SyntaxError,
		JSON,
		Map,
		Set,
		WeakMap,
		WeakSet,
		Proxy,
		Reflect,
		parseInt,
		parseFloat,
		isNaN,
		isFinite,
		encodeURIComponent,
		decodeURIComponent,
		encodeURI,
		decodeURI,
		// Prerender-shared state (also mirrored onto context.global below)
		React: global.React,
		enact_framework: global.enact_framework,
		enactHooks: global.enactHooks,
		ilib: global.ilib,
		XMLHttpRequest: global.XMLHttpRequest,
		skipPolyfills: global.skipPolyfills
	};
	if (global[ILIB_LOCALEMATCH_GLOBAL] !== undefined) {
		context[ILIB_LOCALEMATCH_GLOBAL] = global[ILIB_LOCALEMATCH_GLOBAL];
	}
	// No window / document / self — keeps DOM startup paths inert.
	context.global = context;
	context.globalThis = context;

	vm.createContext(context);
	vm.runInContext(code, context, {
		filename: chunkPath,
		displayErrors: true
	});

	return moduleObject.exports && moduleObject.exports.default !== undefined
		? moduleObject.exports
		: context.module.exports;
}

function readLocaleMatchData() {
	const fsPath = process.env.ILIB_FS_PATH || process.env.ILIB_BASE_PATH;
	if (!fsPath) return null;

	const localeMatchPath = path.join(fsPath, 'locale', 'localematch.json');
	if (!fs.existsSync(localeMatchPath)) return null;

	try {
		const localematch = JSON.parse(fs.readFileSync(localeMatchPath, {encoding: 'utf8'}));
		return localematch && localematch.likelyLocales ? localematch : null;
	} catch (_e) {
		return null;
	}
}

function resetIlibGlobalState() {
	// ilib.js uses `var ilib = ilib || {}`, so repeated prerender passes share one global
	// singleton. After many locale renders, cached localematch data can become incomplete.
	if (global.ilib) {
		if (global.ilib.data && typeof global.ilib.clearCache === 'function') {
			global.ilib.clearCache();
		}
		delete global.ilib;
	}
}

function seedIlibLocaleMatch() {
	const localematch = readLocaleMatchData();
	if (!localematch) return;

	global.ilib = global.ilib || {};
	global.ilib.data = global.ilib.data || {};
	global.ilib.data.localematch = localematch;
	if (global.ilib._load) {
		global.ilib._load._cacheValidated = false;
	}
}

function injectBundledIlibLocaleMatchSeed(code) {
	return code.replace(ILIB_DATA_INIT_PATTERN, ILIB_DATA_INIT_SEED);
}

function resolveFromContext(moduleName, context) {
	if (!context) {
		return require.resolve(moduleName);
	}
	return require.resolve(moduleName, {paths: [path.join(context, 'node_modules')]});
}

function clearPrerenderModules(serverPath) {
	const chunkPath = chunkTarget ? path.resolve(chunkTarget) : null;
	const serverDir = serverPath ? path.dirname(path.resolve(serverPath)) : null;

	Object.keys(require.cache)
		.filter(c => {
			if (chunkPath && path.resolve(c) === chunkPath) return true;
			if (serverDir && c.startsWith(serverDir)) return true;
			return /[\\/]node_modules[\\/](react(-dom)?|ilib|@enact)([\\/]|$)/.test(c);
		})
		.forEach(c => delete require.cache[c]);

	try {
		reroute.stop('react');
	} catch (_e) {
		// ignore if react was not rerouted yet
	}

	delete global.React;
	delete global.enact_framework;
	delete global.enactHooks;
}

function getPrerenderCache() {
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
		code = injectBundledIlibLocaleMatchSeed(code);
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
				const generator = requireUncached(path.resolve(opts.fontGenerator));
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

			clearPrerenderModules(opts.server);

			if (opts.locale) {
				resetIlibGlobalState();
				seedIlibLocaleMatch();
			}

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
			} else {
				global.React = requireUncached(resolveFromContext('react', opts.context));
			}

			reroute('react', global.React);

			let localeMatchSeed;
			if (opts.locale) {
				localeMatchSeed = readLocaleMatchData();
				if (localeMatchSeed) {
					global[ILIB_LOCALEMATCH_GLOBAL] = localeMatchSeed;
				}
			}

			const chunk = loadStagedChunk(path.resolve(chunkTarget));

			if (localeMatchSeed) {
				delete global[ILIB_LOCALEMATCH_GLOBAL];
			}
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
