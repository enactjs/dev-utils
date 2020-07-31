const fs = require('fs');
const path = require('path');
const DllEntryPlugin = require('webpack/lib/DllEntryPlugin');
const DllModule = require('webpack/lib/DllModule');
const {RawSource} = require('webpack-sources');
const app = require('../../option-parser');

const pkgCache = {};
const checkPkgMain = function (dir) {
	if (pkgCache[dir]) {
		return pkgCache[dir].main;
	} else {
		try {
			const text = fs.readFileSync(path.join(dir, 'package.json'), {encoding: 'utf8'});
			pkgCache[dir] = JSON.parse(text);
			return pkgCache[dir].main;
		} catch (e) {
			return undefined;
		}
	}
};

const parentCache = {};
const findParent = function (dir) {
	if (parentCache[dir]) {
		return parentCache[dir];
	} else {
		const currPkg = path.join(dir, 'package.json');
		if (fs.existsSync(currPkg)) {
			return dir;
		} else if (dir === '/' || dir === '' || dir === '.') {
			return null;
		} else {
			return findParent(path.dirname(dir));
		}
	}
};

function normalizeModuleID(id, polyfill) {
	const dir = fs.existsSync(id) && fs.statSync(id).isDirectory() ? id : path.dirname(id);
	parentCache[dir] = findParent(dir);
	if (parentCache[dir]) {
		const main = checkPkgMain(parentCache[dir]);
		if (main && path.resolve(id) === path.resolve(path.join(parentCache[dir], main))) {
			id = parentCache[dir];
		}
	}
	id = id.replace(/\\/g, '/');

	// Remove any leading ./node_modules prefix
	const nodeModulesPrefix = './node_modules/';
	if (id.startsWith(nodeModulesPrefix)) {
		id = id.substring(nodeModulesPrefix.length);
	}

	// Reduce core-js long paths to shorthand
	if (id.includes('node_modules/core-js/')) {
		id = id.substring(id.indexOf('node_modules/core-js/') + 13);
	}

	// Transform IDs as needed
	if (path.resolve(id) === polyfill) {
		// shorthand to load core-js
		id = '@enact/polyfills';
	} else if (!id.includes('node_modules')) {
		// Remove any js file extension
		if (id.endsWith('.js')) {
			id = id.substring(0, id.length - 3);
		}
		// Remove any /index suffix as we want the user-accessible ID
		if (id.endsWith('/index') && id.length > 6 && !id.startsWith('core-js')) {
			id = id.substring(0, id.length - 6);
		}
		// Add package name prefix for local files
		if (id.startsWith('.') && !id.startsWith('..')) {
			id = id.replace('.', app.name);
		}
	}
	return id;
}

DllModule.prototype.source = function () {
	let header = '';
	if (DllModule.entries[this.name]) {
		header += '__webpack_require__.load = function(loader) {\n';
		header += '\tloader = loader || __webpack_require__;';
		for (let i = 0; i < DllModule.entries[this.name].length; i++) {
			header += "\tloader('" + DllModule.entries[this.name][i] + "');\n";
		}
		header += '};\n';
	}
	return new RawSource(header + 'module.exports = __webpack_require__;');
};

class EnactFrameworkPlugin {
	constructor(options = {}) {
		this.options = options;
	}

	apply(compiler) {
		const poly = this.options.polyfill;

		// Map entries to the DLLEntryPlugin
		DllModule.entries = {};
		compiler.hooks.entryOption.tap('EnactFrameworkPlugin', (context, entry) => {
			function itemToPlugin(item, name) {
				if (Array.isArray(item)) {
					DllModule.entries[name] = [];
					for (let i = 0; i < item.length; i++) {
						const prefix = item[i].startsWith('.') ? '' : './node_modules/';
						DllModule.entries[name].push(normalizeModuleID(prefix + item[i], poly));
					}
					return new DllEntryPlugin(context, item, name);
				} else {
					throw new Error('EnactFrameworkPlugin: supply an Array as entry');
				}
			}
			if (typeof entry === 'object') {
				Object.keys(entry).forEach(name => itemToPlugin(entry[name], name).apply(compiler));
			} else {
				itemToPlugin(entry, 'main').apply(compiler);
			}
			return true;
		});

		// Format the internal module ID to a usable named descriptor
		compiler.hooks.compilation.tap('EnactFrameworkPlugin', compilation => {
			compilation.hooks.beforeModuleIds.tap('EnactFrameworkPlugin', modules => {
				modules.forEach(m => {
					if (m.id === null && m.libIdent) {
						m.id = m.libIdent({
							context: this.options.context || compiler.options.context
						});
						m.id = normalizeModuleID(m.id, poly);
					}
				}, this);
			});
		});
	}
}

module.exports = EnactFrameworkPlugin;
