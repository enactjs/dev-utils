# ILibPlugin

> A webpack plugin designed to support iLib configuration and asset copying.

This plugin is required for Webpack-based usage of `@enact/i18n`.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {ILibPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new ILibPlugin();
    ],
```

### Configuration
You can pass optional configuration settings to `ILibPlugin`.
Allowed values are as follows:

- `ilib`: Custom path to the iLib codebase. Alternatively, a `ILIB_BASE_PATH` environment variable can be set to specify a path. When passed an absoute path, the `emit` option will be set to `false`. Defaults to `node_modules/@enact/i18n/ilib`.
- `resources`: Custom path to the app-level resource bundle. Defaults to `resources`.  Can be set to `false` to disable detection/handling of app-level resources.
- `bundles`: Any additional resource bundles to copy to the output directory. Defaults to `[]`. Will automatically add the `@enact/moonstone` ResBundle if detected.
- `create`: Whether or not to dynamically generate any `ilibmanifest.json` files, if a bundle is missing it. Defaults to `true`.
- `emit`: Whether or not to emit the stock iLib locale assets to the output directory. Defaults to `true`.
- `cache`: Whether or not to cache locale/resource assets and copy emit them if they're newer/changed from source files. Defaults to `true`.


Here's an example webpack config illustrating how to use these options:
```javascript
{
	entry: 'index.js',
	output: {
		path: 'dist',
		filename: 'bundle.js'
	},
	plugins: [
		new ILibPlugin({
			ilib: '/usr/share/javascript/ilib',
			cache: false
		})
	]
}
```
