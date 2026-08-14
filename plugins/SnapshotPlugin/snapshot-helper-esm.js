/* eslint-disable */
/*
 *  snapshot-helper-esm.js
 *
 *  Facade react-dom/client is redirected to (via esbuild-snapshot.js's
 *  esbuildSnapshotResolvePlugin) during a --snapshot build, for both the
 *  esbuild and Vite paths. Ported from snapshot-helper.js — kept in plain
 *  CJS (require()/module.exports) rather than rewritten with import/export,
 *  since the activate-mock-window / require(real react-dom/client) /
 *  deactivate-mock-window sequence needs to run in that exact synchronous
 *  order, and static ESM imports are hoisted (always evaluated before any
 *  of this module's own code, regardless of where they're written) — a
 *  dynamic import() would sidestep that, but needs top-level await, which a
 *  bare V8 snapshot execution context (no Promise microtask pump guaranteed
 *  to survive the snapshot boundary) isn't a safe place to rely on. esbuild
 *  bundles CJS require() calls inside an otherwise-ESM-imported file just
 *  fine, so this is resolvable through the normal bundling pipeline like
 *  any other import despite not using import/export syntax itself.
 *
 *  mock-window.js is reused unchanged (require()'d directly, same file the
 *  webpack path uses) — its mock is bundler-agnostic already.
 */
var mockWindow = require('./mock-window');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

function handleException (e) {
	// 'Cannot find module' is allowed — @enact/i18n, @enact/moonstone,
	// @enact/sandstone, and @enact/limestone are optional dependencies (the
	// app may not use all/any theme). esbuild's onResolve hook
	// (esbuildSnapshotResolvePlugin) already substitutes a no-op module for
	// any of these that don't resolve at bundle time, so this is a second,
	// belt-and-suspenders layer against anything that slips through that.
	if (!e.code || e.code !== 'MODULE_NOT_FOUND') {
		throw e;
	}
}

global.updateEnvironment = function () {
	// Called by the app's own on-device startup logic once the snapshot
	// blob has been restored into a REAL window/document, to re-sync
	// everything that was initialized against the mock window at
	// snapshot-build time.
	var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
	ExecutionEnvironment.canUseDOM = canUseDOM;
	ExecutionEnvironment.canUseWorkers = typeof Worker !== 'undefined';
	ExecutionEnvironment.canUseEventListeners = canUseDOM && !!(window.addEventListener || window.attachEvent);
	ExecutionEnvironment.canUseViewport = canUseDOM && !!window.screen;
	ExecutionEnvironment.isInWorker = !canUseDOM;
	mockWindow.attachListeners(ExecutionEnvironment.canUseEventListeners && window);

	try {
		// Mark the iLib localestorage cache as needing re-validation.
		var ilib = require('ilib/lib/ilib');
		if (ilib && ilib._load) {
			ilib._load._cacheValidated = false;
			if (ilib.clearCache) {
				ilib.clearCache();
			}
		}

		// Clear the active resBundle/string cache, cached during
		// snapshot-time initialization against no real locale.
		var resBundle = require('@enact/i18n/src/resBundle');
		resBundle.clearResBundle();
		try {
			var moonstoneBundle = require('@enact/moonstone/internal/$L');
			moonstoneBundle.clearResBundle();
		} catch (moonEx) {
			handleException(moonEx);
		}
		try {
			var sandstoneBundle = require('@enact/sandstone/internal/$L');
			sandstoneBundle.clearResBundle();
		} catch (sandEx) {
			handleException(sandEx);
		}
		try {
			var limestoneBundle = require('@enact/limestone/internal/$L');
			limestoneBundle.clearResBundle();
		} catch (limeEx) {
			handleException(limeEx);
		}

		// Update the iLib/Enact locale to the real device's active locale.
		var locale = require('@enact/i18n/locale');
		locale.updateLocale();
	} catch (enactEx) {
		handleException(enactEx);
	}

	try {
		var windowReady = require('@enact/core/snapshot').windowReady;
		windowReady();
	} catch (winEx) {
		handleException(winEx);
	}
};

if (typeof window == 'undefined' && (!global.process || !global.process.versions || !global.process.versions.node)) {
	// No real window (bare V8 snapshot execution) and no Node either
	// (rules out accidentally triggering this path during a normal Node
	// require, e.g. if something outside the snapshot build ever resolves
	// this file directly): activate the mock window just long enough for
	// react-dom/client's own module-scope feature detection to succeed
	// against it, then deactivate immediately so it doesn't leak into
	// whatever runs next.
	mockWindow.activate();
	ExecutionEnvironment.canUseDOM = true;
	ExecutionEnvironment.canUseWorkers = false;
	ExecutionEnvironment.canUseEventListeners = true;
	ExecutionEnvironment.canUseViewport = true;
	ExecutionEnvironment.isInWorker = false;
	module.exports = global.ReactDOMClient = require('react-dom/client');
	mockWindow.deactivate();
} else {
	module.exports = global.ReactDOMClient = require('react-dom/client');
}