const PrerenderPlugin = require('../plugins/PrerenderPlugin');

function applyPrerender(options = {}) {
	return PrerenderPlugin.applyBunPostBuild(options);
}

module.exports = {applyPrerender, parseLocales: PrerenderPlugin.parseLocales};
