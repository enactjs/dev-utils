const {DefinePlugin} = require('webpack');

class EnzymeAdapterPlugin {
	constructor(options = {}) {
		this.options = options;
		this.options.enzyme = this.options.enzyme || 'enzyme';
		this.options.adapter = this.options.adapter || 'enzyme-adapter-react-16';
	}

	apply(compiler) {
		const proxyJS = require.resolve('./enzyme-proxy');

		// Inject enzyme and adapter module filepath constants
		new DefinePlugin({
			ENZYME_MODULE_REQUEST: JSON.stringify(this.options.enzyme),
			ENZYME_ADAPTER_REQUEST: JSON.stringify(this.options.adapter)
		}).apply(compiler);
		compiler.hooks.normalModuleFactory.tap('EnzymeAdapterPlugin', factory => {
			factory.hooks.beforeResolve.tap('EnzymeAdapterPlugin', result => {
				if (!result) return;
				if (
					result.request === 'enzyme' &&
					result.contextInfo.issuer !== proxyJS &&
					!result.contextInfo.issuer.includes('enzyme')
				) {
					result.request = proxyJS;
				}
				return result;
			});
		});
	}
}

module.exports = EnzymeAdapterPlugin;
