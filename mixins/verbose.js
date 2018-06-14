const VerboseLogPlugin = require('../plugins/VerboseLogPlugin');

module.exports = {
	apply: function(config) {
		config.plugins.push(new VerboseLogPlugin());
	}
};
