# ILibPlugin

A webpack plugin designed to support iLib configuration and asset copying.

### Installation

```
npm install --save-dev ilib-webpack-plugin
```

### Usage

In your `webpack.config.js`:

```js
plugins: [
  new ILibPlugin();
],
```

### Configuration
You can pass optional configuration settings to `ILibPlugin`.
Allowed values are as follows:

- `ilib`: Custom path to the iLib codebase. Alternatively, a `ILIB_BASE_PATH` environment variable can be set to specify a path. When set, the `emit` option will be set to `false`. Defaults to `node_modules/@enact/i18n/ilib`.
- `resources`: Custom path to the app-level resource bundle. Defaults to `resources`.  Can be set to `false` to disable detection/handling of app-level resources.
- `bundles`: Any additional resource bundles to copy to the output directory. Defaults to `[]`.
- `create`: Whether or not to dynamically generate any `ilibmanifest.json` files, if a bundle is missing it. Defaults to `true`.
- `emit`: Whether or not to emit the stock iLib locale assets to the output directory. Defaults to `true`.
- `cache`: Whether or not to cache locale/resource assets and copy emit them if they're newer/changed from source files. Defaults to `true`.


Here's an example webpack config illustrating how to use these options:
```javascript
{
	entry: 'index.js',
	output: {
		path: 'dist',
		filename: 'index_bundle.js'
	},
	plugins: [
		new ILibPlugin({
			ilib: '/usr/share/javascript/ilib',
			cache: false
		})
	]
}
```

### Copyright and License Information

Unless otherwise specified, all content, including all source code files and
documentation files in this repository are:

Copyright (c) 2016-2017 LG Electronics

Unless otherwise specified or set forth in the NOTICE file, all content,
including all source code files and documentation files in this repository are:
Licensed under the Apache License, Version 2.0 (the "License");
you may not use this content except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
