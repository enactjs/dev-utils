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

		const libraries = ['@enact', 'react', 'react-dom', 'ilib'];
		if (opts['externals-polyfill'] || opts.externalsPolyfill) libraries.push('core-js');

		const app = packageRoot();
		if (app.meta.name.startsWith('@enact/') && fs.existsSync(path.join(app.path, 'ThemeDecorator'))) {
			libraries.push('.');
		}

		// Add the reference plugin so the app uses the external framework
		config.plugins.push(
			new EnactFrameworkRefPlugin({
				name: 'enact_framework',
				libraries,
				polyfill,
				external: {
					publicPath: opts['externals-public'] || opts.externalsPublic || opts.externals,
					snapshot: opts.snapshot
				},
				htmlPlugin: htmlPluginInstance && htmlPluginInstance.constructor
			})
		);

		return config;
	}
};
