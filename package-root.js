const
	path = require('path'),
	fs = require('fs');

function findPackageJSON(curr) {
	if(curr.replace(/(^[.\\/]+|[\\/]+$)/g, '').length === 0) {
		return null;
	} else {
		const pkg = path.join(curr, 'package.json');
		if(fs.existsSync(pkg)) {
			return {dir:curr, file:pkg};
		} else {
			return findPackageJSON(path.dirname(curr));
		}
	}
}

function findRoot(curr) {
	const pkg = findPackageJSON(curr);
	if(pkg) {
		try {
			const meta = require(pkg.file);
			if(meta.name) {
				return {path:pkg.dir, meta:meta};
			} else {
				return findRoot(path.resolve(pkg.dir, '..'));
			}
		} catch (e) {
			return findRoot(path.resolve(pkg.dir, '..'));
		}
	} else {
		throw new Error('Unable to locate project root directory. '
			+ 'Valid project-level package.json file not found.');
	}
}

module.exports = function(start) {
	return findRoot(path.resolve(start || process.cwd()));
}
