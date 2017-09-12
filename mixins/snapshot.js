const
	path = require('path'),
	fs = require('fs'),
	helper = require('../utils/config-helper'),
	pkgRoot = require('../utils/package-root'),
	SnapshotPlugin = require('../plugins/SnapshotPlugin'),
	{IgnorePlugin} = require('webpack');

// @TODO: automatically have snapshot plugin handle injecting entrypoint helper, ignore plugins, react-dom redirect
//        and potentially just combine to adding of the plugin to the isomorphic mixin.

module.exports = function(config, opts = {}) {
	const app = pkgRoot().path;

	if(!opts.framework) {
		// Update HTML webpack plugin to mark it as snapshot mode for the isomorphic template
		// @TODO: automatically have prerender plugin set this
		const htmlPlugin = helper.getPluginByName(config, 'HtmlWebpackPlugin');
		if(htmlPlugin) {
			htmlPlugin.options.snapshot = true;
		}

		// Snapshot helper API for the transition from v8 snapshot into the window
		helper.injectEntry(config, require.resolve('../utils/snapshot-helper'));
	}

	// Include plugin to attempt generation of v8 snapshot binary if V8_MKSNAPSHOT env var is set
	config.plugins.push(new SnapshotPlugin({
		target: (opts.framework ? 'enact.js' : 'main.js')
	}));

	config.resolve.alias['SNAPSHOT_REACT_DOM'] = path.resolve(path.join(app, 'node_modules', 'react-dom'));
	config.resolve.alias['react-dom'] = require.resolve('./util/snapshot-helper');

	['@enact/i18n', '@enact/moonstone'].forEach(lib => {
		if(!fs.existsSync(path.join(app, 'node_modules', lib))) {
			config.plugins.push(new IgnorePlugin(new RegExp(lib)));
		}
	});
};
