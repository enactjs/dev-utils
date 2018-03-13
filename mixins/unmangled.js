const helper = require('../config-helper');

module.exports = {
	apply: function(config) {
		// Allow Uglify's optimizations/debug-code-removal but don't minify
		const uglifyPlugin = helper.getPluginByName(config, 'UglifyJsPlugin');
		if (uglifyPlugin) {
			uglifyPlugin.options.mangle = false;
			uglifyPlugin.options.beautify = true;
			uglifyPlugin.options.output.comments = true;
			config.output.pathinfo = true;
		}
	}
};
