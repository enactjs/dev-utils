const fs = require('fs');
const path = require('path');
const helper = require('../config-helper');
const packageRoot = require('../package-root');
const EnactFrameworkRefPlugin = require('../plugins/dll/EnactFrameworkRefPlugin');

module.exports = {
	apply: function (config, opts = {}) {
		// Scan for any polyfills.js entry file for potential delegate.
		const polyfill = helper.polyfillFile(config);

		// Include plugin to hook into its events
		const htmlPluginInstance = helper.getPluginByName(config, 'HtmlWebpackPlugin');
		const webOSMetaPluginInstance = helper.getPluginByName(config, 'WebOSMetaPlugin');

		const libraries = ['@enact', 'react', 'react-dom', 'ilib'];

		const app = packageRoot();
		if (
			app.meta.name.startsWith('@enact/') &&
			(fs.existsSync(path.join(app.path, 'ThemeDecorator')) || app.meta.name === '@enact/i18n')
		) {
			libraries.push('.');
		}

		// Add the reference plugin so the app uses the external framework
		config.plugins.push(
			new EnactFrameworkRefPlugin({
				name: 'enact_framework',
				libraries,
				polyfill: (opts['externals-polyfill'] || opts.externalsPolyfill) && polyfill,
				external: {
					publicPath: opts['externals-public'] || opts.externalsPublic || opts.externals,
					snapshot: opts.snapshot
				},
				htmlPlugin: htmlPluginInstance && htmlPluginInstance.constructor,
				webOSMetaPlugin: webOSMetaPluginInstance && webOSMetaPluginInstance.constructor
			})
		);

		return config;
	}
};
