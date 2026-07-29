/* eslint-disable */
/*
 *  snapshot-helper-esm.js
 *
 *  Vite/Rollup ESM port of the CommonJS `snapshot-helper.js`. Import order is
 *  significant and mirrors the CJS helper's require order:
 *    1. `./snapshot-mock.js`  — installs the mock window (before react-dom loads)
 *    2. `react-dom/client`    — initializes against the mock window
 *  The module body then exposes the initialized client on `global.ReactDOMClient`,
 *  restores the real globals, and defines `global.updateEnvironment` (called
 *  on-device to rebind to the real window and flush the `@enact/core/snapshot`
 *  window-ready queue). The `react-dom/client` named exports (createRoot/hydrateRoot)
 *  are re-exported so an app importing them resolves through this facade.
 *
 *  The `@enact/*`/`ilib` deps used by `updateEnvironment` are imported statically:
 *  they're bundled and evaluated at snapshot time (Enact is snapshot-safe by
 *  design), while their *methods* are only called on-device inside
 *  `updateEnvironment`. Packages not installed in the app resolve to a no-op (via
 *  the snapshot resolver), so their calls are harmless.
 */
import {ExecutionEnvironment, mockWindow, inSnapshot} from './snapshot-mock.js';
import * as ReactDOMClientNS from 'react-dom/client';

import * as coreSnapshotNS from '@enact/core/snapshot';
import * as ilibNS from 'ilib/lib/ilib';
import * as resBundleNS from '@enact/i18n/src/resBundle';
import * as moonstoneLNS from '@enact/moonstone/internal/$L';
import * as sandstoneLNS from '@enact/sandstone/internal/$L';
import * as limestoneLNS from '@enact/limestone/internal/$L';
import * as localeNS from '@enact/i18n/locale';

var GLOBAL = typeof globalThis !== 'undefined' ? globalThis : global;
var ReactDOMClient = ReactDOMClientNS.default || ReactDOMClientNS;
GLOBAL.ReactDOMClient = ReactDOMClient;

// react-dom has initialized against the mock; restore the real (absent) globals.
if (inSnapshot) mockWindow.deactivate();

function mod(ns) {
	return (ns && ns.default) || ns || {};
}

GLOBAL.updateEnvironment = function () {
	var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
	ExecutionEnvironment.canUseDOM = canUseDOM;
	ExecutionEnvironment.canUseWorkers = typeof Worker !== 'undefined';
	ExecutionEnvironment.canUseEventListeners = canUseDOM && !!(window.addEventListener || window.attachEvent);
	ExecutionEnvironment.canUseViewport = canUseDOM && !!window.screen;
	ExecutionEnvironment.isInWorker = !canUseDOM;
	mockWindow.attachListeners(ExecutionEnvironment.canUseEventListeners && window);

	try {
		var ilib = mod(ilibNS);
		if (ilib && ilib._load) {
			ilib._load._cacheValidated = false;
			if (ilib.clearCache) ilib.clearCache();
		}
		var resBundle = mod(resBundleNS);
		if (resBundle.clearResBundle) resBundle.clearResBundle();
		[moonstoneLNS, sandstoneLNS, limestoneLNS].forEach(function (ns) {
			var b = mod(ns);
			if (b.clearResBundle) b.clearResBundle();
		});
		var locale = mod(localeNS);
		if (locale.updateLocale) locale.updateLocale();
	} catch (e) {}

	try {
		var core = mod(coreSnapshotNS);
		var windowReady = core.windowReady || coreSnapshotNS.windowReady;
		if (windowReady) windowReady();
	} catch (e) {}
};

export function createRoot () {
	return ReactDOMClient.createRoot.apply(null, arguments);
}

export function hydrateRoot () {
	return ReactDOMClient.hydrateRoot.apply(null, arguments);
}

export default ReactDOMClient;
