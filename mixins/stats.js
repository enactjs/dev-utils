const {BundleAnalyzerPlugin} = require('webpack-bundle-analyzer');

module.exports = {
	apply: function(config) {
		config.plugins.push(
			new BundleAnalyzerPlugin({
				analyzerMode: 'static',
				reportFilename: 'stats.html',
				openAnalyzer: false
			})
		);
		return config;
	}
};
