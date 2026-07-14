const fs = require('fs');
const path = require('path');

function escapeRegExp (string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function untransformPath (uri) {
	return uri
		.replace(/\\/g, '/')
		.replace(/(^|\/)(_)($|\/)/g, (match, before, segment, after) => before + '..' + (after || ''));
}

function resolveIlibReplacement () {
	if (process.env.ILIB_FS_PATH) {
		return process.env.ILIB_FS_PATH.replace(/\\/g, '/');
	}

	const basePath = (process.env.ILIB_BASE_PATH || '').replace(/\\/g, '/');
	if (/i18n[/\\]ilib[/\\]*$/.test(basePath)) {
		return 'node_modules/@enact/i18n/ilib';
	}

	return 'node_modules/ilib';
}

function resolveFilePath (uri) {
	const cwd = process.env.ILIB_CONTEXT || process.cwd();
	let filePath = uri.replace(/\\/g, '/');

	if (process.env.ILIB_BASE_PATH) {
		const replacement = resolveIlibReplacement();
		filePath = filePath.replace(
			new RegExp('^' + escapeRegExp(process.env.ILIB_BASE_PATH.replace(/\\/g, '/'))),
			replacement
		);
	}

	filePath = untransformPath(filePath);

	if (path.isAbsolute(filePath)) {
		return filePath;
	}

	const resolved = path.resolve(cwd, filePath);
	if (fs.existsSync(resolved)) {
		return resolved;
	}

	// When linked @enact/i18n/ilib is missing, fall back to standalone ilib.
	if (filePath.includes('@enact/i18n/ilib')) {
		const fallback = path.resolve(cwd, filePath.replace('@enact/i18n/ilib', 'ilib'));
		if (fs.existsSync(fallback)) {
			return fallback;
		}
	}

	return resolved;
}

function FileXHR () {}

FileXHR.prototype.open = function (method, uri, async) {
	this.method = method;
	this.uri = uri;
	this.sync = async === false;
};

FileXHR.prototype.addEventListener = function (evt, fn) {
	this['on' + evt] = fn;
};

FileXHR.prototype.send = function () {
	if (this.method.toUpperCase() === 'GET' && this.uri && this.sync) {
		const parsedURI = resolveFilePath(this.uri);
		try {
			if (!fs.existsSync(parsedURI)) throw new Error('File not found: ' + parsedURI);

			this.response = this.responseText = fs.readFileSync(parsedURI, {encoding: 'utf8'});
			this.status = 200;
			if (this.onload) this.onload();
		} catch (e) {
			this.status = 404;
			if (this.onerror) this.onerror(e.message || e);
		}
	}
};

module.exports = FileXHR;
