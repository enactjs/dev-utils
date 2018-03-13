module.exports = {
	apply: function(config, opts = {}) {
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

		if (opts.stats) {
			require('./stats').apply(config, opts);
		}
	}
};
