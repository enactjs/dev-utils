const fs = require('fs');
const path = require('path');
const pkgRoot = require('./package-root');

const defaultEnv = 'web';
const defaultBrowsers = ['>1%', 'last 2 versions', 'Firefox ESR', 'not ie < 12', 'not ie_mob < 12'];
const pkg = pkgRoot();
let enact = pkg.meta.enact || {};

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

const config = {
	// Project base directory
	context: pkg.path,
	// Project name
	name: pkg.meta.name,
	applyEnactMeta: function(meta) {
		enact = Object.assign(enact, meta);

		// Optional alternate entrypoint for isomorphic builds.
		config.isomorphic = enact.isomorphic;
		// Optional filepath to an alternate HTML template for html-webpack-plugin.
		config.template = enact.template;
		// Optional <title></title> value for HTML
		config.title = enact.title;
		// Optional flag whether to externalize the prerender startup js
		config.externalStartup = enact.externalStartup;
		// Optional webpack node configuration value (see https://webpack.js.org/configuration/node/).
		config.nodeBuiltins = enact.nodeBuiltins;
		// Optional property to specify a version of NodeJS to target required polyfills.
		// True or 'current' will use active version of Node, otherwise will use a specified version number.
		config.node = typeof enact.node !== 'object' && enact.node;
		// Optional window condition(s) that indicate deeplinking and invalidate HTML prerender.
		config.deep = enact.deep;
		// Proxy target to use within the http-proxy-middleware during serving.
		config.proxy = enact.proxy || pkg.meta.proxy;
		// Optional theme preset for theme-specific settings (see below).
		config.theme = enact.theme;

		// Resolve array of screenType configurations. When not found, falls back to any theme preset or moonstone.
		config.screenTypes =
			(Array.isArray(enact.screenTypes) && enact.screenTypes) ||
			(typeof enact.screenTypes === 'string' &&
				(gentlyParse(path.join(pkg.path, enact.screenTypes)) ||
					gentlyParse(path.join(pkg.path, 'node_modules', enact.screenTypes)))) ||
			gentlyParse(screenTypes(enact.theme || 'moonstone')) ||
			[];

		// Resolve the resolution independence settings from explicit settings or the resolved screenTypes definitions.
		config.ri = enact.ri || {
			baseSize: config.screenTypes.reduce((r, s) => (s.base && s.pxPerRem) || r, null)
		};

		// Resolved filepath to fontGenerator. When not found, falls back to any theme preset or moonstone.
		config.fontGenerator =
			(typeof enact.screenTypes === 'string' &&
				[
					path.join(pkg.path, enact.fontGenerator),
					path.join(pkg.path, 'node_modules', enact.fontGenerator)
				].find(fs.existsSync)) ||
			fontGenerator(enact.theme || 'moonstone');

		// Override theme's accent LESS variable value if desired. Private option; may be removed in future.
		// When used, creates a LESS variable override map, overriding '@moon-accent' and/or '@<theme>-accent'
		// values with the specified override. This allows a simple way to alter Enact spotlight color.
		config.accent =
			enact.accent &&
			Object.assign(
				{'moon-accent': enact.accent},
				enact.theme && enact.theme !== 'moonstone' && {[enact.theme + '-accent']: enact.accent}
			);

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
				config.environment = enact.environment || 'electron-main';
			} else {
				config.environment = enact.environment || defaultEnv;
			}
			config.browsers = browserslist;
		} else if (typeof enact.target === 'string' || enact.environment) {
			// Optional webpack target value (see https://webpack.js.org/configuration/target/).
			config.environment = enact.environment || enact.target || defaultEnv;
			switch (config.environment) {
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
							fs.readFileSync(path.join(pkg.path, 'node_modules', 'electron', 'package.json'), {
								encoding: 'utf8'
							})
						);
						const label = (electron.version + '').replace(/^(\d+\.\d+).*$/, '$1');
						config.browsers = versionMap[label] ? ['Electron ' + label] : lastFour;
					} catch (e) {
						// Fallback to last 4 releases of Electron.
						config.browsers = lastFour;
					}
					break;
				}
				case 'node':
					config.node = config.node || true;
					delete config.browsers;
					delete config.nodeBuiltins;
					break;
				default:
					config.browsers = defaultBrowsers;
			}
		} else {
			config.environment = defaultEnv;
			config.browsers = defaultBrowsers;
		}
	}
};

config.applyEnactMeta();

module.exports = config;
