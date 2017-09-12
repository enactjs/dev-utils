const
	externalsSetup = require('./externals'),
	frameworkSetup = require('./framework'),
	isomorphicSetup = require('./isomorphic'),
	statsSetup = require('./stats'),
	unmangledSetup = require('./unmangled');

module.exports = {
	apply: function(config, opts = {}) {
		opts.production |= process.env.NODE_ENV === 'production';
		if(opts.production && !opts['minify']) {
			unmangledSetup(config, opts);
		}

		if(opts.framework) {
			frameworkSetup(config, opts);
		} else {
			if(opts.isomorphic) {
				isomorphicSetup(config, opts);
			}
			if(opts.externals) {
				externalsSetup(config, opts);
			}
		}

		if(opts.stats) {
			statsSetup(config, opts);
		}
	},
	externals: externalsSetup,
	framework: frameworkSetup,
	isomorphic: isomorphicSetup,
	stats: statsSetup,
	unmangled: unmangledSetup
};
