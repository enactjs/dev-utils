const fs = require('fs');
const path = require('path');

function findPackageJSON(curr) {
	const parent = path.dirname(curr);
	if (parent === curr || curr.length === 0) {
		return null;
	} else {
		const pkg = path.join(curr, 'package.json');
		if (fs.existsSync(pkg)) {
			return {dir: curr, file: pkg};
		} else {
			return findPackageJSON(parent);
		}
	}
}

function findRoot(curr) {
	const pkg = findPackageJSON(curr);
	if (pkg) {
		try {
			const meta = require(pkg.file);
			if (meta.name) {
				return {path: pkg.dir, meta: meta};
			} else {
				return findRoot(path.resolve(pkg.dir, '..'));
			}
		} catch (e) {
			return findRoot(path.resolve(pkg.dir, '..'));
		}
	} else {
		throw new Error(
			'Unable to locate project root directory. ' + 'Valid project-level package.json file not found.'
		);
	}
}

module.exports = function(start) {
	return findRoot(path.resolve(start || process.cwd()));
};
