const fs = require('fs');
const path = require('path');
const fastGlob = require('fast-glob');
const helper = require('../config-helper');
const packageRoot = require('../package-root');
const EnactFrameworkPlugin = require('../plugins/dll/EnactFrameworkPlugin');

module.exports = {
	apply: function (config, opts = {}) {
		const app = packageRoot();

		// Scan for any polyfills.js entry file for potential re-usage.
		const polyfillFile = helper.polyfillFile(config);

		// Form list of framework entries; Every @enact/* js file as well as react/react-dom
		config.entry = {
			enact: fastGlob
				.sync('@enact/**/*.@(js|jsx|es6)', {
					cwd: path.resolve(path.join(app.path, 'node_modules')),
					onlyFiles: true,
					ignore: [
						'**/webpack.config.js',
						'**/eslint.config.js',
						'**/karma.conf.js',
						'**/build/**/*.*',
						'**/dist/**/*.*',
						'**/@enact/dev-utils/**/*.*',
						'**/@enact/docs-utils/**/*.*',
						'**/@enact/storybook-utils/**/*.*',
						'**/@enact/ui-test-utils/**/*.*',
						'**/@enact/screenshot-test-utils/**/*.*',
						'**/ilib/localedata/**/*.*',
						path.join(config.output.path, '*'),
						'**/node_modules/**/*.*',
						'**/samples/**/*.*',
						'**/tests/**/*.*'
					],
					followSymbolicLinks: true
				})
				.concat(
					fastGlob.sync('ilib/**/*.@(js|jsx|es6)', {
						cwd: path.resolve(path.join(app.path, 'node_modules')),
						onlyFiles: true,
						ignore: [
							'!node_modules',
							'!locale',
							'**/ilib-node*.js',
							'**/AsyncNodeLoader.js',
							'**/NodeLoader.js',
							'**/RhinoLoader.js'
						],
						followSymbolicLinks: true
					})
				)
				.concat(['react', 'react-dom', 'react-dom/client', 'react-dom/server'])
		};
		if (
			app.meta.name.startsWith('@enact/') &&
			(fs.existsSync(path.join(app.path, 'MoonstoneDecorator')) ||
				fs.existsSync(path.join(app.path, 'ThemeDecorator')) ||
				app.meta.name === '@enact/i18n')
		) {
			config.entry.enact = config.entry.enact.concat(
				fastGlob
					.sync('**/*.@(js|jsx|es6)', {
						cwd: app.path,
						onlyFiles: true,
						ignore: [
							'!node_modules',
							'!samples',
							'!dist',
							'!build',
							'!resources',
							'!coverage',
							'!tests',
							'**/__tests__/**/*.{js,jsx,ts,tsx}',
							'**/?(*.)+(spec|test).[jt]s?(x)',
							'**/*-specs.{js,jsx,ts,tsx}'
						]
					})
					.map(f => './' + f)
			);
		}

		if (opts['externals-polyfill'] || opts.externalsPolyfill) {
			if (polyfillFile) {
				config.entry.enact.push(polyfillFile);
			} else {
				config.entry.enact = config.entry.enact.concat(
					fastGlob.sync('modules/**/*.@(js|jsx|es6)', {
						cwd: path.dirname(require.resolve('core-js/package.json', require.main)),
						absolute: true,
						onlyFiles: true
					})
				);
			}
		}

		// Use universal module definition to allow usage and name as 'enact_framework'
		config.output.library = 'enact_framework';
		config.output.libraryTarget = 'umd';
		config.output.globalObject = 'this';

		config.resolve.symlinks = false;

		// Modify the iLib plugin options to skip './resources' detection/generation
		const ilibPlugin = helper.getPluginByName(config, 'ILibPlugin');
		if (ilibPlugin) {
			ilibPlugin.options.create = false;
			ilibPlugin.options.resources = false;
			ilibPlugin.options.relativeResources = true;
		}

		// Remove the HTML generation plugin and webOS-meta plugin
		['HtmlWebpackPlugin', 'WebOSMetaPlugin'].forEach(plugin => helper.removePlugin(config, plugin));

		// Add the framework plugin to build in an externally accessible manner
		config.plugins.push(
			new EnactFrameworkPlugin({
				polyfill: (opts['externals-polyfill'] || opts.externalsPolyfill) && polyfillFile
			})
		);

		if (opts.snapshot) {
			const SnapshotPlugin = require('../plugins/SnapshotPlugin');

			// Include plugin to attempt generation of v8 snapshot binary if V8_MKSNAPSHOT env var is set
			config.plugins.push(
				new SnapshotPlugin({
					target: 'enact.js'
				})
			);
		}

		return config;
	}
};
