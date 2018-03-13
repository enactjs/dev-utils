# GracefulFsPlugin

> Modify Webpack to use graceful-fs to avoid common fs issues.

Webpack by default uses graceful-fs for certain filesystem functions. However in some cases, such as writing output for hundreds of iLib asset files, the output filesystem may need to be augmented to force usage of graceful-fs alternative functions.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {GracefulFsPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new GracefulFsPlugin();
    ],
```

### Configuration
You can pass optional configuration settings to `GracefulFsPlugin`. Usually only `writeFile` is needed (and is enabled by default with this plugin), but other functions are exposed as well.
Allowed values are as follows:

- `writeFile`: Use the graceful-fs `writeFile` function in the webpack Node output filesystem. Defaults to `true`.
- `mkdir`: Use the graceful-fs `mkdir` function in the webpack Node output filesystem. Defaults to `false`.
- `unlink`: Use the graceful-fs `unlink` function in the webpack Node output filesystem. Defaults to `false`.
- `rmdir`: Use the graceful-fs `rmdir` function in the webpack Node output filesystem. Defaults to `false`.


Here's an example webpack config illustrating how to use these options:
```javascript
{
	entry: 'index.js',
	output: {
		path: 'dist',
		filename: 'bundle.js'
	},
	plugins: [
		new GracefulFsPlugin({
			unlink: true,
			rmdir: true
		})
	]
}
```
