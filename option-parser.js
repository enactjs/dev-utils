const fs = require('fs');
const path = require('fs');
const pkgRoot = require('./package-root');

const pkg = pkgRoot();
const enact = pkg.meta.enact || {};

function gentlyParse(file) {
	try {
		return JSON.parse(fs.readFileSync(file, {encoding:'utf8'}));
	} catch(e) {
		return undefined;
	}
}

function screenTypes(theme) {
	const decorator = theme.charAt(0).toUpperCase() + theme.slice(1) + 'Decorator';
	const scoped = path.join('node_modules', '@enact', theme, decorator, 'screenTypes.json');
	const basic = path.join('node_modules', theme, decorator, 'screenTypes.json');
	return fs.existsSync(scoped) ? scoped : (fs.existsSync(basic) ? basic : null);
}

function fontGenerator(theme) {
	const decorator = theme.charAt(0).toUpperCase() + theme.slice(1) + 'Decorator';
	const scoped = path.join('node_modules', '@enact', theme, decorator, 'fontGenerator.js');
	const basic = path.join('node_modules', theme, decorator, 'fontGenerator.js');
	return fs.existsSync(scoped) ? scoped : (fs.existsSync(basic) ? basic : null);
}

module.exports = {
	// Project base directory
	context: pkg.dir,
	// Project name
	name: pkg.meta.name,
	// Main application entrypoint.
	main: pkg.meta.main,
	// Optional alternate entrypoint for isomorphic builds.
	isomorphic: enact.isomorphic,
	// Optional filepath to an alternate HTML template for html-webpack-plugin.
	template: enact.template,
	// Optional <title></title> value for HTML
	title: enact.title,
	// Optional webpack node configuration value (see https://webpack.js.org/configuration/node/).
	node: enact.node,
	// Optional webpack target value (see https://webpack.js.org/configuration/target/).
	environment: enact.target,
	// Optional window condition(s) that indicate deeplinking and invalidate HTML prerender.
	deep: enact.deep,
	// Proxy target to use within the http-proxy-middleware during serving.
	proxy: enact.proxy || pkg.meta.proxy,
	// Optional theme preset for theme-specific settings (see below).
	theme: enact.theme
};

// Resolved array of screenType configurations. When not found, falls back to any theme preset or moonstone.
module.exports.screenTypes =
		(Array.isArray(enact.screenTypes) && enact.screenTypes)
		|| (typeof enact.screenTypes === 'string'
			&& (gentlyParse(path.join(pkg.dir, enact.screenTypes))
				|| gentlyParse(path.join(pkg.dir, 'node_modules', enact.screenTypes))))
		|| gentlyParse(screenTypes(enact.theme || 'moonstone'));

// Resolve the resolution independence settings from explicit settings or the resolved screenTypes definitions.
module.exports.ri =	enact.ri || module.exports.screenTypes.reduce((r, s) => (s.base && s.pxPerRem) || r, null);

// Resolved filepath to fontGenerator. When not found, falls back to any theme preset or moonstone.
module.exports.fontGenerator =
		((typeof enact.screenTypes === 'string'
			&& [path.join(pkg.dir, enact.fontGenerator), path.join(pkg.dir, 'node_modules', enact.fontGenerator)]
				.find(fs.existsSync))
		|| fontGenerator(enact.theme || 'moonstone'));
