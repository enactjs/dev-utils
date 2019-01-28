const fs = require('fs');
const path = require('path');
const browserslist = require('browserslist');
const pkgRoot = require('./package-root');

const defaultTargets = ['>1%', 'last 2 versions', 'Firefox ESR', 'not ie < 12', 'not ie_mob < 12', 'not dead'];
const pkg = pkgRoot();
let enact = pkg.meta.enact || {};

function gentlyParse(file) {
	try {
		return JSON.parse(fs.readFileSync(file, {encoding: 'utf8'}));
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
	// Project base directory.
	context: pkg.path,
	// Project name.
	name: pkg.meta.name,
	// Parse Enact metadata and apply options onto the config.
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
		// Optionally force all LESS/CSS to be handled modularly, instead of solely having
		// the *.module.css and *.module.less files be processed in a modular context.
		config.forceCSSModules = enact.forceCSSModules;
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
	},
	// Sets the browserslist default fallback set of browsers to the Enact default browser support list.
	setEnactTargetsAsDefault: function() {
		if (!browserslist.loadConfig({path: pkg.path})) process.env.BROWSERSLIST = defaultTargets.join(',');
	}
};

Object.defineProperty(config, 'environment', {
	configurable: false,
	enumerable: true,
	get: function() {
		if (enact.environment) return enact.environment;

		let targets = browserslist.loadConfig({path: pkg.path});
		if (targets) {
			if (typeof targets === 'string') targets = targets.split(/,\s*/);
			targets = targets.map(b => b.toLowerCase());
			if (targets.some(b => !b.startsWith('not') && b.includes('electron'))) {
				return 'electron-renderer';
			} else if (targets.every(b => !b.startsWith('not') && b.includes('node'))) {
				return 'node';
			} else {
				return 'web';
			}
		} else {
			return 'web';
		}
	}
});

config.applyEnactMeta();

module.exports = config;
