const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const {SyncHook} = require('tapable');
const {IgnorePlugin} = require('webpack');
const helper = require('../../config-helper');

// Determine if it's a NodeJS output filesystem or if it's a foreign/virtual one.
function isNodeOutputFS(compiler) {
	return (
		compiler.outputFileSystem &&
		compiler.outputFileSystem.constructor &&
		compiler.outputFileSystem.constructor.name &&
		compiler.outputFileSystem.constructor.name === 'NodeOutputFileSystem'
	);
}

function getBlobName(args) {
	for (let i = 0; i < args.length; i++) {
		if (args[i].indexOf('--startup-blob=') === 0) {
			return args[i].replace('--startup-blob=', '');
		}
	}
	return 'snapshot_blob.bin';
}

class SnapshotPlugin {
	static get helperJS() {
		return require.resolve('./snapshot-helper');
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
		const reactDOM = path.resolve(path.join(app, 'node_modules', 'react-dom'));
		opts.blob = getBlobName(opts.args);

		// Define compilation hooks
		compiler.hooks.v8Snapshot = new SyncHook([]);

		// Ignore packages that don't exists so snapshot helper can skip them
		['@enact/i18n', '@enact/moonstone', '@enact/core/snapshot'].forEach(lib => {
			if (!fs.existsSync(path.join(app, 'node_modules', lib))) {
				new IgnorePlugin(new RegExp(lib)).apply(compiler);
			}
		});

		// Redirect external 'react-dom' import/require statements to the snapshot helper
		compiler.hooks.normalModuleFactory.tap('SnapshotPlugin', factory => {
			factory.hooks.beforeResolve.tap('SnapshotPlugin', result => {
				if (!result) return;
				if (result.request === 'react-dom') {
					// When the request originates from the injected helper, point to real 'react-dom'
					if (result.contextInfo.issuer === SnapshotPlugin.helperJS) {
						result.request = reactDOM;
					} else {
						result.request = SnapshotPlugin.helperJS;
					}
				}
				return result;
			});
		});

		// Record the v8 blob file in the root appinfo if applicable
		compiler.hooks.compilation.tap('SnapshotPlugin', compilation => {
			compilation.hooks.webosMetaRootAppinfo.tap('SnapshotPlugin', meta => {
				meta.v8SnapshotFile = opts.blob;
				return meta;
			});
		});

		compiler.hooks.afterEmit.tapAsync('SnapshotPlugin', (compilation, callback) => {
			if (isNodeOutputFS(compiler) && opts.exec) {
				// Notify v8 snapshot is taking place
				compiler.hooks.v8Snapshot.call(opts);

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
								size: function() {
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
					console.log(chalk.red('Snapshot blob generation failed.'));
				}

				callback(err);
			} else {
				callback();
			}
		});
	}
}

module.exports = SnapshotPlugin;
