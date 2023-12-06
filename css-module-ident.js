const fs = require('fs');
const path = require('path');
const loaderUtils = require('loader-utils');
const app = require('./option-parser');
const packageRoot = require('./package-root');

const fileIdentPattern = /(?:@(enact[/\\].*?)|^((?:(?!@enact).)*?))\.(?:module\.)?(?:less|css|sass|scss)/;

// A simplified development-focused `getLocalIdent` function for webpack CSS loader
// Outputs similar to `[path][name]_[local]`, except with `.module.(css|less|sass|scss)` extension
// filtering and using underscores for separators and condensed `@enact/*` naming.
module.exports = function (context, localIdentName, localName) {
	let rel = path.relative(app.context, context.resourcePath);
	if (rel.startsWith('..')) {
		const parentMeta = packageRoot(fs.realpathSync(rel));
		if (parentMeta && parentMeta.meta.name.startsWith('@enact/')) {
			// Create a pseudo relative path. as though it were a local package, by resolving
			// from the nearest parent package root
			const externalRel = path.relative(parentMeta.path, context.resourcePath);
			rel = path.join('node_modules', parentMeta.meta.name, externalRel);
		} else {
			// Out-of-app, and not within a package; just try our best and use absolute path
			rel = rel.replace(/\.\./g, '-');
		}
	}
	const fileMatch = rel.match(fileIdentPattern);
	const identFile = (fileMatch && (fileMatch[1] || fileMatch[2])) || 'unknown';

	// Create a hash based on a the file location and class name. Will be unique across a project, and close to globally unique.
	let hash = '';
	if (process.env.SIMPLE_CSS_IDENT !== 'true') {
		hash =
			'__' +
			loaderUtils.getHashDigest(
				path.posix.relative(context.rootContext, context.resourcePath) + localName,
				'md5',
				'base64url',
				5
			);
	}

	return identFile.replace(/[/\\]+/g, '_') + '_' + localName + hash;
};
