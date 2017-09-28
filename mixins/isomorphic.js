const
	path = require('path'),
	fs = require('fs'),
	helper = require('../config-helper'),
	PrerenderPlugin = require('../plugins/prerender/PrerenderPlugin'),
	LocaleHtmlPlugin = require('../plugins/prerender/LocaleHtmlPlugin');

function screenTypes(gui) {
	const decorator = gui.charAt(0).toUpperCase() + gui.slice(1) + 'Decorator';
	const scoped = path.join('node_modules', '@enact', gui, decorator, 'screenTypes.json');
	const basic = path.join('node_modules', gui, decorator, 'screenTypes.json');
	return fs.existsSync(scoped) ? scoped : (fs.existsSync(basic) ? basic : null);
}

function readJSON(file) {
	try {
		return JSON.parse(fs.readFileSync(file, {encoding:'utf8'}));
	} catch(e) {
		return undefined;
	}
}

module.exports = {
	apply: function(config, opts = {}) {
		const meta = readJSON('./package.json') || {};
		const enact = meta.enact || {};
		const iso = enact.isomorphic || enact.prerender;
		const app = helper.appRoot();

		// Resolve ReactDOM and ReactDOMSever relative to the app.
		const reactDOMServer = path.join(app, 'node_modules', 'react-dom', 'server.js');

		if(!opts.externals) {
			// Expose iLib locale utility function module so we can update the locale on page load, if used.
			if(opts.locales) {
				const locale = path.join(app, 'node_modules', '@enact', 'i18n', 'locale', 'locale.js');
				if(fs.existsSync(locale)) {
					const babel = helper.findLoader(config, 'babel');
					config.module.rules.splice((babel>=0 ? babel : 0), 0, {
						test: fs.realpathSync(locale),
						loader: 'expose-loader',
						options: 'iLibLocale'
					});
				}
			}
		}

		// If 'isomorphic' value is a string, use custom entrypoint.
		if(typeof iso === 'string') {
			config.entry.main[config.entry.main.length-1] = path.resolve(iso);
		}

		// Since we're building for isomorphic usage, expose ReactElement
		config.output.library = 'App';

		// Use universal module definition to allow usage in Node and browser environments.
		config.output.libraryTarget = 'umd';

		// Include plugin to prerender the html into the index.html
		// @TODO: combine into a single plugin
		const prerenderOpts = {
			server: require(reactDOMServer),
			locales: opts.locales,
			deep: enact.deep,
			externals: opts.externals,
			screenTypes:
					(Array.isArray(enact.screenTypes) && enact.screenTypes)
					|| (typeof enact.screenTypes === 'string'
						&& (readJSON(path.join(app, enact.screenTypes))
							|| readJSON(path.join(app, 'node_modules', enact.screenTypes))))
					|| readJSON(screenTypes(enact.gui || enact.theme || 'moonstone'))
		}
		if(!opts.locales) {
			config.plugins.push(new PrerenderPlugin(prerenderOpts));
		} else {
			config.plugins.push(new LocaleHtmlPlugin(prerenderOpts));
		}

		// Apply snapshot specialization options if needed
		if(opts.snapshot && !opts.externals) {
			const SnapshotPlugin = require('../plugins/SnapshotPlugin');

			// Include plugin to attempt generation of v8 snapshot binary if V8_MKSNAPSHOT env var is set
			config.plugins.push(new SnapshotPlugin({
				target: 'main.js'
			}));
		}
	}
};
