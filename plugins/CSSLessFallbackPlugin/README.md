# CSSLessFallbackPlugin

> Safely fallback external CSS files to LESS files

Linking in Enact or Enact-based packages may contain LESS files where we'd expect CSS files (such as when published on NPM). This plugin allow external packages to fallback CSS imports to LESS files.

### Installation

```
npm install --save-dev @enact/dev-utils
```

### Usage

In your `webpack.config.js`:

```js
const {CSSLessFallbackPlugin} = require('@enact/dev-utils');

// ...

    plugins: [
      new CSSLessFallbackPlugin();
    ],
```
