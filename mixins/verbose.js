const helper = require('../config-helper');
const VerboseLogPlugin = require('../plugins/VerboseLogPlugin');

module.exports = {
	apply: function (config) {
		const prerenderInstance = helper.getPluginByName(config, 'PrerenderPlugin');
		const snapshotPluginInstance = helper.getPluginByName(config, 'SnapshotPlugin');

		return config.plugins.push(new VerboseLogPlugin({
			prerenderPlugin: prerenderInstance && prerenderInstance.constructor,
			snapshotPlugin: snapshotPluginInstance && snapshotPluginInstance.constructor
		}));
	}
};
