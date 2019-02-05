// CSS file extension regex
const css = /\.css$/;
// External CSS request is a non-relative CSS file with no additonal loaders used
const externalCSSRequest = req => !req.startsWith('.') && !req.includes('!') && css.test(req);

class CSSLessFallbackPlugin {
	apply(compiler) {
		compiler.hooks.normalModuleFactory.tap('CSSLessFallbackPlugin', factory => {
			factory.hooks.beforeResolve.tapAsync('CSSLessFallbackPlugin', (result, callback) => {
				if (result && result.request && externalCSSRequest(result.request)) {
					const resolver = factory.getResolver('normal', result.resolveOptions);
					resolver.resolve(result.contextInfo, result.context, result.request, {}, err => {
						if (err) {
							result.request = result.request.replace(css, '.less');
						}
						callback(undefined, result);
					});
				} else {
					callback(undefined, result);
				}
			});
		});
	}
}

module.exports = CSSLessFallbackPlugin;
