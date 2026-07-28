/* eslint-env node, es6 */
/**
 * ViteILibPlugin
 *
 * Vite counterpart to the webpack `ILibPlugin`. `@enact/i18n`'s runtime loader
 * (`Loader.js`) is bundler-agnostic. It reads a set of `ILIB_*` global constants
 * for the base URLs of iLib locale data / app `resources` / theme bundles, then
 * fetches the JSON over HTTP. So this plugin only needs to:
 *
 *   1. `define` those `ILIB_*` constants (via the `config` hook), matching the
 *      values the webpack ILibPlugin computes, for the Rollup build and, via
 *      `optimizeDeps.esbuildOptions.define`, the dev-server pre-bundled deps.
 *   2. Make the referenced data available at those URLs:
 *        - build → copy the source trees into the output on `writeBundle`.
 *        - dev   → serve them from their on-disk source via middleware.
 *
 * Locale filtering (webpack's `enact pack -l …`) is supported via the `locales`
 * option: when set, the iLib/resource `ilibmanifest.json` file lists are trimmed
 * to the requested locales (plus shared, non-locale data), and a trimmed manifest
 * is emitted/served in place of the full one. Without it, the full trees are
 * copied/served (matching an unfiltered webpack build).
 *
 * The webpack plugin's neutralization of iLib's non-browser platform loaders is
 * handled separately in `@enact/cli`'s `vite.config.js` (`ILIB_LOADER_RE` stub).
 */
const path = require('path');
const fs = require('fs');
const app = require('../../option-parser');
// Shared with PrerenderPlugin (webpack `--isomorphic`) — dependency-free locale
// resolution, so reusing it here does not pull webpack into the Vite path.
const {parseLocales} = require('../PrerenderPlugin/parse-locales');
// Path/constant helpers shared with ILibPlugin (webpack) — dependency-free.
const {transformPath, bundleConst, packageSearch} = require('../ILibPlugin/ilib-paths');

// Join URL segments with single slashes, preserving a leading slash.
function joinUrl(...parts) {
	return parts
		.filter(p => p != null && p !== '')
		.join('/')
		.replace(/([^:])\/{2,}/g, '$1/')
		.replace(/^\/{2,}/, '/');
}

// True if two slash-separated locale paths lie on the same root-to-leaf lineage.
function sameLineage(a, b) {
	const as = a.split('/');
	const bs = b.split('/');
	const n = Math.min(as.length, bs.length);
	for (let i = 0; i < n; i++) {
		if (as[i] !== bs[i]) return false;
	}
	return true;
}

module.exports = function ViteILibPlugin(options = {}) {
	const opts = Object.assign({}, options);
	const context = opts.context || process.cwd();
	const symlinks = opts.symlinks !== false;
	const publicPath = opts.publicPath || '/';
	const emit = opts.emit !== false;

	// Locale filtering (webpack `-l`). Null = no filtering (emit everything).
	const locales = opts.locales ? parseLocales(context, opts.locales) : null;
	const allowedLocales = locales ? locales.map(l => l.replace(/-/g, '/')) : null;

	// Keep a manifest file if it's shared (non-locale) data, or its locale
	// directory lies on the lineage of a requested locale. A locale directory has a
	// 2-3 char lowercase language code as its first segment; the few 3-char iLib
	// data dirs that would collide (nfc/nfd) and the `und` fallback are shared.
	// Longer data dirs (zoneinfo, charmaps, charset, ctype, scripts, nfkc, nfkd)
	// are excluded by the length test.
	const SHARED_TOP = new Set(['nfc', 'nfd', 'und']);
	function fileAllowed(relFile) {
		if (!allowedLocales) return true;
		const dir = path.dirname(relFile).replace(/\\/g, '/');
		if (dir === '.' || dir === '') return true; // root files (shared)
		const first = dir.split('/')[0];
		if (SHARED_TOP.has(first) || !/^[a-z]{2,3}$/.test(first)) return true; // shared data
		return allowedLocales.some(loc => sameLineage(dir, loc));
	}

	// Resolve the iLib base package (with @enact/i18n/ilib backward-compat), matching ILibPlugin.
	const ilibRel =
		opts.ilib ||
		process.env.ILIB_BASE_PATH ||
		packageSearch(context, path.join('@enact', 'i18n', 'ilib')) ||
		packageSearch(context, 'ilib');
	const resourcesRel = opts.resources || 'resources';

	const defined = {};
	// {urlDir, srcDir, files} — files is a filtered manifest list, or null for a full copy.
	const assets = [];

	function addBundle(name, dirRel, subdir, loaderAppendsSubdir) {
		if (!dirRel) return;
		let abs = path.isAbsolute(dirRel) ? dirRel : path.join(context, dirRel);
		if (symlinks && fs.existsSync(abs)) abs = fs.realpathSync(abs);
		const rel = transformPath(context, abs);
		const srcDir = subdir ? path.join(abs, subdir) : abs;
		const urlDir = subdir ? joinUrl(rel, subdir) : rel;
		// The constant must point at the directory the runtime loader fetches from.
		// For theme/app resources that is the served data dir (urlDir). For the iLib
		// *base*, the loader appends the `locale/` subdir itself, so the constant
		// points at the package dir (rel) instead.
		const url = joinUrl(publicPath, loaderAppendsSubdir ? rel : urlDir);
		if (name) defined[name] = JSON.stringify(url);
		if (emit && fs.existsSync(srcDir)) {
			let files = null;
			if (allowedLocales) {
				const manifest = path.join(srcDir, 'ilibmanifest.json');
				if (fs.existsSync(manifest)) {
					try {
						const all = JSON.parse(fs.readFileSync(manifest, {encoding: 'utf8'})).files || [];
						files = all.filter(fileAllowed);
					} catch (e) {
						files = null;
					}
				}
			}
			assets.push({urlDir, srcDir, files});
		}
		return url;
	}

	// iLib base data lives under <ilib>/locale; ILIB_BASE_PATH points at <ilib>
	// (the loader appends `locale/` itself).
	addBundle('ILIB_BASE_PATH', ilibRel, 'locale', true);
	// App resources.
	const resourcesUrl = addBundle('ILIB_RESOURCES_PATH', resourcesRel);
	// Per-app + per-theme bundle path constants (theme resources supply locale data too).
	defined[bundleConst(app.name)] = JSON.stringify(resourcesUrl);
	let pkgDir = context;
	for (let t = app.theme; t; t = t.theme) {
		const themeDir = packageSearch(pkgDir, t.name);
		if (themeDir) {
			pkgDir = themeDir;
			addBundle(bundleConst(t.name), themeDir, 'resources');
		}
	}

	defined.ILIB_CACHE_ID = JSON.stringify(String(opts.cacheId || 'enact-ilib-' + Date.now()));
	defined.ILIB_NO_ASSETS = JSON.stringify(!emit);
	if (opts.ilibAdditionalResourcesPath) {
		defined.ILIB_ADDITIONAL_RESOURCES_PATH = JSON.stringify(opts.ilibAdditionalResourcesPath);
	}

	let resolvedBase = publicPath;

	return {
		name: 'enact-vite-ilib',
		// Inject the ILIB_* constants as build-time defines. `define` covers the
		// Rollup build and live-transformed dev modules; `optimizeDeps.esbuildOptions
		// .define` is required additionally so the constants also reach dev-server
		// pre-bundled dependencies (e.g. @enact/i18n's Loader) — Vite does not apply
		// `config.define` to the dep optimizer for arbitrary global constants.
		config() {
			return {
				define: defined,
				optimizeDeps: {esbuildOptions: {define: defined}}
			};
		},
		configResolved(resolved) {
			resolvedBase = resolved.base || publicPath;
		},
		// Build: copy the data into the output — the filtered file set (with a trimmed
		// manifest) when locale filtering is active, otherwise the whole tree.
		writeBundle(outputOptions) {
			const outDir = outputOptions.dir || (outputOptions.file && path.dirname(outputOptions.file));
			if (!outDir) return;
			for (const {urlDir, srcDir, files} of assets) {
				const dest = path.join(outDir, urlDir);
				try {
					if (files) {
						fs.mkdirSync(dest, {recursive: true});
						for (const f of files) {
							const s = path.join(srcDir, f);
							const d = path.join(dest, f);
							if (fs.existsSync(s)) {
								fs.mkdirSync(path.dirname(d), {recursive: true});
								fs.copyFileSync(s, d);
							}
						}
						fs.writeFileSync(path.join(dest, 'ilibmanifest.json'), JSON.stringify({files}, null, '\t'));
					} else {
						fs.cpSync(srcDir, dest, {recursive: true});
					}
				} catch (e) {
					this.warn(`ViteILibPlugin: failed to copy iLib data ${srcDir} -> ${dest}: ${e.message}`);
				}
			}
		},
		// Dev: serve the data from its on-disk source; when filtering, serve the
		// trimmed manifest and only allow the kept files.
		configureServer(server) {
			const routes = assets.map(({urlDir, srcDir, files}) => ({
				prefix: joinUrl(resolvedBase, urlDir).replace(/\/?$/, '/'),
				srcDir,
				allowed: files ? new Set(files.map(f => f.replace(/\\/g, '/'))) : null,
				manifest: files ? JSON.stringify({files}, null, '\t') : null
			}));
			server.middlewares.use((req, res, next) => {
				const url = decodeURIComponent((req.url || '').split('?')[0]);
				const route = routes.find(r => url.startsWith(r.prefix));
				if (!route) return next();
				const rel = url.slice(route.prefix.length);
				if (route.manifest && rel === 'ilibmanifest.json') {
					res.statusCode = 200;
					res.setHeader('Content-Type', 'application/json');
					return res.end(route.manifest);
				}
				if (route.allowed && !route.allowed.has(rel)) return next();
				const file = path.join(route.srcDir, rel);
				if (!file.startsWith(route.srcDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
					return next();
				}
				res.statusCode = 200;
				res.setHeader('Content-Type', file.endsWith('.json') ? 'application/json' : 'application/octet-stream');
				fs.createReadStream(file).pipe(res);
			});
		}
	};
};
