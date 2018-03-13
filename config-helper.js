const pkgRoot = require('./package-root');

let rootCache;

module.exports = {
	appRoot: function() {
		return rootCache ? rootCache : (rootCache = pkgRoot().path);
	},
	injectEntry: function(config, entry, opts = {}) {
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
	mainEntry: function(config, opts = {}) {
		if (typeof config.entry === 'string') {
			return config.entry;
		} else if (Array.isArray(config.entry)) {
			return config.entry[config.entry.length - 1];
		} else if (typeof config.entry === 'object') {
			return this.mainEntry({entry: config.entry[opts.chunk || 'main']}, opts);
		}
	},
	replaceMain: function(config, replacement, opts = {}) {
		if (typeof config.entry === 'string') {
			config.entry = replacement;
		} else if (Array.isArray(config.entry)) {
			config.entry[config.entry.length - 1] = replacement;
		} else if (typeof config.entry === 'object') {
			this.replaceMain({entry: config.entry[opts.chunk || 'main']}, replacement, opts);
		}
	},
	findLoader: function(config, name) {
		let index = -1;
		if (config && config.module && config.module.rules && name) {
			for (let i = 0; i < config.module.rules.length; i++) {
				if (config.module.rules[i].loader) {
					if (
						config.module.rules[i].loader === name + '-loader' ||
						new RegExp('node_modules[\\\\/]' + name + '-loader').test(config.module.rules[i].loader)
					) {
						index = i;
						break;
					}
				}
			}
		}
		return index;
	},
	getLoaderByName: function(config, name) {
		if (config && config.module && config.module.rules && name) {
			return config.module.rules[this.findLoader(config, name)];
		}
	},
	findPlugin: function(config, name) {
		let index = -1;
		if (config && config.plugins && name) {
			for (let i = 0; i < config.plugins.length; i++) {
				if (
					config.plugins[i] &&
					config.plugins[i].constructor &&
					config.plugins[i].constructor.name &&
					config.plugins[i].constructor.name === name
				) {
					index = i;
					break;
				}
			}
		}
		return index;
	},
	getPluginByName: function(config, name) {
		if (config && config.plugins && name) {
			return config.plugins[this.findPlugin(config, name)];
		}
	},
	removePlugin: function(config, name) {
		const i = this.findPlugin(config, name);
		if (i >= 0) {
			config.plugins.splice(i, 1);
		}
	}
};
