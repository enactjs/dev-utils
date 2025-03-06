const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const gracefulFs = require('graceful-fs');
const {SyncHook} = require('tapable');
const {IgnorePlugin} = require('webpack');
const helper = require('../../config-helper');

// Determine if it's a NodeJS output filesystem or if it's a foreign/virtual one.
// The internal webpack5 implementation of outputFileSystem is graceful-fs.
function isNodeOutputFS(compiler) {
	return compiler.outputFileSystem && JSON.stringify(compiler.outputFileSystem) === JSON.stringify(gracefulFs);
}

function getBlobName(args) {
	for (let i = 0; i < args.length; i++) {
		if (args[i].indexOf('--startup-blob=') === 0) {
			return args[i].replace('--startup-blob=', '');
		}
	}
	return 'snapshot_blob.bin';
}

const snapshotPluginHooksMap = new WeakMap();

function getSnapshotPluginHooks(compilation) {
	let hooks = snapshotPluginHooksMap.get(compilation);

	// Setup the hooks only once
	if (hooks === undefined) {
		hooks = createSnapshotPluginHooks();
		snapshotPluginHooksMap.set(compilation, hooks);
	}

	return hooks;
}

function createSnapshotPluginHooks() {
	return {
		v8Snapshot: new SyncHook([])
	};
}

class SnapshotPlugin {
	static get helperJS() {
		return require.resolve('./snapshot-helper');
	}

	static get helperReduxJS() {
		return require.resolve('./snapshot-redux-helper');
	}

	constructor(options = {}) {
		this.options = options;
		this.options.exec = this.options.exec || process.env.V8_MKSNAPSHOT;
		this.options.args = this.options.args || [
			'--profile-deserialization',
			'--random-seed=314159265',
			'--abort_on_uncaught_exception',
			'--startup-blob=snapshot_blob.bin'
		];
		if (process.env.V8_SNAPSHOT_ARGS) {
			this.options.args = process.env.V8_SNAPSHOT_ARGS.split(/\s+/);
		}
		this.options.args.push(this.options.target || 'main.js');
	}

	apply(compiler) {
		const opts = this.options;
		const app = helper.appRoot();
		const reactDOMClient = path.resolve(path.join(app, 'node_modules', 'react-dom/client'));
		const reduxPath = path.join(app, 'node_modules', 'react-redux');
		const reactRedux = fs.existsSync(reduxPath) ? path.resolve(reduxPath) : null;
		opts.blob = getBlobName(opts.args);

		// Ignore packages that don't exists so snapshot helper can skip them
		const ignoreContext = path.dirname(SnapshotPlugin.helperJS);
		const missing = lib => !fs.existsSync(path.join(app, 'node_modules', lib));
		const filter = lib => (resource, context) => {
			return resource.startsWith(lib) && context === ignoreContext;
		};
		['@enact/i18n', '@enact/moonstone', '@enact/sandstone', '@enact/limestone', '@enact/core/snapshot'].filter(missing).forEach(p => {
			new IgnorePlugin({checkResource: filter(p)}).apply(compiler);
		});
		// ilib can be aliased to @enact/i18n/ilib, so verify both are missing before ignoring
		if (['ilib', '@enact/i18n/ilib'].every(missing)) {
			new IgnorePlugin({checkResource: filter('ilib')}).apply(compiler);
		}

		// Redirect external 'react-dom' import/require statements to the snapshot helper
		compiler.hooks.normalModuleFactory.tap('SnapshotPlugin', factory => {
			factory.hooks.beforeResolve.tap('SnapshotPlugin', result => {
				if (!result) return;
				if (result.request === 'react-dom/client') {
					// When the request originates from the injected helper, point to real 'react-dom'
					if (result.contextInfo.issuer === SnapshotPlugin.helperJS) {
						result.request = reactDOMClient;
					} else {
						result.request = SnapshotPlugin.helperJS;
					}
				}
				if (reactRedux && result.request === 'react-redux') {
					// When the request originates from the injected helper, point to real 'react-redux'
					if (result.contextInfo.issuer === SnapshotPlugin.helperReduxJS) {
						result.request = reactRedux;
					} else {
						result.request = SnapshotPlugin.helperReduxJS;
					}
				}
			});
		});

		// Record the v8 blob file in the root appinfo if applicable
		compiler.hooks.compilation.tap('SnapshotPlugin', compilation => {
			const webOSMetaPluginHooks = opts.webOSMetaPlugin.getHooks(compilation);
			if (webOSMetaPluginHooks) {
				webOSMetaPluginHooks.webosMetaRootAppinfo.tap('SnapshotPlugin', meta => {
					meta.v8SnapshotFile = opts.blob;
					return meta;
				});
			}
		});

		compiler.hooks.afterEmit.tapAsync('SnapshotPlugin', (compilation, callback) => {
			if (isNodeOutputFS(compiler) && opts.exec) {
				// Notify v8 snapshot is taking place
				getSnapshotPluginHooks(compilation).v8Snapshot.call(opts);

				// Run mksnapshot utility
				let err;
				const child = cp.spawnSync(opts.exec, opts.args, {
					cwd: compiler.outputPath,
					encoding: 'utf8'
				});

				if (child.status === 0) {
					// Add snapshot to the compilation assets array for stats purposes
					try {
						const stat = fs.statSync(path.join(compiler.outputPath, opts.blob));
						if (stat.size > 0) {
							compilation.assets[opts.blob] = {
								size: function () {
									return stat.size;
								},
								emitted: true
							};
						} else {
							// Temporary fix: mksnapshot may create a 0-byte blob on error
							err = new Error(child.stdout + '\n' + child.stderr);
						}
					} catch (e) {
						// Temporary fix: mksnapshot may return exit code 0, even on error.
						// Exception thrown when file not found
						err = new Error(child.stdout + '\n' + child.stderr);
					}
				} else {
					err = new Error(child.stdout + '\n' + child.stderr);
				}

				if (err) {
					import('chalk').then(({default: chalk}) => {
						console.log(
							chalk.red(
								'Snapshot blob generation "' +
									opts.exec +
									' ' +
									opts.args.join(' ') +
									'" in "' +
									compiler.outputPath +
									'" directory failed:"'
							)
						);
					});
				}

				callback(err);
			} else {
				callback();
			}
		});
	}
}

// A static helper to get the hooks for this plugin
// Usage: SnapshotPlugin.getHooks(compilation).HOOK_NAME.tapAsync('YourPluginName', () => { ... });
SnapshotPlugin.getHooks = getSnapshotPluginHooks;

module.exports = SnapshotPlugin;
