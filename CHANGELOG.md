## unreleased

* Updated `eslint` to v9 and adopted flat config.

# 7.0.0-alpha.3 (January 15, 2025)

* Updated all dependencies to the latest including React 19.

# 7.0.0-alpha.2 (December 6, 2024)

* `config-helper`: Added `replaceEntry` function to support multiple entries.
* `option-parser`: Added `entry` to support multiple entries.

# 7.0.0-alpha.1 (July 22, 2024)

* Updated the minimum version of Node to `18.18.0`.

# 6.1.0 (February 20, 2024)

* `css-module-ident`: Added own hash generate function.
* Removed eslint related modules.

# 6.0.3 (December 21, 2023)

* Updated dependencies.

# 6.0.2 (September 27, 2023)

* `VerboseLogPlugin`:
  * Fixed no detailed log outputs when using `enact pack --verbose`.
  * Added an exception handling for preventing infinite loop.
* Updated `prettier` version to `^3.0.1` and `eslint-plugin-prettier` version to `^5.0.0`.

# 6.0.1 (July 25, 2023)

* Updated `chalk` version to `^5.3.0`.
* Updated `find-cache-dir` version to `^4.0.0`.

# 6.0.0 (May 18, 2023)

* Updated all dependencies to the latest.
* Updated the minimum version of Node to `14.15.0` and dropped the support for Node 12 and 17.
* Updated `eslint-plugin-react` version to `^7.32.2`.

# 5.1.2 (April 6, 2023)

* Updated dependencies.

# 5.1.1 (February 2, 2023)

* Fixed `eslint-plugin-react` version to `7.31.11` temporarily.
* Updated dependencies.

# 5.1.0 (November 1, 2022)

* Unpinned versions of dependencies.
* `ILibPlugin`: Fixed to resolve ilib and resources paths properly when `publicPath` is given.
* `WebOSMetaPlugin`: Fixed to insert a title into the output HTML.
* `PrerenderPlugin`: Fixed wrong ilib path when `locales` option is `all`.

# 5.0.2 (September 16, 2022)

* Pinned versions of dependencies as same as 5.0.0.

# 5.0.1 (August 29, 2022)

* `PrerenderPlugin`: Updated locale preset with the latest language list.

# 5.0.0 (July 8, 2022)

* Updated dependencies.

# 5.0.0-rc.1 (June 23, 2022)

* `PrerenderPlugin`: Reverted replacement of `ReactDOMClient.hydrateRoot` instead of `ReactDOMClient.createRoot` due to issue.
* `SnapshotPlugin`: Fixed `react-redux` not updating state issue by mocking window object while snapshot building.
* `css-module-ident`: Added `sass` and `scss` file extension to `fileIdentPattern`.

# 5.0.0-alpha.3 (May 31, 2022)

* Updated the `lockfileVersion` of npm-shrinkwrap file to v2.
* `option-parser`: Added `resolveFallback` to redirect module requests when normal resolving fails.
* `externals` and `framework` mixins, `EnactFrameworkRefPlugin`:
  * Fixed moonstone package is not built as framework.
  * Fixed moonstone ui test build fail.
  * Added `react-dom/client` and `react-dom/server` to the default framework bundle.

# 5.0.0-alpha.2 (April 28, 2022)

* `PrerenderPlugin`: Fixed `hydrateRoot` related error after snapshot build.
* Removed `EnzymeAdapterPlugin`.

# 5.0.0-alpha.1 (April 11, 2022)

* Updated all dependencies, with webpack peer dependency restricted to >=5.0.0.
* Updated all webpack plugins to use WeakMap since `compilation.hooks` became frozen.
* `IlibPlugin`:
  * Added `ILIB_ADDITIONAL_RESOURCES_PATH` to defined constants if provided.
  * Added `publicPath` option to specify webpack public path.
* `PrerenderPlugin`: Added React18 support for `ReactDOMClient.hydrateRoot` instead of `ReactDOMClient.createRoot` for prerendered apps.

# 4.1.4 (February 18, 2022)

* `option-parser`: Added `additionalModulePaths` to specify paths to check when resolving modules.

# 4.1.3 (December 2, 2021)

* Added `fbjs` module to fix snapshot build failuare.

# 4.1.2 (October 12, 2021)

* `PrerenderPlugin`: Cleaned up `data-react-checksum` related code.

# 4.1.1 (April 23, 2021)

* `WebOSMetaPlugin`:
  * Fixed not inserting title into the output HTML.
  * Removed the deprecated callback and replace the latest.
* `PrerenderPlugin`: Fixed not injecting startup js when multiple locales exist.

# 4.1.0 (March 26, 2021)

* `option-parser`: Set default theme config to `sandstone`.
* `SnapshotPlugin`: Added `sandstone` support for clearing resource bundle.
* `framework` mixin: Fixed the glob patterns for test files to ignore.

# 4.0.0 (February 5, 2021)

* Updated dependencies including React 17.
* `PrerenderPlugin`: Added support for `ReactDOM.hydrate` instead of `ReactDOM.render` for prerendered apps.

# 3.1.1 (February 3, 2021)

* `PrerenderPlugin`: Fixed compatibility for supporting latest `html-webpack-plugin`.
* `framework` mixin: Adds the `@enact/docs-utils` location to ignore when scanning framework files to include in framework bundles.

# 3.1.0 (August 3, 2020)

* `externals` and `framework` mixins: ensure that `@enact/i18n` is included with a framework bundle, even when local files. This package is unique as it contains the iLib path hardcoding and should be within the framework bundle.
* `framework` mixin: set relative application resbundle (`"resources"` relative to the html location)
* `ILibPlugin`:
  * Add support for `relativeResources` boolean option, which specifies the resources will be relative to the HTML and not relative to any public path that's been set.
  * Add override support for `context` option via `ILIB_CONTEXT` environment variable.
  * Add override support for `create` option via `ILIB_ASSET_CREATE` environment variable.

# 3.0.2 (August 3, 2020)

* `EnactFrameworkRefPlugin`: Fixed to ensure locally-accessed files within ignored packages do not get delegated.

# 3.0.1 (July 31, 2020)

* `framework` mixin: Adds the full list of Jest unit test locations to ignore when scanning framework files to include in framework bundles.

# 3.0.0 (July 31, 2020)

* All dependencies updated for lastest releases.
* Added new `css-module-ident` module, which contains a debug webpack css-loader `getLocalIdent` function that produces plaintext predictable classnames.
* Added support for `config-helper` to detect any polyfill entrypoints.
* Added support for `option-parser` to handle `alias` and `publicUrl` fields.
* Switched from `node-glob`to `fast-glob` for speed improvements.
* `framework` mixin:
  * Added `externals-polyfill`/`externalsPolyfill` boolean option, which includes any detected polyfill entrypoint (or `core-js` modules) within the framework bundle.
  * Added local files to framework bundle when local project itself is an @enact framework theme..
* `externals` mixin:
  * Added `externals-polyfill`/`externalsPolyfill` boolean option, which will detect any polyfill entry and forward it to `EnactFrameworkRefPlugin`.
  * Added local scope of files to the list of libraries when applied on an @enact framework theme.
* `PrerenderPlugin`: Updated to interact with HtmlWebpackPlugin 4.x hook format.
* `EnactFrameworkPlugin`:
  * Added `polyfill` string option, which specifies a polyfill file that will be labelled as `@enact/polyfils` module in the framework bundle.
  * Updated module ID resolving to handle `core-js` modules with top-level `corejs/*` accessors.
  * Updated module ID resolving to handle locally-scoped files.
* `EnactFrameworkRefPlugin`:
  * Added `polyfill` string option, which specifies a polyfill file to delegate out as `@enact/polyfills`.
  * Updated module delegate handling to setup correct paths for locally-scoped files when they're externally used.

# 2.8.1 (September 23, 2020)

* `SnapshotPlugin`: Fixed to clear ilib cache when updating environment

# 2.8.0 (July 20, 2020)

* `WebOSMetaPlugin`: Added support for `extraLargeIcon` asset field.

# 2.7.0 (May 13, 2020)

* `ILibPlugin`: Added support for `symlinks` boolean option (defaults to `true`). Similar to Webpack's `resolve.symlinks` this controls whether the plugin will resolve symlink paths when resolving iLib bundles during asset output.

# 2.6.0 (April 3, 2020)

* `ILibPlugin`:
  * Added support for `context` option rather than always defaulting to `compiler.context`
  * Fixed context not being used when detecting/resolving bundles
  * Fixes app-level resource bundle to use resolved filepath to ensure context sensitivity.

# 2.5.1 (March 23, 2020)

* Fixed `framework` mixin erroneously including `ilib/lib/RhinoLoader.js`.

# 2.5.0 (February 25, 2020)

* Updated `option-parser` to support auto-detection of local source level theme files (screentypes.json, fontgenerator.js).
* Fixed theme repo `framework` mixin usage by ignoring all sample and test files and avoiding contamination.

# 2.4.2 (January 29, 2020)

* `EnactFrameworkPlugin`: Added support for ilib inclusion in bundles.
* `EnactFrameworkRefPlugin`: Added support for `ignore` array option for package paths to handle internally, rather than deferred to external.
* `ILibPlugin`: Removed special handling for moonstone package and added generic constant support for root-level packages.

# 2.4.1 (September 4, 2019)

* `SnapshotPlugin`:  Fixed V8 snapshotting when `ilib` external package is not found.

# 2.4.0 (August 12, 2019)

* Redesigned `option-parser` with encapsulated theme option support and environment variable overriding.
* Update `ILibPlugin` to support theme-based ResBundle resources.
* Fixed bug where undefined `ri` values would result in `Infinity` pixel values.

# 2.3.0 (July 12, 2019)

* Added support utility-wide for new `ilib` external NPM package (with backward compatibility for `@enact/i18n/ilib`).

# 2.2.2 (July 2, 2019)

* Reduce `find-cache-dir` version to `^2.0.0` to retain NodeJS 6.x compatibility for one more release.

# 2.2.1 (June 10, 2019)

* Expand default browserslist config from `last 2` stable versions of Chrome and Firefox to `last 5`.

# 2.2.0 (May 7, 2019)
* Updated all dependencies to latest releases.
* `PrerenderPlugin`:
  * Fixed React hook-based rendering, ensuring only one copy of React is loaded.
* `WebOSMetaPlugin`:
  * No longer requires HtmlWebpackPlugin to function.
  * Switch deprecated `new Buffer()` to `Buffer.from()` to avoid NodeJS deprecation notice.

# 2.1.0 (January 31, 2019)
* Added support for parsing `forceCSSModules` Enact project option.
* Fixed `framework` mixin generating correct module IDs when a symlinked Enact framework is used as the source.

## 2.0.1 (November 6, 2018)
* Fixed `EnactFrameworkRefPlugin` for Webpack 4 dll format and the latest HtmlWebpackPlugin
* Fixed dynamic setting `ILIB_BASE_PATH` for `EnactFrameworkRefPlugin`
* Fixed `EnactFrameworkRefPlugin` to only hook in to webOS appinfo events when `WebOSMetaWebpackPlugin` is used
* Removes @enact/dev-utils from the possible entrypoints that `framework` mixin builds can use
* All mixins now return the configs themselves, to support chaining

## 2.0.0 (October 4, 2018)

* Update all dependencies, with webpack peer dependency restricted to >=4.0.0
* Refactor all webpack plugins into ES6 classes
* Update all webpack plugins to use new `tappable` hook system
* For webpack plugins, use `compiler.outputPath` and `compiler.context` instead of parsed values from `compiler.options`
* Explicitly invoke `apply`on embedded plugins on the compiler
* Support `browserslist` as the primary method of browser/node targeting with webpack `target` extrapolated as determined
* Add `setEnactTargetsAsDefault`function to option-parser which can set the Enact supported browsers as the `browserslist` values to use when not user-set.
* Update config-helper to remove loader functions and add support for finding/modifying minimizer plugins.
* `isomorphic` mixin:
  * Enable mapfile output by default when building more than 1 locale
  * Inject snapshot helper file as a webpack entry
  * Set webpack config  `output.globalObject` to `this` for proper umd support
* `framework` mixin:
  * Filter out ilib localedata directory
  * Fix support for symlinks
  * Set webpack config  `output.globalObject` to `this` for proper umd support
* `unmangle` mixin:
  * Switch from UglifyJsPlugin to TerserPlugin support
  * Look for TerserPlugin as a minifier plugin rather than a regular plugin
  * Fixed beautify option support
* `EnzymeAdapterPlugin`:
  * Remove workaround Enzyme React 16 adapter since the context support has made it upstream
* `ILibPlugin`:
  * Fix to correctly copy ilib resource assets for apps under `@enact` scope (though don't create when missing).
  * Fix to route moonstone 'app' assets to a `_resources_` pseudo directory to prevent extra XHR calls during test execution.
* `PrerenderPlugin`:
  * Fixed compatibility for supporting latest `html-webpack-plugin`
* `SnapshotPlugin`:
  * Remove dynamic helper javascript entry injection (since access to config was removed in webpack 4), with it relocated to the `isomorphic` mixin
  * Add `SnapshotPlugin.helperJS` property which returns the resolve path to the helper file.

## 1.2.0 (September 24, 2018)

* Added support for `applyEnactMeta` function in `option-parser.js` to apply Enact metadata overrides.
* Added support for `imageForRecents` asset field in `WebOSMetaPlugin`.
* Fixed uglify unmangling mixin usage with latest UglifyPlugin option format.

## 1.1.2 (July 26, 2018)

* Fixed locale classes failing to be applied on a multi-locale prerender when deep-linking is used.
* Fixed font style prerendering, with added support for font overrides.

## 1.1.1 (July 16, 2018)

* Fixed `PrerenderPlugin` not correctly spacing root classnames in multilocale prerendered HTML files.

## 1.1.0 (July 6, 2018)

* Added new plugin `VerboseLogPlugin` and a corresponding `verbose` mixin. Progressively outputs detailed log informations as a build executes.
* Added support for boolean flag option `externalStartup` in the enact options in a project's `package.json`. When true, any prerender startup scripts will be external file assets rather than embedded inline javascript.
* Fixed `SnapshotPlugin` build failure with React 16.4.1.

## 1.0.4 (April 26, 2018)

* Support `@enact/core/snapshot` window hook for SnapshotPlugin's environment update helper.
* Preserve HTML comment nodes within app prerendered HTML (fixing support for React 15's empty nodes).

## 1.0.3 (April 12, 2018)

* PrerenderPlugin now disables usage of any bundled polyfills (via setting `global.skipPolyfills`), as a local `core-js` is already used on the active Node process.

## 1.0.2 (March 30, 2018)

* Fixed automatic resolution independence detection and configuration.
* Updated framework mixin to remove ReactPerf reference, which is no longer needed in React 16.

## 1.0.1 (March 26, 2018)

* SnapshotPlugin's mock window updated to catch modular event listeners added to document/window and forwarded at launch-time. Fixes React 16 support.
* SnapshotPlugin will now output a helpful stack trace on exception.

## 1.0.0 (March 13, 2018)

* Added basic documentation.
* Top-level exports are now loaded/parsed on-demand when accessed.
* Support dynamic output path with framework mixin.
* Remove unneeded `main` package detection.
* Fix root `package.json` detection on Windows platform.
* Fix iLib localedata/moonstone ResBundle detection on Windows platform.
* Ensure moonstone ResBundle is correctly included when running tests within moonstone itself.
* Improved source code formatting/validation via `eslint-plugin-import` along with `eslint-plugin-prettier`.

## 0.5.0 (January 9, 2018)

* Added a new plugin for webpack, EnzymeAdapterPlugin, which automates the Enzyme initialization of an adapter. Whenever an app imports/requires Enzyme, a small proxy will intervene and ensure the desired Enzyme adapter is configured and used. This allows easier Enzyme usage within karma-webpack, for example.
* PrerenderPlugin inline script to initialize root `fontSize` now considers window height in addition to window width.
* Deep linking support in a prerendered page will now default to empty content, inserting prerendered app HTML as needed.

## 0.4.0 (November 6, 2017)

* Unify PrerenderPlugin and LocaleHtmlPlugin into a single general-purpose plugin
* Defaults to `en-US` locale but supports all the same locale option as LocaleHtmlPlugin (json files, literal objects, presets, etc.).
* Locale preset json format updated to a more readable layout. For example:
```json
{
	"locales": [
		"en-US",
		"es-ES",
		"fr-FR",
		"ko-KR",
		"zh-Hans-CN",
	]
}
```
* Fixed webpack 3.x prerendering when using asynchronous chunks.
* Fixed screentype detection when not using an identifiable theme like moonstone.
* Fixed browserslist support when using Electron browser to auto-determine webpack should use `electron-main` environment.

## 0.3.0 (October 30, 2017)

* Added support for targetted builds using the `BROWSERSLIST` browser [standard format](https://github.com/ai/browserslist).
* Added `core-js` polyfill support to vdom rendering to allow for modern APIs.
* Fixed loader detection from loader filepaths.
* Changed default scope of browser support to ignore IE and IE Mobile.
* Changed to generalized `package.json` requirements for greater flexibility and sharing or dependencies between packages.

## 0.2.0 (October 5, 2017)

* Added an `option-parser` module to parse and store the Enact build options from the `package.json` and to handle intertwined values and fallbacks to do with `fontGenerator`, `screenTypes`, `ri`, `theme`, `target`, etc.
* Added support for a CommonJS font generator to generate localized font CSS (deprecating the previous global prerender hook).
* Added support for dynamic replacement of main entrypoint to `config-helper`.
* Updated `package-root` to now throw an error when no root is found.
* Updated dependencies.

## 0.1.0 (September 28, 2017)

* Initial code migration from `enact-dev`
