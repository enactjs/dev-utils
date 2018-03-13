# WebOSMetaPlugin

> Webpack plugin that automatically detects and copies webOS meta assets.

Autodetects `appinfo.json` files, and if found, will process any related webOS meta assets (icons, etc.), copying them over at build time.

Additionally, if [html-webpack-plugin](https://github.com/ampedandwired/html-webpack-plugin) is in use, the appinfo title value will be used in the 
generated HTML file.

Full details on valid webOS appinfo.json properties are available at https://developer.lge.com/webOSTV/develop/web-app/app-developer-guide/app-metadata/

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {WebOSMetaPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new WebOSMetaPlugin();
    ],
```

### Configuration
You can pass optional configuration settings to `WebOSMetaPlugin`.
Allowed values are as follows:

- `path`: Additional directory path to scan for appinfo.json files. By default will check for `./appinfo.json` or `meta-webos/appinfo.json` files.

Here's an example webpack config illustrating how to use these options:
```javascript
{
	entry: 'index.js',
	output: {
		path: 'dist',
		filename: 'bundle.js'
	},
	plugins: [
		new WebOSMetaPlugin({
			path: './meta-assets'
		})
	]
}
```
