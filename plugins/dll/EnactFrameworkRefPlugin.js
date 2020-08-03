const fs = require('fs');
const path = require('path');
const DelegatedSourceDependency = require('webpack/lib/dependencies/DelegatedSourceDependency');
const DelegatedModule = require('webpack/lib/DelegatedModule');
const ExternalsPlugin = require('webpack/lib/ExternalsPlugin');
const app = require('../../option-parser');

const findParentMain = function (dir) {
	const currPkg = path.join(dir, 'package.json');
	if (fs.existsSync(currPkg)) {
		const meta = JSON.parse(fs.readFileSync(currPkg, {encoding: 'utf8'}));
		if (meta.main) return {path: dir, pointsTo: path.join(dir, meta.main).replace(/\.js/, '')};
	}
	if (dir === '/' || dir === '' || dir === '.') return null;
	return findParentMain(path.dirname(dir));
};

// Custom DelegateFactoryPlugin designed to redirect Enact framework require() calls
// to the external framework
class DelegatedEnactFactoryPlugin {
	constructor(options = {}) {
		this.options = options;
		this.options.local = this.options.libraries.includes('.');
		if (this.options.local) this.options.libraries.splice(this.options.libraries.indexOf('.'), 1);
	}

	apply(normalModuleFactory) {
		const {name, libraries, ignore, local, polyfill} = this.options;
		const libReg = new RegExp('^(' + libraries.join('|') + ')(?=[\\\\\\/]|$)');
		const ignReg =
			ignore && new RegExp('^(' + ignore.map(p => p.replace('/', '[\\\\\\/]')).join('|') + ')(?=[\\\\\\/]|$)');
		normalModuleFactory.hooks.factory.tap('DelegatedEnactFactoryPlugin', factory => {
			return function (data, callback) {
				const dependency = data.dependencies[0];
				const request = dependency.request;
				const context = dependency.originModule && dependency.originModule.context;

				if (request === polyfill) {
					const polyID = '@enact/polyfills';
					return callback(null, new DelegatedModule(name, {id: polyID}, 'require', polyID, polyID));
				} else if (local && request && context && request.startsWith('.')) {
					let resource = path.join(context, request);
					if (
						resource.startsWith(app.context) &&
						!/[\\/]tests[\\/]/.test('./' + path.relative(app.context, resource)) &&
						(!ignReg || !ignReg.test(resource.replace(/^(.*[\\/]node_modules[\\/])+/, '')))
					) {
						const parent = findParentMain(path.dirname(resource));
						if (parent.pointsTo === resource) resource = parent.path;
						const localID = resource.replace(app.context, app.name).replace(/\\/g, '/');
						return callback(null, new DelegatedModule(name, {id: localID}, 'require', localID, localID));
					}
				}
				if (request && libReg.test(request) && (!ignReg || !ignReg.test(request))) {
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
		this.options.libraries = this.options.libraries || ['@enact', 'react', 'react-dom', 'ilib'];
		this.options.ignore = this.options.ignore || [
			'@enact/dev-utils',
			'@enact/storybook-utils',
			'@enact/ui-test-utils',
			'@enact/screenshot-test-utils'
		];
		this.options.external = this.options.external || {};
		this.options.external.publicPath =
			this.options.publicPath || this.options.external.publicPath || this.options.external.path;
		if (!this.options.htmlPlugin) this.options.htmlPlugin = require('html-webpack-plugin');

		if (!process.env.ILIB_BASE_PATH) {
			// Backwards support for Enact <3
			const context = options.context || process.cwd();
			if (fs.existsSync(path.join(context, 'node_modules', '@enact', 'i18n', 'ilib'))) {
				process.env.ILIB_BASE_PATH = path.join(
					this.options.external.publicPath,
					'node_modules',
					'@enact',
					'i18n',
					'ilib'
				);
			} else {
				process.env.ILIB_BASE_PATH = path.join(this.options.external.publicPath, 'node_modules', 'ilib');
			}
		}
	}

	apply(compiler) {
		const {name, libraries, ignore, external, polyfill, htmlPlugin} = this.options;

		// Declare enact_framework as an external dependency
		const externals = {};
		externals[this.options.name] = this.options.name;
		new ExternalsPlugin(this.options.libraryTarget || 'var', externals).apply(compiler);

		compiler.hooks.compilation.tap('EnactFrameworkRefPlugin', (compilation, {normalModuleFactory}) => {
			const htmlPluginHooks = htmlPlugin.getHooks(compilation);

			compilation.dependencyFactories.set(DelegatedSourceDependency, normalModuleFactory);

			htmlPluginHooks.beforeAssetTagGeneration.tapAsync('EnactFrameworkRefPlugin', (htmlPluginData, callback) => {
				htmlPluginData.assets.js.unshift(
					normalizePath(external.publicPath, 'enact.js', compiler).replace(/\\+/g, '/')
				);
				htmlPluginData.assets.css.unshift(
					normalizePath(external.publicPath, 'enact.css', compiler).replace(/\\+/g, '/')
				);
				callback(null, htmlPluginData);
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
				name,
				libraries,
				ignore,
				polyfill
			}).apply(normalModuleFactory);
		});
	}
}

module.exports = EnactFrameworkRefPlugin;
