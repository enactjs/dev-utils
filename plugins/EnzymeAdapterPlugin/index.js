const {DefinePlugin} = require('webpack');

function EnzymeAdapterPlugin(options) {
	this.options = options || {};
	this.options.enzyme = this.options.enzyme || 'enzyme';
	this.options.adapter = this.options.adapter || 'enzyme-adapter-react-16';
}

EnzymeAdapterPlugin.prototype.apply = function(compiler) {
	const opts = this.options;
	const proxyJS = require.resolve('./enzyme-proxy');

	// Inject enzyme and adapter module filepath constants
	compiler.apply(
		new DefinePlugin({
			ENZYME_MODULE_REQUEST: JSON.stringify(opts.enzyme),
			ENZYME_ADAPTER_REQUEST: JSON.stringify(opts.adapter)
		})
	);

	// Redirect external 'enzyme' import/require statements to the enzyme proxy
	compiler.plugin('normal-module-factory', factory => {
		factory.plugin('before-resolve', (result, callback) => {
			if (!result) return callback();
			if (
				result.request === 'enzyme' &&
				result.contextInfo.issuer !== proxyJS &&
				!result.contextInfo.issuer.includes('enzyme')
			) {
				result.request = proxyJS;
			}
			return callback(null, result);
		});
	});
};

module.exports = EnzymeAdapterPlugin;
