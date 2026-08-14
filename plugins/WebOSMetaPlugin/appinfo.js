/*
 *  app info.js
 *
 *  appinfo.json reading/discovery helpers shared by WebOSMetaPlugin
 *  (webpack) and the esbuild-path plugins (EsbuildWebOSMetaPlugin).
 *  Extracted from WebOSMetaPlugin/index.js's private `props`/`readAppInfo`/
 *  `rootAppInfo` so both bundler paths can share one implementation instead
 *  of diverging copies.
 */
const fs = require('fs');
const path = require('path');

// List of asset-pointing appinfo properties.
const props = [
	'icon',
	'largeIcon',
	'extraLargeIcon',
	'miniicon',
	'smallicon',
	'splashicon',
	'splashBackground',
	'bgImage',
	'imageForRecents'
];

function readAppInfo (file) {
	// Read and parse appinfo.json file if it exists.
	if (fs.existsSync(file)) {
		try {
			const meta = JSON.parse(fs.readFileSync(file, {encoding: 'utf8'}));
			return meta;
		} catch (e) {
			console.log('ERROR: unable to read/parse appinfo.json at ' + file);
		}
	}
}

function rootAppInfo (context, specific) {
	// The accepted root locations to search for the appinfo.json and its relative
	// assets are project root or ./webos-meta.
	const rootDir = [context, path.join(context, './webos-meta')];
	// If a specific path is requested, prepend it to the search list
	if (specific) {
		if (path.isAbsolute(specific)) {
			rootDir.unshift(specific);
		} else {
			rootDir.unshift(path.join(context, specific));
		}
	}
	// Check each search location, and if found, return the data and path it was found at.
	let meta;
	for (let i = 0; i < rootDir.length; i++) {
		meta = readAppInfo(path.join(rootDir[i], 'appinfo.json'));
		if (meta) {
			return {path: rootDir[i], obj: meta};
		}
	}
}

module.exports = {props, readAppInfo, rootAppInfo};
