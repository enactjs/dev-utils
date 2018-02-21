module.exports = Object.assign(
	{
		mixins: require('./mixins'),
		configHelper: require('./config-helper'),
		packageRoot: require('./package-root')
	},
	require('./plugins')
);
