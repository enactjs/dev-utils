# PrerenderPlugin

> Prerenders a React-based application into static HTML embedded within an outputted index.html

Dynamically renders static HTML for a React-based application into a root HTML from [HtmlWebpackPlugin](https://github.com/jantimon/html-webpack-plugin).  This plugin has additional special support for Enact, with the ability to prerender multiple locales and preload locale-specific fontfaces. Integrates with optional support for [WebOSMetaPlugin](../WebOSMetaPlugin/README.md) to update the localized `appinfo.json` with the outputted localized HTML files.

Requires usage of [HtmlWebpackPlugin](https://github.com/jantimon/html-webpack-plugin) with a template containing a `<div id="root"></div>`. Content within the div will be replaced at build-time with the static HTML.

Note: must build in `umd` format in webpack, with a library name of `App` and the main chunk exporting the root application's ReactElement object.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {PrerenderPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new HtmlWebpackPlugin({template: 'template.ejs'}),
      new PrerenderPlugin();
    ],
```

### Configuration
You can pass optional configuration settings to `PrerenderPlugin`.
Allowed values are as follows:

- `chunk`: Chunk name or chunk asset filename that should be prerendered into the html. Defaults to `'main.js'`.
- `locales`: Locales to generate prerenders for. Defaults to `'en-US'`. Can be any of the following values
  - Array of locale strings.
  - Filepath to a json file containing the list of locales.
  - Comma-separated or newline-separated string of locales.
  - `'none'` string preset, disabling locale-specific rendering.
  - `'tv'` string preset, mapped to all locales that webOS TVs support (see [`locales-tv.json`](https://github.com/enactjs/dev-utils/blob/master/plugins/PrerenderPlugin/locales-tv.json)).
  - `'signage'` string preset, mapped to all locales that webOS signage devices support (see [`locales-signage.json`](https://github.com/enactjs/dev-utils/blob/master/plugins/PrerenderPlugin/locales-signage.json)).
  - `'used'` string preset, mapped to all locales detected within the project's `./resources/ilibmanifest.json`.
  - `'all'` string preset, mapped to all locales that iLib supports. Might want to avoid this one.
- `mapfile`:  When true, generates a `locale-map.json` which maps the locale list to the outputted HTML files. Can alternatively be a string custom filename to write the map JSON to. Defaults to `true`.
- `server`: Virtual DOM server to use when rendering static HTML. Defaults to `require('react-dom/server')`.
- `externals`: Local filepath to a directory containing an external enact library bundle js and css files. Only needed if using external Enact framework bundle.
- `deep`: A string or array of string conditions, that when met at runtime, should not display the prerendered HTML.
- `screenTypes`: Array of 1 or more screentype definitions to be used with prerender HTML initialization. See [here](https://github.com/enactjs/enact/blob/master/packages/moonstone/MoonstoneDecorator/screenTypes.json) for an example of the moonstone screenTypes.
- `fontGenerator`: Module path to a font stylesheet generator for prerendering fontface definitions. See [here](https://github.com/enactjs/enact/blob/master/packages/moonstone/MoonstoneDecorator/fontGenerator.js) for an example of the moonstone font generator.
- `externalStartup`:  A flag whether to externalize the startup javascript normally inlined with prerendered HTML output.

Here's an example webpack config illustrating how to use these options:
```javascript
{
	entry: {
		main: 'index.js'
	},
	output: {
		path: 'dist',
		filename: 'bundle.js'
		library: 'App',
  		libraryTarget: 'umd'
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: 'template.ejs'
		}),
		new PrerenderPlugin({
			locales: ['en-US', 'ko-KR']
		})
	]
}
```
