const fs = require('fs');
const path = require('path');
const glob = require('glob');
const {SyncWaterfallHook} = require('tapable');

// List of asset-pointing appinfo properties.
const props = [
	'icon',
	'largeIcon',
	'extraLargeIcon',
	'miniicon',
	'smallicon',
	'splashicon',
	'splashBackground',
	'bgImage',
	'imageForRecents'
];
// System assets starting with '$' are dynamic and will be within a variable
// directory within sysAssetsPath to denote system spec ('HD720', 'HD1080', etc.).
let sysAssetsPath = 'sys-assets';
let variableSysPaths = null;
// Mapping of absolute asset file paths to their relative distribution output.
// This allows us to avoid having multiple of the same files for locales that
// share assets.
const assetPathCache = {};

function readAppInfo(file) {
	// Read and parse appinfo.json file if it exists.
	if (fs.existsSync(file)) {
		try {
			const meta = JSON.parse(fs.readFileSync(file, {encoding: 'utf8'}));
			return meta;
		} catch (e) {
			console.log('ERROR: unable to read/parse appinfo.json at ' + file);
		}
	}
}

function handleSysAssetPath(context, appinfo) {
	// If the sysAsset base is specified, override the default one
	if (appinfo.sysAssetsBasePath && appinfo.sysAssetsBasePath !== sysAssetsPath) {
		sysAssetsPath = appinfo.sysAssetsBasePath;
		variableSysPaths = null;
	}
	// As needed, read all the variable directories for sysAssets
	const sys = path.join(context, sysAssetsPath);
	if (!variableSysPaths && fs.existsSync(sys)) {
		const list = fs.readdirSync(sys);
		for (let i = 0; i < list.length; i++) {
			list[i] = path.join(context, sysAssetsPath, list[i]);
			const stat = fs.statSync(list[i]);
			if (!stat.isDirectory()) {
				list.splice(i, 1);
				i--;
			}
		}
		variableSysPaths = list;
	}
}

function detectSysAssets(name) {
	// find all assets with the name given in the available sysAsset paths
	const result = [];
	const trueName = name.substring(1);
	for (let i = 0; i < variableSysPaths.length; i++) {
		const abs = path.resolve(path.join(variableSysPaths[i], trueName));
		if (fs.existsSync(abs)) {
			result.push(abs);
		}
	}
	return result;
}

function rootAppInfo(context, specific) {
	// The accepted root locations to search for the appinfo.json and its relative
	// assets are project root or ./webos-meta.
	const rootDir = [context, path.join(context, './webos-meta')];
	// If a specific path is requested, prepend it to the search list
	if (specific) {
		if (path.isAbsolute(specific)) {
			rootDir.unshift(specific);
		} else {
			rootDir.unshift(path.join(context, specific));
		}
	}
	// Check each search location, and if found, return the data and path it was found at.
	let meta;
	for (let i = 0; i < rootDir.length; i++) {
		meta = readAppInfo(path.join(rootDir[i], 'appinfo.json'));
		if (meta) {
			return {path: rootDir[i], obj: meta};
		}
	}
}

function addMetaAssets(metaDir, outDir, appinfo, compilation) {
	// For each appinfo.json property that contains a webos meta asset, resolve that asset,
	// and add its data to the compilation assets array.
	for (let i = 0; i < props.length; i++) {
		const p = props[i];
		if (appinfo[p]) {
			const assets =
				appinfo[p].charAt(0) === '$'
					? detectSysAssets(appinfo[p])
					: [path.resolve(path.join(metaDir, appinfo[p]))];
			for (let j = 0; j < assets.length; j++) {
				const abs = assets[j];
				if (appinfo[p].charAt(0) === '$') {
					if (!assetPathCache[abs]) {
						assetPathCache[abs] = path.relative(compilation.options.context, abs);
					}
				} else if (assetPathCache[abs]) {
					appinfo[p] = path.relative(outDir, assetPathCache[abs]);
				} else {
					assetPathCache[abs] = path.join(outDir, appinfo[p]);
				}
				if (!compilation.assets[assetPathCache[abs]]) {
					try {
						const data = fs.readFileSync(abs);
						emitAsset(assetPathCache[abs], compilation.assets, data);
					} catch (e) {
						compilation.warnings.push(
							new Error('WebOSMetaPlugin: Unable to read/emit appinfo asset at ' + abs)
						);
					}
				}
			}
		}
	}
}

function emitAsset(name, assets, data) {
	// Add a given asset's data to the compilation array in a webpack-compatible source object.
	assets[name] = {
		size: function() {
			return data.length;
		},
		source: function() {
			return data;
		},
		updateHash: function(hash) {
			return hash.update(data);
		},
		map: function() {
			return null;
		}
	};
}

class WebOSMetaPlugin {
	constructor(options = {}) {
		this.options = options;
	}

	apply(compiler) {
		const scan = this.options.path;
		const context = this.options.context || compiler.context;

		compiler.hooks.compilation.tap('WebOSMetaPlugin', compilation => {
			// Define compilation hooks
			compilation.hooks.webosMetaRootAppinfo = new SyncWaterfallHook(['appinfo', 'details']);
			compilation.hooks.webosMetaListLocalized = new SyncWaterfallHook(['list']);
			compilation.hooks.webosMetaLocalizedAppinfo = new SyncWaterfallHook(['appinfo', 'details']);

			// Hook into html-webpack-plugin to dynamically set page title
			if (compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration) {
				compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration.tapAsync(
					'WebOSMetaPlugin',
					(params, callback) => {
						const appinfo = rootAppInfo(context, scan);
						if (appinfo) {
							// When no explicit HTML document title is provided, automically use the root appinfo's title value.
							if (
								appinfo.obj.title &&
								(!params.plugin.options.title || params.plugin.options.title === 'Webpack App')
							) {
								params.plugin.options.title = appinfo.obj.title;
							}
						}
						callback();
					}
				);
			}
		});

		compiler.hooks.emit.tapAsync('WebOSMetaPlugin', (compilation, callback) => {
			// Add the root appinfo.json as well as its relative assets to the compilation.
			const meta = rootAppInfo(context, scan);
			if (meta && meta.obj) {
				meta.obj = compilation.hooks.webosMetaRootAppinfo.call(meta.obj, {
					path: meta.path
				});
				handleSysAssetPath(context, meta.obj);
				addMetaAssets(meta.path, '', meta.obj, compilation);
				emitAsset('appinfo.json', compilation.assets, Buffer.from(JSON.stringify(meta.obj, null, '\t')));
			}

			// Scan for all localized appinfo.json files in the "resources" directory.
			let loc = glob.sync('resources/**/appinfo.json', {
				cwd: context,
				nodir: true
			});
			loc = compilation.hooks.webosMetaListLocalized.call(loc);
			// Add each locale-specific appinfo.json and its relative assets to the compilation.
			let locFile, locRel, locMeta, locCode;
			for (let i = 0; i < loc.length; i++) {
				if (typeof loc[i] === 'string') {
					locFile = path.join(context, loc[i]);
					locRel = loc[i];
					locMeta = readAppInfo(locFile);
				} else {
					locFile = path.join(context, loc[i].generate);
					locRel = loc[i].generate;
					locMeta = loc[i].value || {};
				}
				if (locMeta) {
					locCode = path.relative(path.join(context, 'resources'), path.dirname(locFile));
					locCode = locCode.replace(/[\\/]+/g, '-');
					locMeta = compilation.hooks.webosMetaLocalizedAppinfo.call(locMeta, {
						path: locFile,
						locale: locCode
					});
					handleSysAssetPath(context, locMeta);
					addMetaAssets(path.dirname(locFile), path.dirname(locRel), locMeta, compilation);
					emitAsset(locRel, compilation.assets, Buffer.from(JSON.stringify(locMeta, null, '\t')));
				}
			}
			callback();
		});
	}
}

module.exports = WebOSMetaPlugin;
