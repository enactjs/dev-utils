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

const ILIB_URL_PREFIXES = [
	'/node_modules/ilib',
	'/node_modules/@enact/i18n/ilib',
	'/node_modules/_enact/i18n/ilib',
	'node_modules/ilib',
	'node_modules/@enact/i18n/ilib',
	'node_modules/_enact/i18n/ilib'
];

function normalizePathSlashes (filePath) {
	return filePath.replace(/\\/g, '/');
}

function resolveIlibReplacement () {
	if (process.env.ILIB_FS_PATH) {
		return normalizePathSlashes(process.env.ILIB_FS_PATH);
	}

	const basePath = normalizePathSlashes(process.env.ILIB_BASE_PATH || '');
	if (/i18n[/\\]ilib[/\\]*$/.test(basePath)) {
		return 'node_modules/@enact/i18n/ilib';
	}

	return 'node_modules/ilib';
}

function getIlibUrlPrefixes () {
	const prefixes = [
		process.env.ILIB_BASE_PATH,
		...ILIB_URL_PREFIXES
	]
		.filter(Boolean)
		.map(normalizePathSlashes);

	return [...new Set(prefixes)];
}

function tryResolvePath (candidate) {
	return fs.existsSync(candidate) ? candidate : null;
}

function resolveFromIlibPrefix (filePath, prefix, cwd) {
	if (!prefix || !filePath.startsWith(prefix)) {
		return null;
	}

	const suffix = filePath.slice(prefix.length).replace(/^\//, '');
	const fsPath = process.env.ILIB_FS_PATH;

	if (fsPath) {
		const fromFs = tryResolvePath(path.join(fsPath, suffix));
		if (fromFs) {
			return fromFs;
		}
	}

	const replacement = resolveIlibReplacement();
	const relative = normalizePathSlashes(path.join(replacement, suffix));

	let resolved = tryResolvePath(path.resolve(cwd, relative));
	if (resolved) {
		return resolved;
	}

	if (relative.includes('@enact/i18n/ilib')) {
		resolved = tryResolvePath(path.resolve(cwd, relative.replace('@enact/i18n/ilib', 'ilib')));
		if (resolved) {
			return resolved;
		}
	}

	return null;
}

function isWebRootNodeModulesPath (filePath) {
	return /^\/node_modules\//.test(filePath);
}

function resolveFilePath (uri) {
	const cwd = process.env.ILIB_CONTEXT || process.cwd();
	let filePath = normalizePathSlashes(uri);

	for (const prefix of getIlibUrlPrefixes()) {
		const resolved = resolveFromIlibPrefix(filePath, prefix, cwd);
		if (resolved) {
			return resolved;
		}
	}

	if (process.env.ILIB_BASE_PATH) {
		const replacement = resolveIlibReplacement();
		filePath = filePath.replace(
			new RegExp('^' + escapeRegExp(normalizePathSlashes(process.env.ILIB_BASE_PATH))),
			replacement
		);
	}

	filePath = untransformPath(filePath);

	if (isWebRootNodeModulesPath(filePath)) {
		const resolved = tryResolvePath(path.resolve(cwd, filePath.replace(/^\//, '')));
		if (resolved) {
			return resolved;
		}
	}

	if (path.isAbsolute(filePath) && !isWebRootNodeModulesPath(filePath)) {
		return filePath;
	}

	const resolved = path.resolve(cwd, filePath);
	if (fs.existsSync(resolved)) {
		return resolved;
	}

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
