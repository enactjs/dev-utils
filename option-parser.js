const fs = require('fs');
const path = require('path');
const pkgRoot = require('./package-root');

const pkg = pkgRoot();
const enact = pkg.meta.enact || {};
const defaultEnv = 'web';
const defaultBrowsers = ['>1%', 'last 2 versions', 'Firefox ESR', 'not ie < 12', 'not ie_mob < 12'];

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
	// Optional webpack node configuration value (see https://webpack.js.org/configuration/node/).
	nodeBuiltins: enact.nodeBuiltins,
	// Optional property to specify a version of NodeJS to target required polyfills.
	// True or 'current' will use active version of Node, otherwise will use a specified version number.
	node: typeof enact.node !== 'object' && enact.node,
	// Optional window condition(s) that indicate deeplinking and invalidate HTML prerender.
	deep: enact.deep,
	// Proxy target to use within the http-proxy-middleware during serving.
	proxy: enact.proxy || pkg.meta.proxy,
	// Optional theme preset for theme-specific settings (see below).
	theme: enact.theme
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

// Handle dynamic resolving of targets for both browserlist format and webpack target string format.
// Temporary support for parsing BROWSERSLIST env var. Will be supported out-of-the-box in Babel 7 in all forms.
const browserslist =
	(process.env['BROWSERSLIST'] && process.env['BROWSERSLIST'].split(/\s*,\s*/)) ||
	pkg.meta.browserlist ||
	parseBL(path.join(pkg.path, '.browserslistrc')) ||
	parseBL(path.join(pkg.path, 'browserslist')) ||
	(Array.isArray(enact.target) && enact.target);
if (browserslist) {
	// Standard browserslist format (https://github.com/ai/browserslist)
	if (browserslist.find(b => !b.startsWith('not') && b.indexOf('Electron') > -1)) {
		module.exports.environment = enact.environment || 'electron-main';
	} else {
		module.exports.environment = enact.environment || defaultEnv;
	}
	module.exports.browsers = browserslist;
} else if (typeof enact.target === 'string' || enact.environment) {
	// Optional webpack target value (see https://webpack.js.org/configuration/target/).
	module.exports.environment = enact.environment || enact.target || defaultEnv;
	switch (module.exports.environment) {
		case 'atom':
		case 'electron':
		case 'electron-main':
		case 'electron-renderer': {
			const versionMap = require('electron-to-chromium/versions');
			const lastFour = Object.keys(versionMap)
				.sort((a, b) => parseInt(versionMap[a]) - parseInt(versionMap[b]))
				.slice(-4)
				.map(v => 'Electron ' + v);
			try {
				// Attempt to detect current-used Electron version
				const electron = JSON.parse(
					fs.readFileSync(path.join(pkg.path, 'node_modules', 'electron', 'package.json'), {encoding: 'utf8'})
				);
				const label = (electron.version + '').replace(/^(\d+\.\d+).*$/, '$1');
				module.exports.browsers = versionMap[label] ? ['Electron ' + label] : lastFour;
			} catch (e) {
				// Fallback to last 4 releases of Electron.
				module.exports.browsers = lastFour;
			}
			break;
		}
		case 'node':
			module.exports.node = module.exports.node || true;
			delete module.exports.browsers;
			delete module.exports.nodeBuiltins;
			break;
		default:
			module.exports.browsers = defaultBrowsers;
	}
} else {
	module.exports.environment = defaultEnv;
	module.exports.browsers = defaultBrowsers;
}
