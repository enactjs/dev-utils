module.exports = {
	applyPostBuild: require('./post-build').applyPostBuild,
	applyPrerender: require('./prerender').applyPrerender,
	applyFramework: require('./framework').applyFramework,
	applySnapshot: require('./snapshot').applySnapshot
};
