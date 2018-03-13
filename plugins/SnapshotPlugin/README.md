# SnapshotPlugin

> Generates V8 snapshot blobs of Webpack chunks at build time.

Thanks to javascript virtual DOM technologies, it's possible to embed whole apps within V8 snapshot blobs for fast loading within tools like Chromuim and Electron. This is a highly-specific operation and definitely isn't ideal for everybody. However it is useful in certain scenarios and this will help simplify the process. The `SnapshotPlugin` assumes usage of React (and optionally Enact), with special handling to ensure APIs load correctly.

This plugin requires you to obtain an mksnapshot binary. It is usually tied to the specific version of Chromium/Chrome or Electron that you are targetting. Pay careful attention to have matching versions.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {SnapshotPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new SnapshotPlugin();
    ],
```

### Configuration
You can pass configuration settings to `SnapshotPlugin`.
Allowed values are as follows:

- `exec`: The `mksnapshot` binary to execute. Required for usage. Can alternately be set via the `V8_MKSNAPSHOT` environment variable.
- `args`: Array of options/arguments to forward to `mksnapshot`. Can alternately be set via the `V8_SNAPSHOT_ARGS` environment variable. Defaults to
```js
[
	'--profile-deserialization',
	'--random-seed=314159265',
	'--startup-blob=snapshot_blob.bin'
]
```

Here's an example webpack config illustrating how to use these options:
```javascript
{
	entry: 'index.js',
	output: {
		path: 'dist',
		filename: 'bundle.js'
	},
	plugins: [
		new SnapshotPlugin({
			exec: './tools/mksnapshot'
		})
	]
}
```
