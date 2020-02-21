const fs = require('fs');
const path = require('path');
const resolve = require('resolve');
const browserslist = require('browserslist');
const pkgRoot = require('./package-root');

const defaultTargets = [
	'>1%',
	'last 2 versions',
	'last 5 Chrome versions',
	'last 5 Firefox versions',
	'Firefox ESR',
	'not ie < 12',
	'not ie_mob < 12',
	'not dead'
];
const pkg = pkgRoot();
let enact = pkg.meta.enact || {};

const capitalize = name => name[0].toUpperCase() + name.slice(1);
const valid = v => v || v === false;

// Gently parse a file returning undefined on thrown errors
const gentlyParse = file => {
	try {
		return JSON.parse(fs.readFileSync(file, {encoding: 'utf8'}));
	} catch (e) {
		return undefined;
	}
};

// Resolve a filepath relative to a context and theme
const themeFile = (context, theme, file) => {
	const checks = [`@enact/${theme}/${file}`, `${theme}/${file}`];

	for (let i = 0; i < checks.length; i++) {
		try {
			return resolve.sync(checks[i], {basedir: context});
		} catch (e) {}
	}
};

// Resolve a valid theme decorator relative filepath (eg. screentypes.json)
const decoFile = (dir, file) => {
	return [
		// Possible theme decorator locations
		path.join('ThemeDecorator', file),
		path.join(capitalize(path.basename(dir)) + 'Decorator', file)
	].find(f => fs.existsSync(path.join(dir, f)));
};

// Recursively resolves theme configuration details
const themeConfig = (context, theme) => {
	const pkgFile = themeFile(context, theme, 'package.json');
	if (pkgFile) {
		const meta = require(pkgFile);
		const cfg = meta.enact || {};
		cfg.name = meta.name;
		cfg.path = path.dirname(pkgFile);
		if (!cfg.screenTypes) cfg.screenTypes = decoFile(cfg.path, 'screenTypes.json');
		if (!cfg.fontGenerator) cfg.fontGenerator = decoFile(cfg.path, 'fontGenerator.js');
		if (cfg.theme) cfg.theme = themeConfig(cfg.path, cfg.theme);
		return cfg;
	}
};

// Computes the value of a config prop in a hierarchy of:
//     1. Environment variable level (ENACT_<prop>)
//     2. Local source level (within a package.json or local ThemeDecorator)
//     3. Extended theme level (explicitly or implicitly within extended theme)
const computed = (prop, app, theme) => {
	// Environment variables take top priority
	const envProp = 'ENACT_' + prop.toUpperCase();
	if (valid(process.env[envProp])) {
		if (/^([{[].*[}\]]|true|false)$/.test(process.env[envProp].trim())) {
			try {
				return JSON.parse(process.env[envProp]);
			} catch (e) {}
		}
		return process.env[envProp];
	}
	// Local source level values take secondary priority
	if (valid(app[prop])) return app[prop];
	const selfThemeFiles = {
		screenTypes: decoFile(pkg.path, 'screenTypes.json'),
		fontGenerator: decoFile(pkg.path, 'fontGenerator.js')
	};
	if (valid(selfThemeFiles[prop])) return selfThemeFiles[prop];

	// Extended theme level values take tertiary priority
	const pathProps = ['isomorphic', 'template', 'screenTypes', 'fontGenerator'];
	const computeThemeProp = (p, cfg) => {
		if (valid(cfg[p])) {
			if (pathProps.includes(p)) return path.join(cfg.path, cfg[p]);
			return cfg[p];
		} else if (cfg.theme) {
			return computeThemeProp(p, cfg.theme);
		}
	};
	if (theme) return computeThemeProp(prop, theme);
};

const config = {
	// Project base directory.
	context: pkg.path,
	// Project name.
	name: pkg.meta.name,
	// Parse Enact metadata and apply options onto the config.
	applyEnactMeta: function(meta) {
		enact = Object.assign(enact, meta);

		// Parse the theme config tree for defaults
		config.theme = themeConfig(pkg.path, process.env.ENACT_THEME || enact.theme || 'moonstone');

		// Optional alternate entrypoint for isomorphic builds.
		config.isomorphic = computed('isomorphic', enact, config.theme);
		// Optional filepath to an alternate HTML template for html-webpack-plugin.
		config.template = computed('template', enact, config.theme);
		// Optional <title></title> value for HTML
		config.title = computed('title', enact, config.theme);
		// Optional flag whether to externalize the prerender startup js
		config.externalStartup = computed('externalStartup', enact, config.theme);
		// Optional webpack node configuration value (see https://webpack.js.org/configuration/node/).
		config.nodeBuiltins = computed('nodeBuiltins', enact, config.theme);
		// Optional property to specify a version of NodeJS to target required polyfills.
		// True or 'current' will use active version of Node, otherwise will use a specified version number.
		config.node = computed('node', enact, config.theme);
		// Optional window condition(s) that indicate deeplinking and invalidate HTML prerender.
		config.deep = computed('deep', enact, config.theme);
		// Proxy target to use within the http-proxy-middleware during serving.
		config.proxy = computed('proxy', enact, config.theme) || pkg.meta.proxy;
		// Optionally force all LESS/CSS to be handled modularly, instead of solely having
		// the *.module.css and *.module.less files be processed in a modular context.
		config.forceCSSModules = computed('forceCSSModules', enact, config.theme);

		// Resolve array of screenType configurations. When not found, falls back to any theme preset or moonstone.
		const screens = computed('screenTypes', enact, config.theme);
		config.screenTypes =
			(Array.isArray(screens) && screens) ||
			(typeof screens === 'string' &&
				((path.isAbsolute(screens) && gentlyParse(screens)) ||
					gentlyParse(path.join(pkg.path, screens)) ||
					gentlyParse(path.join(pkg.path, 'node_modules', screens)))) ||
			[];

		// Resolve the resolution independence settings from explicit settings or the resolved screenTypes definitions.
		const riConfig = computed('ri', enact, config.theme);
		config.ri = valid(riConfig)
			? riConfig
			: config.screenTypes.reduce((r, s) => (s.base && {baseSize: s.pxPerRem}) || r, undefined);

		// Resolved filepath to fontGenerator. When not found, falls back to any theme preset or moonstone.
		const fontGenerator = computed('fontGenerator', enact, config.theme);
		config.fontGenerator =
			fontGenerator &&
			(path.isAbsolute(fontGenerator)
				? fontGenerator
				: [path.join(pkg.path, fontGenerator), path.join(pkg.path, 'node_modules', fontGenerator)].find(
						fs.existsSync
				  ));

		// Override theme's accent LESS variable value if desired. Private option; may be removed in future.
		// When used, creates a LESS variable override map, overriding '@moon-accent' and/or '@<theme>-accent'
		// values with the specified override. This allows a simple way to alter Enact spotlight color.
		if (enact.accent) {
			config.accent = {'moon-accent': enact.accent};
			for (let t = config.theme; t; t = t.theme) {
				config.accent[t.name.replace('@enact/', '') + '-accent'] = enact.accent;
			}
		}
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
