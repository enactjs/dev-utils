const fs = require('fs');
const path = require('path');
const helper = require('../config-helper');
const app = require('../option-parser');
const PrerenderPlugin = require('../plugins/PrerenderPlugin');

module.exports = {
	apply: function(config, opts = {}) {
		// Resolve ReactDOM and ReactDOMSever relative to the app.
		const reactDOMServer = path.join(app.context, 'node_modules', 'react-dom', 'server.js');

		if (!opts.externals) {
			// Expose iLib locale utility function module so we can update the locale on page load, if used.
			if (opts.locales) {
				const locale = path.join(app.context, 'node_modules', '@enact', 'i18n', 'locale', 'locale.js');
				if (fs.existsSync(locale)) {
					const babel = helper.findLoader(config, 'babel');
					config.module.rules.splice(babel >= 0 ? babel : 0, 0, {
						test: fs.realpathSync(locale),
						loader: 'expose-loader',
						options: 'iLibLocale'
					});
				}
			}
		}

		// If 'isomorphic' value is a string, use custom entrypoint.
		if (typeof app.isomorphic === 'string') {
			helper.replaceMain(config, path.resolve(app.isomorphic));
		}

		// Since we're building for isomorphic usage, expose ReactElement
		config.output.library = 'App';

		// Use universal module definition to allow usage in Node and browser environments.
		config.output.libraryTarget = 'umd';

		// Include plugin to prerender the html into the index.html
		config.plugins.push(
			new PrerenderPlugin({
				server: require(reactDOMServer),
				locales: opts.locales,
				deep: app.deep,
				externals: opts.externals,
				screenTypes: app.screenTypes,
				fontGenerator: app.fontGenerator,
				externalStartup: app.externalStartup,
				mapfile: false
			})
		);

		// Apply snapshot specialization options if needed
		if (opts.snapshot && !opts.externals) {
			const SnapshotPlugin = require('../plugins/SnapshotPlugin');

			// Include plugin to attempt generation of v8 snapshot binary if V8_MKSNAPSHOT env var is set
			config.plugins.push(
				new SnapshotPlugin({
					target: 'main.js'
				})
			);
		}
	}
};
