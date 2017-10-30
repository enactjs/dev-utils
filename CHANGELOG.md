## 0.3.0 (Oct. 30, 2017)

* Added support for targetted builds using the `BROWSERSLIST` browser [standard format](https://github.com/ai/browserslist).
* Added `core-js` polyfill support to vdom rendering to allow for modern APIs.
* Fixed loader detection from loader filepaths.
* Changed default scope of browser support to ignore IE and IE Mobile.
* Changed to generalized `package.json` requirements for greater flexibility and sharing or dependencies between packages.

## 0.2.0 (Oct. 5, 2017)

* Added an `option-parser` module to parse and store the Enact build options from the `package.json` and to handle intertwined values and fallbacks to do with `fontGenerator`, `screenTypes`, `ri`, `theme`, `target`, etc.
* Added support for a CommonJS font generator to generate localized font CSS (deprecating the previous global prerender hook).
* Added support for dynamic replacement of main entrypoint to `config-helper`.
* Updated `package-toot` to now throw an error when no root is found.
* Updated dependencies.

## 0.1.0 (Sept. 28, 2017)

* Initial code migration from `enact-dev`
