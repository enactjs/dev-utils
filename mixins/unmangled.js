const helper = require('../config-helper');

module.exports = {
	apply: function (config) {
		// Allow Terser's optimizations/debug-code-removal but don't minify
		const terserPlugin = helper.getMinimizerByName(config, 'TerserPlugin');
		if (terserPlugin) {
			// terser-webpack-plugin resolves `terserOptions` into
			// `options.minimizer.options` in its CONSTRUCTOR, and reads only that
			// at runtime — `options.terserOptions` does not exist on the instance
			// afterwards. This used to assign `terserPlugin.options.terserOptions`,
			// which therefore had no effect at all: `--no-minify` silently produced
			// fully-minified, fully-mangled output (the only visible difference was
			// `output.pathinfo` below). Mutate the resolved options object instead.
			const minimizer = terserPlugin.options && terserPlugin.options.minimizer;
			const minifyOptions = minimizer && minimizer.options;
			if (minifyOptions) {
				minifyOptions.mangle = false;
				minifyOptions.output = minifyOptions.output || {};
				minifyOptions.output.beautify = true;
				minifyOptions.output.comments = true;
			}
			config.output.pathinfo = true;
		}
		return config;
	}
};
