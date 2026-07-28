module.exports = {
	apply: function (config, opts = {}) {
		opts.isomorphic = opts.isomorphic || opts.snapshot;

		if (opts.minify === false) {
			require('./unmangled').apply(config, opts);
		}

		if (opts.framework) {
			require('./framework').apply(config, opts);
		} else {
			if (opts.isomorphic) {
				require('./isomorphic').apply(config, opts);
			}
			if (opts.externals) {
				require('./externals').apply(config, opts);
			}
		}

		if (opts.verbose) {
			require('./verbose').apply(config, opts);
		}

		if (opts.stats) {
			require('./stats').apply(config, opts);
		}

		return config;
	},
	// Vite counterpart to `apply`: shapes a resolved Vite config from the same opts
	// (--no-minify, --verbose, --stats). The webpack `apply` above can't be reused
	// because it mutates webpack-specific config (plugins/minimizers/output).
	applyVite: function (config, opts = {}) {
		return require('./vite').apply(config, opts);
	}
};
