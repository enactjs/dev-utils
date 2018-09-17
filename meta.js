const pkgRoot = require('./package-root');

module.exports = function(opts = {}) {
	if (opts.meta) {
		let meta;

		try {
			meta = JSON.parse(opts.meta);
		} catch (ex) {
			console.error('Failed to parse custom package meta data.');
			console.error(ex);
			return;
		}

		pkgRoot.overrideMeta(meta);
	}
};
