# EnactFrameworkPlugin

> Builds the Enact framework into a standalone library bundle.

Recommended for usage via the [`framework`](../../mixins/README.md) mixin rather than directly. See the   If used directly, it will map modules to string reprentations of the import-paths, in a DLL-like format. See the [frameworks mixin](https://github.com/enactjs/dev-utils/blob/master/mixins/framework.js) to see an example of webpack config settings that go along with the plugin in an optimal manner.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In a framework-specific `webpack.config.js`:

```js
const {EnactFrameworkPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new EnactFrameworkPlugin(),
    ],
```


# EnactFrameworkRefPlugin

> Builds an app able to use an external Enact framework library bundle.

Recommended for usage via the [`externals`](../../mixins/README.md) mixin rather than directly. See the   If used directly, it will use an external library bundle for Enact/React modules. See the [externals mixin](https://github.com/enactjs/dev-utils/blob/master/mixins/externals.js) to see an example of webpack config settings that go along with the plugin in an optimal manner.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {EnactFrameworkRefPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new EnactFrameworkRefPlugin();
    ],
```

### Configuration
You can pass configuration settings to `EnactFrameworkRefPlugin`.
Allowed values are as follows:

- `name`: Global-exposed name of enact library bundle. Defaults to `'enact_framework'`.
- `libraries`: Packages or package scopes to reference from the external library bundle. Defaults to `['@enact', 'react', 'react-dom']`.
- `externals`: Object containing external properties. Supports
  - `publicPath`: Public path the externals will be found at during runtime.
  - `snapshot`: Whether or not the external library bundle is in v8 snapshot format.
