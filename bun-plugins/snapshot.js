const path = require('path');

function resolveCliModule(subpath) {
	const roots = [
		path.join(__dirname, '..', '..', 'cli', subpath),
		path.join(__dirname, '..', '..', '..', 'cli', subpath)
	];
	for (const candidate of roots) {
		try {
			return require(candidate);
		} catch (e) {
			// continue
		}
	}
	throw new Error('Unable to resolve CLI Bun module: ' + subpath);
}

module.exports = resolveCliModule('config/bun/snapshot.js');
