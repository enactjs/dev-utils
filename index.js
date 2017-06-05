module.exports = {
	mixins: require('./mixins'),
	plugins: require('./plugins'),
	configHelper: require('./utils/config-helper'),
	packageRoot: require('./utils/package-root'),
	proptypeChecker: require.resolve('./utils/proptype-checker')
};
