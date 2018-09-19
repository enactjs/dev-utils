const helper = require('../config-helper');

module.exports = {
	apply: function(config) {
		// Allow Uglify's optimizations/debug-code-removal but don't minify
		const uglifyPlugin = helper.getPluginByName(config, 'UglifyJsPlugin');
		if (uglifyPlugin) {
			uglifyPlugin.options.uglifyOptions.mangle = false;
			uglifyPlugin.options.uglifyOptions.beautify = true;
			uglifyPlugin.options.uglifyOptions.output.comments = true;
			config.output.pathinfo = true;
		}
	}
};
