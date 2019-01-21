/**
 * Portions of this source code are based on code from create-react-app, used under the
 * following MIT license:
 *
 * Copyright (c) 2013-present, Facebook, Inc.
 * https://github.com/facebook/create-react-app
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const loaderUtils = require('loader-utils');

module.exports = function(context, localIdentName, localName, options) {
	// Create a hash based on a the file location and class name. Will be unique across a project, and close to globally unique.
	let ident;
	if (process.env.NODE_ENV === 'production') {
		ident = loaderUtils.getHashDigest(context.resourcePath + localName, 'md5', 'base64', 10);
	} else {
		const label = context.resourcePath.match(/index(\.module)*\.(css|less)$/) ? '[folder]' : '[name]';
		ident = label + '_' + localName + '_' + loaderUtils.getHashDigest(context.resourcePath, 'md5', 'base64', 5);
	}
	// Use loaderUtils to find the file or folder name
	const className = loaderUtils.interpolateName(context, ident, options);
	// remove the .module that appears in every classname when based on the file.
	return className.replace('.module_', '_');
};
