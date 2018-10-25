const path = require('path');
const DelegatedSourceDependency = require('webpack/lib/dependencies/DelegatedSourceDependency');
const DelegatedModule = require('webpack/lib/DelegatedModule');
const ExternalsPlugin = require('webpack/lib/ExternalsPlugin');

// Custom DelegateFactoryPlugin designed to redirect Enact framework require() calls
// to the external framework
class DelegatedEnactFactoryPlugin {
	constructor(options = {}) {
		this.options = options;
	}

	apply(normalModuleFactory) {
		const name = this.options.name;
		const libReg = new RegExp('^(' + this.options.libraries.join('|') + ')(?=[\\\\\\/]|$)');
		normalModuleFactory.hooks.factory.tap('DelegatedEnactFactoryPlugin', factory => {
			return function(data, callback) {
				const dependency = data.dependencies[0];
				const request = dependency.request;
				if (request && libReg.test(request)) {
					return callback(null, new DelegatedModule(name, {id: request}, 'require', request, request));
				}
				return factory(data, callback);
			};
		});
	}
}

// Form a correct filepath that can be used within the build's output directory
function normalizePath(dir, file, compiler) {
	if (path.isAbsolute(dir)) {
		return path.join(dir, file);
	} else {
		return path.relative(path.resolve(compiler.outputPath), path.join(process.cwd(), dir, file));
	}
}

// Determine if it's a NodeJS output filesystem or if it's a foreign/virtual one.
function isNodeOutputFS(compiler) {
	return (
		compiler.outputFileSystem &&
		compiler.outputFileSystem.constructor &&
		compiler.outputFileSystem.constructor.name === 'NodeOutputFileSystem'
	);
}

// Reference plugin to handle rewiring the external Enact framework requests
class EnactFrameworkRefPlugin {
	constructor(options = {}) {
		this.options = options;
		this.options.name = this.options.name || 'enact_framework';
		this.options.libraries = this.options.libraries || ['@enact', 'react', 'react-dom'];
		this.options.external = this.options.external || {};
		this.options.external.publicPath =
			this.options.publicPath || this.options.external.publicPath || this.options.external.path;

		if (!process.env.ILIB_BASE_PATH) {
			process.env.ILIB_BASE_PATH = path.join(
				this.options.external.publicPath,
				'node_modules',
				'@enact',
				'i18n',
				'ilib'
			);
		}
	}

	apply(compiler) {
		const external = this.options.external;

		// Declare enact_framework as an external dependency
		const externals = {};
		externals[this.options.name] = this.options.name;
		new ExternalsPlugin(this.options.libraryTarget || 'var', externals).apply(compiler);

		compiler.hooks.compilation.tap('EnactFrameworkRefPlugin', (compilation, {normalModuleFactory}) => {
			compilation.dependencyFactories.set(DelegatedSourceDependency, normalModuleFactory);

			compilation.hooks.htmlWebpackPluginBeforeHtmlGeneration.tap('EnactFrameworkRefPlugin', chunks => {
				chunks.assets.js.unshift({
					entryName: 'enact',
					path: normalizePath(external.publicPath, 'enact.js', compiler).replace(/\\+/g, '/')
				});
				chunks.assets.css.unshift({
					entryName: 'enact',
					path: normalizePath(external.publicPath, 'enact.css', compiler).replace(/\\+/g, '/')
				});
				return chunks;
			});

			if (external.snapshot && isNodeOutputFS(compiler) && compilation.hooks.webosMetaRootAppinfo) {
				compilation.hooks.webosMetaRootAppinfo.tap('EnactFrameworkRefPlugin', meta => {
					const relSnap = normalizePath(external.publicPath, 'snapshot_blob.bin', compiler);
					meta.v8SnapshotFile = relSnap.replace(/\\+/g, '/');
					return meta;
				});
			}
		});

		// Apply the Enact factory plugin to handle the require() delagation/rerouting
		compiler.hooks.compile.tap('EnactFrameworkRefPlugin', ({normalModuleFactory}) => {
			new DelegatedEnactFactoryPlugin({
				name: this.options.name,
				libraries: this.options.libraries
			}).apply(normalModuleFactory);
		});
	}
}

module.exports = EnactFrameworkRefPlugin;
