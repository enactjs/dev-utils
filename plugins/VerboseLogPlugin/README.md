# VerboseLogPlugin

> Long-form log output of build events during a webpack process.

Streams out detailed log information as a webpack build occurs. Includes support for recognizing prerendering and v8 snapshotting.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {VerboseLogPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new VerboseLogPlugin();
    ],
```

### Configuration
You can pass optional configuration settings to `VerboseLogPlugin`.
Allowed values are as follows:

- `stream`: Stream to output the log datainto. By default will use `process.stdout`.

Here's an example webpack config illustrating how to use these options:
```javascript
{
	entry: 'index.js',
	output: {
		path: 'dist',
		filename: 'bundle.js'
	},
	plugins: [
		new VerboseLogPlugin({
			stream: process.stdout
		})
	]
}
```
