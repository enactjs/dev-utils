# ViteILibPlugin

Vite counterpart to the webpack `ILibPlugin`. `@enact/i18n`'s runtime loader is
bundler-agnostic (it fetches locale JSON over HTTP from a set of `ILIB_*` global
constants), so this plugin only needs to define those constants and make the data
available at the URLs they point to.

- **Constants** (via the `config` hook → `define`): `ILIB_BASE_PATH`,
  `ILIB_RESOURCES_PATH`, `ILIB_CACHE_ID`, `ILIB_NO_ASSETS`, per-app/per-theme
  `ILIB_<NAME>_PATH`, and optional `ILIB_ADDITIONAL_RESOURCES_PATH` — matching the
  values the webpack ILibPlugin computes.
- **Data** — build: copies the iLib `locale/`, app `resources/`, and theme
  `resources/` trees into the output on `writeBundle` (a directory copy, not 6.7k
  individual `emitFile` calls). Dev: serves them from their on-disk source via
  middleware.
- **Locale filtering** (`locales` option; webpack's `enact pack -l …`) — when set,
  the `ilibmanifest.json` file lists are trimmed to the requested locales plus
  shared (non-locale) data, and a trimmed manifest is emitted/served in place of
  the full one. Accepts a preset (`used`/`tv`/`signage`/`webos`/`all`), a `.json`
  file, or a comma/newline list; without it the full trees are used. Example:
  `-l en-US,ko-KR` trims ~70 MB → ~19 MB.

The webpack plugin's neutralization of iLib's non-browser platform loaders is
handled separately in `@enact/cli`'s `vite.config.js` (`ILIB_LOADER_RE` stub).

## Usage

```js
const {ViteILibPlugin} = require('@enact/dev-utils');

module.exports = {
	plugins: [
		ViteILibPlugin({
			context: appContext,          // app root (defaults to cwd)
			publicPath: '/',              // matches Vite `base`
			ilibAdditionalResourcesPath   // optional
		})
	]
};
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `context` | `process.cwd()` | App root; output paths are computed relative to it. |
| `ilib` | auto-detected | iLib base package path (`@enact/i18n/ilib` or `ilib`). |
| `resources` | `'resources'` | App resources directory. |
| `publicPath` | `'/'` | Public base URL; should match Vite `base`. |
| `symlinks` | `true` | Resolve symlinked packages to their real path. |
| `emit` | `true` | Copy/serve the data. When `false`, sets `ILIB_NO_ASSETS`. |
| `cacheId` | timestamp | Value for `ILIB_CACHE_ID`. |
| `ilibAdditionalResourcesPath` | — | Extra runtime resource path. |
| `locales` | — | Locale-filter target (`-l`): preset / `.json` / comma list. When set, only the matching locale data (plus shared data) is emitted/served. |
