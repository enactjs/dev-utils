const path = require('path');
const glob = require('glob');
const fs = require('graceful-fs');
const {SyncWaterfallHook} = require('tapable');
const {ContextReplacementPlugin, DefinePlugin, Template} = require('webpack');
const app = require('../../option-parser');

function packageName(file) {
	try {
		return JSON.parse(fs.readFileSync(file, {encoding: 'utf8'})).name || '';
	} catch (e) {
		return '';
	}
}

function packageSearch(dir, pkg) {
	let pkgPath;
	if (!path.isAbsolute(dir)) dir = path.join(process.cwd(), dir);
	while (dir.length > 0 && dir !== path.dirname(dir) && !pkgPath) {
		const full = path.join(dir, 'node_modules', pkg);
		if (fs.existsSync(full)) {
			pkgPath = path.relative(process.cwd(), full);
		} else {
			dir = path.dirname(dir);
		}
	}
	return pkgPath;
}

// Determine if it's a NodeJS output filesystem or if it's a foreign/virtual one.
function isNodeOutputFS(compiler) {
	return (
		compiler.outputFileSystem &&
		compiler.outputFileSystem.constructor &&
		compiler.outputFileSystem.constructor.name &&
		compiler.outputFileSystem.constructor.name === 'NodeOutputFileSystem'
	);
}

// Normalize a filepath to be relative to the webpack context, using forward-slashes, and
// replace each '..' with '_', keeping in line with the file-loader and other webpack standards.
function transformPath(context, file) {
	return path
		.relative(context, file)
		.replace(/\\/g, '/')
		.replace(/\.\.(\/)?/g, '_$1');
}

function bundleConst(name) {
	return (
		'ILIB_' +
		path
			.basename(name)
			.toUpperCase()
			.replace(/[-_\s]/g, '_') +
		'_PATH'
	);
}

function resolveBundle(dir, context, symlinks) {
	const bundle = {resolved: dir, path: dir, emit: true};
	if (path.isAbsolute(bundle.path)) {
		bundle.emit = false;
		bundle.resolved = JSON.stringify(bundle.path);
	} else {
		if (fs.existsSync(path.join(context, bundle.path))) {
			if (symlinks) {
				bundle.path = fs.realpathSync(path.join(context, bundle.path));
			} else {
				bundle.path = path.join(context, bundle.path);
			}
		}
		bundle.resolved = '__webpack_require__.p + ' + JSON.stringify(transformPath(context, bundle.path));
	}
	return bundle;
}

// Read a manifest (creating a new one dynamically as applicable) and emit it,
// returning its contents.
function readManifest(compilation, manifest, opts) {
	let data;
	let files = [];
	if (typeof manifest === 'string') {
		if (fs.existsSync(manifest)) {
			if (opts.symlinks) manifest = fs.realpathSync(manifest);
			data = fs.readFileSync(manifest, {encoding: 'utf8'});
			if (data) {
				files = JSON.parse(data).files || files;
			}
		}
		emitAsset(compilation, transformPath(opts.context, manifest), data);
	} else {
		files = manifest.value || files;
		data = JSON.stringify({files: files}, null, '\t');
		emitAsset(compilation, transformPath(opts.context, manifest.generate), data);
	}
	return files;
}

// Read each manifest and process their contents.
function handleBundles(compilation, manifests, opts, callback) {
	if (manifests.length === 0) {
		callback();
	} else {
		const manifest = manifests.shift();
		try {
			const files = readManifest(compilation, manifest, opts);
			if (fs.existsSync(manifest) || opts.create) {
				const dir = opts.symlinks ? fs.realpathSync(path.dirname(manifest)) : path.dirname(manifest);
				handleManifestFiles(compilation, dir, files, opts, () => {
					handleBundles(compilation, manifests, opts, callback);
				});
			} else {
				handleBundles(compilation, manifests, opts, callback);
			}
		} catch (e) {
			compilation.errors.push(new Error('iLibPlugin: Unable to read localization manifest at ' + manifest));
			handleBundles(compilation, manifests, opts, callback);
		}
	}
}

// Read and emit all the assets in a particular manifest.
function handleManifestFiles(compilation, dir, files, opts, callback) {
	if (files.length === 0) {
		callback();
	} else {
		const outfile = path.join(dir, files.shift());
		if (shouldEmit(compilation.compiler, outfile, opts.cache)) {
			fs.readFile(outfile, (err, data) => {
				if (err) {
					compilation.errors.push(err);
				} else {
					emitAsset(compilation, transformPath(opts.context, outfile), data);
				}
				handleManifestFiles(compilation, dir, files, opts, callback);
			});
		} else {
			handleManifestFiles(compilation, dir, files, opts, callback);
		}
	}
}

// Determine if the output file exists and if its newer to determine if it should be emitted.
function shouldEmit(compiler, file, cache) {
	if (isNodeOutputFS(compiler)) {
		try {
			const src = fs.statSync(file);
			const dest = fs.statSync(
				path.join(compiler.options.output.path, transformPath(compiler.options.context, file))
			);
			return src.isDirectory() || src.mtime.getTime() > dest.mtime.getTime() || !cache;
		} catch (e) {
			return true;
		}
	} else {
		return true;
	}
}

// Add a given asset's data to the compilation array in a webpack-compatible source object.
function emitAsset(compilation, name, data) {
	compilation.assets[name] = {
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

class ILibPlugin {
	constructor(options = {}) {
		this.options = options;
		this.options.ilib = this.options.ilib || process.env.ILIB_BASE_PATH;
		const pkgName = packageName('./package.json');
		if (typeof this.options.ilib === 'undefined') {
			try {
				if (pkgName.indexOf('@enact') === 0) {
					this.options.create = false;
				}
				// look for ilib as a root-level node_module package location
				this.options.ilib =
					// Backward compatability for old Enact libraries
					packageSearch(process.cwd(), path.join('@enact', 'i18n', 'ilib')) ||
					packageSearch(process.cwd(), 'ilib') ||
					(pkgName === '@enact/i18n' && fs.existsSync(path.join(process.cwd(), 'ilib')) && 'ilib');
			} catch (e) {
				console.error('ERROR: iLib locale not detected. Please ensure "ilib" is installed.');
				process.exit(1);
			}
		}
		if (typeof this.options.resources === 'undefined') {
			this.options.resources = 'resources';
		}

		this.options.cache = typeof this.options.cache !== 'boolean' || this.options.cache;
		this.options.create = typeof this.options.create !== 'boolean' || this.options.create;
		this.options.emit =
			typeof process.env.ILIB_ASSET_EMIT !== 'undefined'
				? process.env.ILIB_ASSET_EMIT === 'true'
				: typeof this.options.emit !== 'boolean' || this.options.emit;
		this.options.symlinks = typeof this.options.symlinks !== 'boolean' || this.options.symlinks;
	}

	apply(compiler) {
		const opts = this.options;
		const created = [];
		let manifests = [];
		if (opts.ilib) {
			opts.context = opts.context || compiler.context;

			// If bundles are undefined, attempt to autodetect theme bundles at buildtime
			if (typeof opts.bundles === 'undefined') {
				opts.bundles = {};
				let pkgDir = process.cwd();
				for (let t = app.theme; t; t = t.theme) {
					pkgDir = packageSearch(pkgDir, t.name);
					if (pkgDir) {
						opts.bundles[t.name] = path.join(pkgDir, 'resources');
					} else {
						console.warn('WARNING: Unable to location theme package ' + t.name);
					}
				}
			}

			// Resolve an accurate basepath for iLib.
			const ilib = resolveBundle(opts.ilib, opts.context, opts.symlinks);
			const resources = resolveBundle(opts.resources || 'resources', opts.context, opts.symlinks);
			const definedConstants = {
				ILIB_BASE_PATH: ilib.resolved,
				ILIB_RESOURCES_PATH: resources.resolved,
				ILIB_CACHE_ID: '__webpack_require__.ilib_cache_id',
				// when `emit` is false and `ilib` is not absolute, can delare no assets
				ILIB_NO_ASSETS: JSON.stringify(!opts.emit && !path.isAbsolute(opts.ilib))
			};
			definedConstants[bundleConst(app.name)] = definedConstants.ILIB_RESOURCES_PATH;
			for (const name in opts.bundles) {
				if (opts.bundles[name]) {
					const bundle = resolveBundle(opts.bundles[name], opts.context, opts.symlinks);
					const bundleManifest = path.join(bundle.path, 'ilibmanifest.json');
					definedConstants[bundleConst(name)] = bundle.resolved;
					if (opts.emit && bundle.emit && fs.existsSync(bundleManifest)) {
						manifests.push(bundleManifest);
					}
				}
			}

			// Rewrite the iLib global constants to specific values corresponding to the build.
			new DefinePlugin(definedConstants).apply(compiler);

			// Prevent webpack from attempting to create a dynamic context for certain iLib utilities
			// which contain unused function-expression require statements.
			new ContextReplacementPlugin(/ilib/, /^$/).apply(compiler);

			compiler.hooks.compilation.tap('ILibPlugin', compilation => {
				// Define compilation hooks
				compilation.hooks.ilibManifestList = new SyncWaterfallHook(['manifests']);

				// Add a unique ID value to the webpack require-function, so that the value is correctly updated,
				// even when hot-reloading and serving.
				const main = compilation.mainTemplate;
				main.hooks.requireExtensions.tap('ILibPlugin', source => {
					const buf = [source];
					buf.push('');
					buf.push(main.requireFn + '.ilib_cache_id = ' + JSON.stringify('' + new Date().getTime()) + ';');
					return Template.asString(buf);
				});
			});

			// Prepare manifest list for usage.
			// Missing files will created if needed otherwise scanned.
			if (opts.emit) {
				if (ilib.emit) {
					manifests.unshift(path.join(ilib.path, 'locale', 'ilibmanifest.json'));
				}
				if (opts.resources) {
					manifests.push(path.join(resources.path, 'ilibmanifest.json'));
				}
				for (let i = 0; i < manifests.length; i++) {
					if (!fs.existsSync(manifests[i])) {
						const dir = path.dirname(manifests[i]);
						let files = [];
						if (fs.existsSync(dir)) {
							files = glob.sync('./**/!(appinfo).json', {nodir: true, cwd: dir});
							for (let k = 0; k < files.length; k++) {
								files[k] = files[k].replace(/^\.\//, '');
							}
						}
						if (opts.create) {
							if (!fs.existsSync(dir)) {
								fs.mkdirSync(dir);
							}
							fs.writeFileSync(manifests[i], JSON.stringify({files: files}, null, '\t'), {
								encoding: 'utf8'
							});
							created.push(manifests[i]);
						} else {
							manifests[i] = {generate: manifests[i], value: files};
						}
					}
				}
			}

			// Emit all bundles as applicable.
			compiler.hooks.emit.tapAsync('ILibPlugin', (compilation, callback) => {
				for (let j = 0; j < created.length; j++) {
					compilation.warnings.push(
						new Error(
							'iLibPlugin: Localization resource manifest not found. Created ' +
								created[j] +
								' to prevent future errors.'
						)
					);
				}
				manifests = compilation.hooks.ilibManifestList.call(manifests);
				handleBundles(compilation, manifests, opts, callback);
			});
		}
	}
}

module.exports = ILibPlugin;
