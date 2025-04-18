const path = require('path');
const pkgRoot = require('./package-root');

let rootCache;

function isNamed(name) {
	return fn => name && fn && fn.constructor && fn.constructor.name && fn.constructor.name === name;
}

function isPolyfill(file) {
	return /[\\/]polyfills\.(js|jsx|mjs|ts|tsx)$/.test(file);
}

module.exports = {
	appRoot: function () {
		return rootCache ? rootCache : (rootCache = pkgRoot().path);
	},
	injectEntry: function (config, entry, opts = {}) {
		if (typeof config.entry === 'string') {
			config.entry = [config.entry];
		}
		if (Array.isArray(config.entry)) {
			if (opts.first) {
				config.entry.unshift(entry);
			} else if (opts.last || opts.main) {
				config.entry.push(entry);
			} else {
				config.entry.splice(-1, 0, entry);
			}
		} else if (typeof config.entry === 'object') {
			const o = {entry: config.entry[opts.chunk || 'main']};
			this.injectEntry(o, entry, opts);
			config.entry[opts.chunk || 'main'] = o.entry;
		}
	},
	mainEntry: function (config, opts = {}) {
		if (typeof config.entry === 'string') {
			return config.entry;
		} else if (Array.isArray(config.entry)) {
			return config.entry[config.entry.length - 1];
		} else if (typeof config.entry === 'object') {
			return this.mainEntry({entry: config.entry[opts.chunk || 'main']}, opts);
		}
	},
	replaceMain: function (config, replacement, opts = {}) {
		if (typeof config.entry === 'string') {
			config.entry = replacement;
		} else if (Array.isArray(config.entry)) {
			config.entry[config.entry.length - 1] = replacement;
		} else if (typeof config.entry === 'object') {
			this.replaceMain({entry: config.entry[opts.chunk || 'main']}, replacement, opts);
		}
	},
	replaceEntry: function (config, replacement, opts = {}) {
		let entries = replacement;
		if (typeof replacement === 'string') {
			try {
				entries = JSON.parse(replacement);
			} catch (e) {
				entries = {main: replacement};
			}
		}
		Object.keys(entries).forEach(key => (entries[key] = path.resolve(entries[key])));

		const {main, ...restEntries} = entries;

		if (main) this.replaceMain(config, main, opts);

		if (Object.keys(restEntries).length !== 0) {
			config.entry = {...config.entry, ...restEntries};
			config.optimization.splitChunks = {...config.optimization.splitChunks, chunks: 'all'};
			this.getPluginByName(config, 'MiniCssExtractPlugin').options.ignoreOrder = true;
		}
	},
	polyfillFile: function ({entry} = {}) {
		if (typeof entry === 'string') {
			return isPolyfill(entry) && entry;
		} else if (Array.isArray(entry)) {
			return entry.find(isPolyfill);
		} else if (typeof entry === 'object') {
			return Object.keys(entry).reduce(
				(result, n) =>
					result ||
					(typeof entry[n] === 'string' && isPolyfill(entry[n]) && entry[n]) ||
					(Array.isArray(entry[n]) && entry[n].find(isPolyfill)),
				undefined
			);
		}
	},
	findPlugin: function ({plugins = []} = {}, name) {
		return plugins.findIndex(isNamed(name));
	},
	getPluginByName: function ({plugins = []} = {}, name) {
		return plugins[this.findPlugin({plugins}, name)];
	},
	removePlugin: function ({plugins = []} = {}, name) {
		const i = this.findPlugin({plugins}, name);
		if (i >= 0) plugins.splice(i, 1);
	},
	findMinimizer: function ({optimization = []} = {}, name) {
		return (optimization.minimizer || []).findIndex(isNamed(name));
	},
	getMinimizerByName: function ({optimization = []} = {}, name) {
		return (optimization.minimizer || [])[this.findMinimizer({optimization}, name)];
	},
	removeMinimizer: function ({optimization = {}} = {}, name) {
		const i = this.findMinimizer({optimization}, name);
		if (i >= 0) optimization.minimizer.splice(i, 1);
	}
};
