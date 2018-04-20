const cp = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
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

function SnapshotPlugin(options) {
	this.options = options || {};
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
module.exports = SnapshotPlugin;
SnapshotPlugin.prototype.apply = function(compiler) {
	const opts = this.options;
	const app = helper.appRoot();
	const snapshotJS = require.resolve('./snapshot-helper');
	const reactDOM = path.resolve(path.join(app, 'node_modules', 'react-dom'));
	opts.blob = getBlobName(opts.args);

	// Ignore packages that don't exists so snapshot helper can skip them
	['@enact/i18n', '@enact/moonstone', '@enact/core/snapshot'].forEach(lib => {
		if (!fs.existsSync(path.join(app, 'node_modules', lib))) {
			compiler.apply(new IgnorePlugin(new RegExp(lib)));
		}
	});

	// Inject snapshot helper for the transition from v8 snapshot into the window
	compiler.plugin('after-environment', () => {
		helper.injectEntry(compiler.options, snapshotJS);
	});

	// Redirect external 'react-dom' import/require statements to the snapshot helper
	compiler.plugin('normal-module-factory', factory => {
		factory.plugin('before-resolve', (result, callback) => {
			if (!result) return callback();

			if (result.request === 'react-dom') {
				// When the request originates from the injected helper, point to real 'react-dom'
				result.request = result.contextInfo.issuer === snapshotJS ? reactDOM : snapshotJS;
			}
			return callback(null, result);
		});
	});

	// Record the v8 blob file in the root appinfo if applicable
	compiler.plugin('compilation', compilation => {
		compilation.plugin('webos-meta-root-appinfo', meta => {
			meta.v8SnapshotFile = opts.blob;
			return meta;
		});
	});

	compiler.plugin('after-emit', (compilation, callback) => {
		if (isNodeOutputFS(compiler) && opts.exec) {
			// Run mksnapshot utility
			let err;
			const child = cp.spawnSync(opts.exec, opts.args, {
				cwd: compiler.options.output.path,
				encoding: 'utf8'
			});

			if (child.status === 0) {
				// Add snapshot to the compilation assets array for stats purposes
				try {
					const stat = fs.statSync(path.join(compiler.options.output.path, opts.blob));
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
};
