# Webpack Config Mixins

> Mixins that can apply advanced webpack settings quickly and simply.

A collection of mixin function which can manipulate existing webpack configuration to support a variety of features such as isomorphic builds and framework builds.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {mixins} = require('@enact/dev-utils');
const myConfig = {
	// ...
};
mixins.apply(config, { /* opts */ });
```

### Options
You can pass options to the mixin's `apply` function after the webpack config argument.
Allowed optional properties are as follows:

- `isomorphic`: Whether or not to build in isomorphic code layout (including prerendering).
- `locales`: Locales to prerender when using `isomorphic` mixin.
- `snapshot`: Whether or not to build with v8 snapshot support. Snapshot functionality is an extension of isomorphic code layout and will automatically enable the `isomorphic` mixin when used.
- `framework`: When `true`, builds the Enact and React dependencies into a standalone framework bundle, rather than building the app.
- `externals`: Path to an external framework bundle, if used.
- `externalsPublic`: Public path for an external framework bundle at runtime, if different from `externals`.
- `minify`: When explicitly set as `false`, any production uglified code will be unmangled.
- `stats`: Whether or not to generate a bundle analysis of the output dependency tree.
