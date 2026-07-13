const path = require('path');
const fs = require('fs-extra');

function resolveCliFramework () {
	const roots = [
		path.join(__dirname, '..', '..', 'cli', 'config', 'bun', 'framework.js'),
		path.join(__dirname, '..', '..', '..', 'cli', 'config', 'bun', 'framework.js')
	];
	for (const frameworkPath of roots) {
		if (fs.existsSync(frameworkPath)) {
			return require(frameworkPath);
		}
	}
	return null;
}

async function applyFramework (options = {}) {
	const cliFramework = resolveCliFramework();
	if (cliFramework) {
		return cliFramework.applyFramework(options);
	}
	throw new Error('Enact CLI Bun framework module not found.');
}

module.exports = {applyFramework};
