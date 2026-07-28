# ViteHtmlPlugin

Vite counterpart to the `HtmlWebpackPlugin` wiring used by `@enact/cli`. Enact
apps have no `index.html`; this plugin synthesizes the document from the same
`.ejs` template the webpack build uses and injects the app entry as an ES module.

- **Dev server** serves the synthesized document at `/`, letting Vite inject
  its HMR client via `transformIndexHtml`.
- **Production build** emits `index.html` referencing the hashed entry chunk
  and linking its CSS, honoring the configured `base` public path.

## Usage

```js
const {ViteHtmlPlugin} = require('@enact/dev-utils');

module.exports = {
	plugins: [
		ViteHtmlPlugin({
			entry: '/abs/path/to/combined-entry.js',
			title: 'My App',
			template: '/abs/path/to/html-template.ejs'
		})
	]
};
```

## Options

| Option | Type | Description |
| --- | --- | --- |
| `entry` | `string` | Absolute path to the (combined polyfills + app) entry module. |
| `title` | `string` | Document title substituted into the template's `<%= … %>` token. |
| `template` | `string` | Absolute path to an `.ejs`/`.html` template. Falls back to a built-in default when omitted. |
