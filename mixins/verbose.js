const VerboseLogPlugin = require('../plugins/VerboseLogPlugin');

module.exports = {
	apply: function(config) {
		return config.plugins.push(new VerboseLogPlugin());
	}
};
