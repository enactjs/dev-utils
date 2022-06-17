/* eslint-disable */
/*
 *  snapshot-redux-helper.js
 *
 *  An exposed utility function to update the javascript environment to the active window to account for any
 *  launch-time issues when using code created in a snapshot blob.
 */

var mockWindow = require('./mock-window');
var ExecutionEnvironment = require('fbjs/lib/ExecutionEnvironment');

if (typeof window == 'undefined'
		&& (!global.process || !global.process.versions || !global.process.versions.node)) {
	mockWindow.activate();
	ExecutionEnvironment.canUseDOM = true;
	ExecutionEnvironment.canUseWorkers = false;
	ExecutionEnvironment.canUseEventListeners = true;
	ExecutionEnvironment.canUseViewport = true;
	ExecutionEnvironment.isInWorker = false;
	try {
		module.exports = global.ReactRedux = require('react-redux');
	} catch (ex) {
		// We allow 'Module not found' errors, which throw when the module is not used in the app.
	}
	mockWindow.deactivate();
} else {
	try {
		module.exports = global.ReactRedux = require('react-redux');
	} catch (ex) {
		// We allow 'Module not found' errors, which throw when the module is not used in the app.
	}
}
