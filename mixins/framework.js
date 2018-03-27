const path = require('path');
const glob = require('glob');
const helper = require('../config-helper');
const EnactFrameworkPlugin = require('../plugins/dll/EnactFrameworkPlugin');

module.exports = {
	apply: function(config, opts = {}) {
		const app = helper.appRoot();
		// Form list of framework entries; Every @enact/* js file as well as react/react-dom
		config.entry = {
			enact: glob
				.sync('@enact/**/*.@(js|jsx|es6)', {
					cwd: path.resolve(path.join(app, 'node_modules')),
					nodir: true,
					ignore: [
						'./webpack.config.js',
						'./.eslintrc.js',
						'./karma.conf.js',
						'./build/**/*.*',
						'./dist/**/*.*',
						path.join(config.output.path, '*'),
						'./node_modules/**/*.*',
						'**/tests/*.js'
					]
				})
				.concat(['react', 'react-dom'])
		};

		// Use universal module definition to allow usage and name as 'enact_framework'
		config.output.library = 'enact_framework';
		config.output.libraryTarget = 'umd';

		// Modify the iLib plugin options to skip './resources' detection/generation
		const ilibPlugin = helper.getPluginByName(config, 'ILibPlugin');
		if (ilibPlugin) {
			ilibPlugin.options.create = false;
			ilibPlugin.options.resources = false;
		}

		// Remove the HTML generation plugin and webOS-meta plugin
		['HtmlWebpackPlugin', 'WebOSMetaPlugin'].forEach(plugin => helper.removePlugin(config, plugin));

		// Add the framework plugin to build in an externally accessible manner
		config.plugins.push(new EnactFrameworkPlugin());

		if (opts.snapshot) {
			const SnapshotPlugin = require('../plugins/SnapshotPlugin');

			// Include plugin to attempt generation of v8 snapshot binary if V8_MKSNAPSHOT env var is set
			config.plugins.push(
				new SnapshotPlugin({
					target: 'enact.js'
				})
			);
		}
	}
};
