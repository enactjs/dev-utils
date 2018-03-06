const path = require('path');
const glob = require('glob');
const fs = require('graceful-fs');
const {DefinePlugin} = require('webpack');

function packageName(file) {
	try {
		return JSON.parse(fs.readFileSync(file, {encoding: 'utf8'})).name || '';
	} catch (e) {
		return '';
	}
}

function packageSearch(dir, pkg) {
	let pkgPath;
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

function resolveBundle(dir, context) {
	const bundle = {resolved: dir, path: dir, emit: true};
	if (path.isAbsolute(bundle.path)) {
		bundle.emit = false;
		bundle.resolved = JSON.stringify(bundle.path);
	} else {
		if (fs.existsSync(bundle.path)) {
			bundle.path = fs.realpathSync(bundle.path);
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
			manifest = fs.realpathSync(manifest);
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
				const dir = fs.realpathSync(path.dirname(manifest));
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

function ILibPlugin(options) {
	this.options = options || {};
	this.options.ilib = this.options.ilib || process.env.ILIB_BASE_PATH;
	const pkgName = packageName('./package.json');
	if (typeof this.options.ilib === 'undefined') {
		try {
			if (pkgName.indexOf('@enact') === 0) {
				this.options.resources = false;
			}
			if (pkgName === '@enact/i18n') {
				this.options.ilib = 'ilib';
			} else {
				this.options.ilib = packageSearch(process.cwd(), '@enact/i18n/ilib');
			}
		} catch (e) {
			console.error('ERROR: iLib locale not detected. Please ensure @enact/i18n is installed.');
			process.exit(1);
		}
	}
	if (typeof this.options.resources === 'undefined') {
		this.options.resources = 'resources';
	}
	this.options.bundles = this.options.bundles || {};
	if (typeof this.options.bundles.moonstone === 'undefined') {
		if (pkgName === '@enact/moonstone') {
			this.options.bundles.moonstone = 'resources';
		} else {
			const moonstone = packageSearch(process.cwd(), '@enact/moonstone');
			if (moonstone) {
				this.options.bundles.moonstone = path.join(moonstone, 'resources');
			}
		}
	}

	this.options.cache = typeof this.options.cache !== 'boolean' || this.options.cache;
	this.options.create = typeof this.options.create !== 'boolean' || this.options.create;
	this.options.emit = typeof this.options.emit !== 'boolean' || this.options.emit;
}

ILibPlugin.prototype.apply = function(compiler) {
	const opts = this.options;
	const created = [];
	let manifests = [];
	opts.context = compiler.options.context;

	if (opts.ilib) {
		// Resolve an accurate basepath for iLib.
		const ilib = resolveBundle(opts.ilib, opts.context);
		const definedConstants = {
			ILIB_BASE_PATH: ilib.resolved,
			ILIB_RESOURCES_PATH: resolveBundle(opts.resources || 'resources', opts.context).resolved,
			ILIB_CACHE_ID: '__webpack_require__.ilib_cache_id'
		};
		for (const name in opts.bundles) {
			if (opts.bundles[name]) {
				const bundle = resolveBundle(opts.bundles[name], opts.context);
				definedConstants['ILIB_' + name.toUpperCase() + '_PATH'] = bundle.resolved;
				if (opts.emit && bundle.emit) {
					manifests.push(path.join(bundle.path, 'ilibmanifest.json'));
				}
			}
		}

		// Rewrite the iLib global constants to specific values corresponding to the build.
		compiler.apply(new DefinePlugin(definedConstants));
		// Add a unique ID value to the webpack require-function, so that the value is correctly updated,
		// even when hot-reloading and serving.
		compiler.plugin('compilation', compilation => {
			compilation.mainTemplate.plugin('require-extensions', function(source) {
				const buf = [source];
				buf.push('');
				buf.push(this.requireFn + '.ilib_cache_id = ' + JSON.stringify('' + new Date().getTime()) + ';');
				return this.asString(buf);
			});
		});

		// Prepare manifest list for usage.
		// Missing files will created if needed otherwise scanned.
		if (opts.emit && ilib.emit) {
			manifests.unshift(path.join(ilib.path, 'locale', 'ilibmanifest.json'));
		}
		if (opts.emit && opts.resources) {
			manifests.push(path.join(opts.resources, 'ilibmanifest.json'));
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

		// Emit all bundles as applicable.
		compiler.plugin('emit', (compilation, callback) => {
			for (let j = 0; j < created.length; j++) {
				compilation.warnings.push(
					new Error(
						'iLibPlugin: Localization resource manifest not found. Created ' +
							created[j] +
							' to prevent future errors.'
					)
				);
			}
			manifests = compilation.applyPluginsWaterfall('ilib-manifest-list', manifests);
			handleBundles(compilation, manifests, opts, callback);
		});
	}
};

module.exports = ILibPlugin;
