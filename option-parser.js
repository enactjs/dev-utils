const fs = require('fs');
const path = require('path');
const browserslist = require('browserslist');
const pkgRoot = require('./package-root');

const pkg = pkgRoot();
const enact = pkg.meta.enact || {};
const defaultTargets = ['>1%', 'last 2 versions', 'Firefox ESR', 'not ie < 12', 'not ie_mob < 12', 'not dead'];

function gentlyParse(file) {
	try {
		return JSON.parse(fs.readFileSync(file, {encoding: 'utf8'}));
	} catch (e) {
		return undefined;
	}
}

function parseBL(file) {
	try {
		return fs
			.readFileSync(file, {encoding: 'utf8'})
			.split(/[\r\n]+/)
			.filter(t => t.trim() && t.charAt(0) !== '#');
	} catch (e) {
		return undefined;
	}
}

function screenTypes(theme) {
	const decorator = theme.charAt(0).toUpperCase() + theme.slice(1) + 'Decorator';
	const scoped = path.join('node_modules', '@enact', theme, decorator, 'screenTypes.json');
	const basic = path.join('node_modules', theme, decorator, 'screenTypes.json');
	return fs.existsSync(scoped) ? scoped : fs.existsSync(basic) ? basic : null;
}

function fontGenerator(theme) {
	const decorator = theme.charAt(0).toUpperCase() + theme.slice(1) + 'Decorator';
	const scoped = path.join('node_modules', '@enact', theme, decorator, 'fontGenerator.js');
	const basic = path.join('node_modules', theme, decorator, 'fontGenerator.js');
	return fs.existsSync(scoped) ? scoped : fs.existsSync(basic) ? basic : null;
}

module.exports = {
	// Project base directory
	context: pkg.path,
	// Project name
	name: pkg.meta.name,
	// Optional alternate entrypoint for isomorphic builds.
	isomorphic: enact.isomorphic,
	// Optional filepath to an alternate HTML template for html-webpack-plugin.
	template: enact.template,
	// Optional <title></title> value for HTML
	title: enact.title,
	// Optional flag whether to externalize the prerender startup js
	externalStartup: enact.externalStartup,
	// Optional webpack node configuration value (see https://webpack.js.org/configuration/node/).
	nodeBuiltins: enact.nodeBuiltins,
	// Optional window condition(s) that indicate deeplinking and invalidate HTML prerender.
	deep: enact.deep,
	// Proxy target to use within the http-proxy-middleware during serving.
	proxy: enact.proxy || pkg.meta.proxy,
	// Optional theme preset for theme-specific settings (see below).
	theme: enact.theme,
	// Sets the browserslist default fallback set of browsers to the Enact default browser support list
	setEnactTargetsAsDefault: function() {
		if (!browserslist.loadConfig({path: pkg.path})) process.env.BROWSERSLIST = defaultTargets.join(',');
	}
};

// Resolve array of screenType configurations. When not found, falls back to any theme preset or moonstone.
module.exports.screenTypes =
	(Array.isArray(enact.screenTypes) && enact.screenTypes) ||
	(typeof enact.screenTypes === 'string' &&
		(gentlyParse(path.join(pkg.path, enact.screenTypes)) ||
			gentlyParse(path.join(pkg.path, 'node_modules', enact.screenTypes)))) ||
	gentlyParse(screenTypes(enact.theme || 'moonstone')) ||
	[];

// Resolve the resolution independence settings from explicit settings or the resolved screenTypes definitions.
module.exports.ri = enact.ri || {
	baseSize: module.exports.screenTypes.reduce((r, s) => (s.base && s.pxPerRem) || r, null)
};

// Resolved filepath to fontGenerator. When not found, falls back to any theme preset or moonstone.
module.exports.fontGenerator =
	(typeof enact.screenTypes === 'string' &&
		[path.join(pkg.path, enact.fontGenerator), path.join(pkg.path, 'node_modules', enact.fontGenerator)].find(
			fs.existsSync
		)) ||
	fontGenerator(enact.theme || 'moonstone');

// Override theme's accent LESS variable value if desired. Private option; may be removed in future.
// When used, creates a LESS variable override map, overriding '@moon-accent' and/or '@<theme>-accent'
// values with the specified override. This allows a simple way to alter Enact spotlight color.
module.exports.accent =
	enact.accent &&
	Object.assign(
		{'moon-accent': enact.accent},
		enact.theme && enact.theme !== 'moonstone' && {[enact.theme + '-accent']: enact.accent}
	);

// Temporary backward support for declaring browserslist config from enact.target
let target;
if (enact.target) {
	if (typeof enact.target === 'string') {
		switch (enact.target) {
			case 'atom':
			case 'electron':
			case 'electron-main':
			case 'electron-renderer': {
				const versionMap = require('electron-to-chromium/versions');
				const lastFour = Object.keys(versionMap)
					.sort((a, b) => parseInt(versionMap[a]) - parseInt(versionMap[b]))
					.slice(-4)
					.map(v => 'electron ' + v);
				try {
					// Attempt to detect current-used Electron version
					const electron = JSON.parse(
						fs.readFileSync(path.join(pkg.path, 'node_modules', 'electron', 'package.json'), {
							encoding: 'utf8'
						})
					);
					const label = (electron.version + '').replace(/^(\d+\.\d+).*$/, '$1');
					target = versionMap[label] ? ['electron ' + label] : lastFour;
				} catch (e) {
					// Fallback to last 4 releases of Electron.
					target = lastFour;
				}
				break;
			}
			case 'node':
				target = [];
				break;
			default:
				target = defaultTargets;
		}
	} else {
		target = enact.target || defaultTargets;
	}
	if (typeof enact.node !== 'object' && enact.node && !target.some(b => !b.startsWith('not') && b.includes('node'))) {
		target.push(typeof enact.node === 'number' ? 'node ' + enact.node : 'current node');
	}
	process.env.BROWSERSLIST = target.join(',');
}

Object.defineProperty(module.exports, 'environment', {
	configurable: false,
	enumerable: true,
	get: function() {
		if (enact.environment) return enact.environment;

		let config = browserslist.loadConfig({path:pkg.path}) || target;
		if (config) {
			if (typeof config === 'string') config = config.split(/,\s*/);
			config = config.map(b => b.toLowerCase());
			if (config.some(b => !b.startsWith('not') && b.includes('electron'))) {
				return 'electron-renderer';
			} else if (config.every(b => !b.startsWith('not') && b.includes('node'))) {
				return 'node';
			} else {
				return 'web';
			}
		} else {
			return 'web';
		}
	}
});
