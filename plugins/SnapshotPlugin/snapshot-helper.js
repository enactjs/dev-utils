/* eslint-disable */
/*
 *  snapshot-helper.js
 *
 *  An exposed utility function to update the javascript environment to the active window to account for any
 *  launch-time issues when using code created in a snapshot blob.
 */

var mockWindow = require('./mock-window');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

function handleException(e) {
	// We allow 'Cannot find module' errors, which throw when the libraries are not used in the app.
	// @enact/i18n, @enact/moonstone, @enact/sandstone, and @enact/limestone are considered optional dependencies.
	if (!e.code || e.code !== 'MODULE_NOT_FOUND') {
		throw e;
	}
}

global.updateEnvironment = function() {
	// Update fbjs to have the correct execution environment for the active window.
	var canUseDOM = !!(typeof window !== 'undefined' && window.document && window.document.createElement);
	ExecutionEnvironment.canUseDOM = canUseDOM;
	ExecutionEnvironment.canUseWorkers = typeof Worker !== 'undefined';
	ExecutionEnvironment.canUseEventListeners = canUseDOM && !!(window.addEventListener || window.attachEvent);
	ExecutionEnvironment.canUseViewport = canUseDOM && !!window.screen;
	ExecutionEnvironment.isInWorker = !canUseDOM; // For now, this is true - might change in the future.
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

		// Clear the active resBundle and string cache.
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

		// Update the iLib/Enact locale to the active window's locale.
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

if (typeof window == 'undefined'
		&& (!global.process || !global.process.versions || !global.process.versions.node)) {
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
