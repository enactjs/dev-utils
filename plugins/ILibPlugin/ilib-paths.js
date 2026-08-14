
/*
 *  ilib-paths.js
 *
 *  Path-resolution helpers shared by ILibPlugin (webpack) and the
 *  esbuild-path plugins (EsbuildILibPlugin). Extracted from
 *  ILibPlugin/index.js's private `transformPath`/`bundleConst`/
 *  `packageSearch` functions so both bundler paths can share one
 *  implementation instead of diverging copies.
 */
const path = require('path');
const fs = require('graceful-fs');

// Walks up from `dir` looking for `node_modules/<pkg>`, returning the first
// match found (relative to cwd), or undefined if none is found.
function packageSearch (dir, pkg) {
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

// Normalize a filepath to be relative to the build context, using forward-slashes, and
// replace each '..' with '_', keeping in line with the file-loader and other webpack standards.
function transformPath (context, file) {
	return path
		.relative(context, file)
		.replace(/\\/g, '/')
		.replace(/\.\.(\/)?/g, '_$1');
}

function bundleConst (name) {
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