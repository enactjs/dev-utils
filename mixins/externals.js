const EnactFrameworkRefPlugin = require('../plugins/dll/EnactFrameworkRefPlugin');

module.exports = {
	apply: function(config, opts = {}) {
		// Add the reference plugin so the app uses the external framework
		config.plugins.push(
			new EnactFrameworkRefPlugin({
				name: 'enact_framework',
				libraries: ['@enact', 'react', 'react-dom'],
				external: {
					publicPath: opts['externals-public'] || opts.externalsPublic || opts.externals,
					snapshot: opts.snapshot
				}
			})
		);
	}
};
