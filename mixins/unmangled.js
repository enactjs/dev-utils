const helper = require('../config-helper');

module.exports = {
	apply: function(config) {
		// Allow Terser's optimizations/debug-code-removal but don't minify
		const terserPlugin = helper.getMinimizerByName(config, 'TerserPlugin');
		if (terserPlugin) {
			terserPlugin.options.terserOptions = terserPlugin.options.terserOptions || {};
			terserPlugin.options.terserOptions.mangle = false;
			terserPlugin.options.terserOptions.output = terserPlugin.options.terserOptions.output || {};
			terserPlugin.options.terserOptions.output.beautify = true;
			terserPlugin.options.terserOptions.output.comments = true;
			config.output.pathinfo = true;
		}
		return config;
	}
};
