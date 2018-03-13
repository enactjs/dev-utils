const exportOnDemand = obj => {
	Object.keys(obj).forEach(name => {
		Object.defineProperty(module.exports, name, {
			configurable: false,
			enumerable: true,
			get: obj[name]
		});
	});
};

// Export the general mixins and dev utilities.
exportOnDemand({
	mixins: () => require('./mixins'),
	configHelper: () => require('./config-helper'),
	packageRoot: () => require('./package-root'),
	optionParser: () => require('./option-parser')
});

// Export the Webpack plugins.
exportOnDemand({
	EnactFrameworkPlugin: () => require('./plugins/dll/EnactFrameworkPlugin'),
	EnactFrameworkRefPlugin: () => require('./plugins/dll/EnactFrameworkRefPlugin'),
	EnzymeAdapterPlugin: () => require('./plugins/EnzymeAdapterPlugin'),
	GracefulFsPlugin: () => require('./plugins/GracefulFsPlugin'),
	ILibPlugin: () => require('./plugins/ILibPlugin'),
	PrerenderPlugin: () => require('./plugins/PrerenderPlugin'),
	SnapshotPlugin: () => require('./plugins/SnapshotPlugin'),
	WebOSMetaPlugin: () => require('./plugins/WebOSMetaPlugin')
});
