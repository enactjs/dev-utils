const helper = require('../config-helper');
const EnactFrameworkRefPlugin = require('../plugins/dll/EnactFrameworkRefPlugin');

module.exports = {
	apply: function (config, opts = {}) {
		// Include plugin to hook into its events
		const htmlPluginInstance = helper.getPluginByName(config, 'HtmlWebpackPlugin');

		// Add the reference plugin so the app uses the external framework
		config.plugins.push(
			new EnactFrameworkRefPlugin({
				name: 'enact_framework',
				libraries: ['@enact', 'react', 'react-dom', 'ilib'],
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
