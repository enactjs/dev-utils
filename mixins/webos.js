const
	app = require('../option-parser'),
	helper = require('../config-helper');

module.exports = {
	apply: function(config) {
		// Set browser to webOS equivalent in Chrome: 53.
		app.browsers = ['Chrome 53'];

		// Update babel-loader cache identifier.
		const babel = helper.getLoaderByName(config, 'babel');
		if(babel && babel.options.cacheDirectory) {
			try {
				const idObject = JSON.parse(babel.options.cacheIdentifier);
				idObject.browsers = app.browsers;
				babel.options.cacheIdentifier = JSON.stringify(idObject);
			} catch(e) {
				babel.options.cacheIdentifier = (babel.options.cacheIdentifier || '')
						+ JSON.stringify({
							browsers: app.browsers,
							node: app.node,
							env: process.env.BABEL_ENV || process.env.NODE_ENV || 'development'
						});
			}
		}
	}
};
