/* global ENZYME_MODULE_REQUEST, ENZYME_ADAPTER_REQUEST */
/* eslint no-var: off */
/*
 *  enzyme-proxy.js
 *
 *  A proxy module to automatically initialize the Enzyme Adapter whenever Enzyme is
 *  required/imported.
 */

var enzyme = require(ENZYME_MODULE_REQUEST);
var Adapter = require(ENZYME_ADAPTER_REQUEST);

enzyme.configure({adapter: new Adapter()});

module.exports = enzyme;
