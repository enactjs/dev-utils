# EnzymeAdapterPlugin

> Automatically initialize Enzyme adapter as needed.

Enzyme 3.x introduced the concept of an adapter, which would need to be loaded into Enzyme for Enzyme to work correctly. However for some setups, like karma-webpack based ones, this proved difficult and inconenient. This plugin simplifies things by automically initiallizing any desired adapter on-demand when Enzyme is first imported/required.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {EnzymeAdapterPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new EnzymeAdapterPlugin();
    ],
```

### Configuration
You can pass optional configuration settings to `EnzymeAdapterPlugin`.
Allowed values are as follows:

- `enzyme`: Enzyme package (or module path). Defaults to `'emzyme'`.
- `adapter`: Adapter package (or module path) to load into Enzyme. Defaults to `'enzyme-adapter-react-16'`.

Here's an example webpack config illustrating how to use these options:
```javascript
{
	entry: 'index.js',
	output: {
		path: 'dist',
		filename: 'bundle.js'
	},
	plugins: [
		new EnzymeAdapterPlugin({
			adapter: 'enzyme-adapter-react-15'
		})
	]
}
```
