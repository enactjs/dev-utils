# ViteWebOSMetaPlugin

Vite counterpart to the webpack `WebOSMetaPlugin`. Discovers the root
`appinfo.json` (project root or `./webos-meta/`) and any localized
`resources/**/appinfo.json`, and makes them — plus the image assets they
reference (`icon`, `largeIcon`, `splashBackground`, …) — available in the output.

- **build** — writes the appinfo file(s) and copies referenced assets into the
  output on `writeBundle`.
- **dev** — serves them from computed content / on-disk source via middleware.

The `<title>` fallback (use `appinfo.title` when no app/theme title is set) is
applied in `@enact/cli`'s `vite.config.js` via the static
`ViteWebOSMetaPlugin.readTitle(context)` helper, since `ViteHtmlPlugin` owns the
HTML document.

## Usage

```js
const {ViteWebOSMetaPlugin} = require('@enact/dev-utils');

module.exports = {
	plugins: [ViteWebOSMetaPlugin({context: appContext, publicPath: '/'})]
};
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `context` | `process.cwd()` | App root. |
| `path` | — | Explicit directory to search for `appinfo.json` first. |
| `publicPath` | `'/'` | Public base URL; should match Vite `base`. |

## System assets (`$`-prefixed)

An appinfo value starting with `$` (e.g. `"icon": "$icon.png"`) is a **system
asset**: the real file lives in a variable spec directory under `sys-assets/`
(`sys-assets/HD720/icon.png`, `sys-assets/HD1080/icon.png`, …). For each spec that
has the file, the plugin emits it preserving the `sys-assets/<spec>/` layout and
**leaves the appinfo value unchanged** — the platform resolves `$` to the active
spec at runtime. `sysAssetsBasePath` in appinfo overrides the `sys-assets` base.
Matches the webpack `WebOSMetaPlugin` behavior.
