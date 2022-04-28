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
	configHelper: () => require('./config-helper'),
	cssModuleIdent: () => require('./css-module-ident'),
	mixins: () => require('./mixins'),
	optionParser: () => require('./option-parser'),
	packageRoot: () => require('./package-root')
});

// Export the Webpack plugins.
exportOnDemand({
	EnactFrameworkPlugin: () => require('./plugins/dll/EnactFrameworkPlugin'),
	EnactFrameworkRefPlugin: () => require('./plugins/dll/EnactFrameworkRefPlugin'),
	GracefulFsPlugin: () => require('./plugins/GracefulFsPlugin'),
	ILibPlugin: () => require('./plugins/ILibPlugin'),
	PrerenderPlugin: () => require('./plugins/PrerenderPlugin'),
	SnapshotPlugin: () => require('./plugins/SnapshotPlugin'),
	VerboseLogPlugin: () => require('./plugins/VerboseLogPlugin'),
	WebOSMetaPlugin: () => require('./plugins/WebOSMetaPlugin')
});
