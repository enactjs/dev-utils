## 0.2.0 (Oct. 5, 2017)

* Added an `option-parser` module to parse and store the Enact build options from the `package.json` and to handle intertwined values and fallbacks to do with `fontGenerator`, `screenTypes`, `ri`, `theme`, `target`, etc.
* Added support for a CommonJS font generator to generate localized font CSS (deprecating the previous global prerender hook).
* Added support for dynamic replacement of main entrypoint to `config-helper`.
* Updated `package-toot` to now throw an error when no root is found.
* Updated dependencies.

## 0.1.0 (Sept. 28, 2017)

* Initial code migration from `enact-dev`
