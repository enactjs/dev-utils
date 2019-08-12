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
