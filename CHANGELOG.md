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
