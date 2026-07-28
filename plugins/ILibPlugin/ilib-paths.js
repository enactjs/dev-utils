/* eslint-env node, es6 */
/**
 * ilib-paths
 *
 * Path/constant helpers shared by `ILibPlugin` (webpack) and `ViteILibPlugin`
 * (Vite). Kept dependency-free (only `fs`/`path`) so the Vite path can reuse them
 * without pulling webpack, tapable, or fast-glob (which `ILibPlugin/index.js`
 * requires at module load).
 */
const fs = require('fs');
const path = require('path');

// Walk up from `dir` looking for `node_modules/<pkg>`; return its path relative to cwd.
function packageSearch(dir, pkg) {
	let pkgPath;
	if (!path.isAbsolute(dir)) dir = path.join(process.cwd(), dir);
	while (dir.length > 0 && dir !== path.dirname(dir) && !pkgPath) {
		const full = path.join(dir, 'node_modules', pkg);
		if (fs.existsSync(full)) {
			pkgPath = path.relative(process.cwd(), full);
		} else {
			dir = path.dirname(dir);
		}
	}
	return pkgPath;
}

// Normalize a filepath to be relative to the context, using forward-slashes, and
// replace each '..' with '_', keeping in line with the file-loader and other standards.
function transformPath(context, file) {
	return path
		.relative(context, file)
		.replace(/\\/g, '/')
		.replace(/\.\.(\/)?/g, '_$1');
}

// The `ILIB_<BASENAME>_PATH` constant name for a bundle/package.
function bundleConst(name) {
	return (
		'ILIB_' +
		path
			.basename(name)
			.toUpperCase()
			.replace(/[-_\s]/g, '_') +
		'_PATH'
	);
}

module.exports = {packageSearch, transformPath, bundleConst};
