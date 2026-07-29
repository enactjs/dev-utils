/* eslint-env node, es6 */
/**
 * EsbuildILibPlugin
 *
 * esbuild counterpart to the webpack `ILibPlugin` (and sibling of
 * `ViteILibPlugin`). `@enact/i18n`'s runtime loader (`Loader.js`) is
 * bundler-agnostic: it reads a set of `ILIB_*` global constants for the base
 * URLs of iLib locale data / app `resources` / theme bundles, then fetches the
 * JSON over HTTP. So this plugin only needs to:
 *
 *   1. Compute those `ILIB_*` constants (identical values to the webpack
 *      ILibPlugin / ViteILibPlugin), returned as a `define` map the esbuild
 *      config merges into its `define` (so they reach both the app bundle and,
 *      because esbuild transforms every module, its dependencies).
 *   2. Make the referenced data available at those URLs by copying the source
 *      trees into the build `outdir` on `onEnd`. esbuild's dev server
 *      (`enact serve --esbuild`) serves straight from `outdir`, so the same copy
 *      covers both build and serve — no separate dev middleware is needed
 *      (unlike Vite, whose dev server serves from source).
 *
 * Locale filtering (webpack's `enact pack -l …`) is supported via the `locales`
 * option: when set, the iLib/resource `ilibmanifest.json` file lists are trimmed
 * to the requested locales (plus shared, non-locale data), and a trimmed
 * manifest is emitted in place of the full one. Without it, the full trees are
 * copied (matching an unfiltered webpack build).
 *
 * iLib's non-browser platform loaders are neutralized separately in
 * `@enact/cli`'s `esbuild.config.js` (the `enact-node-builtin-stubs` plugin).
 *
 * Options: {context, publicPath, ilib, resources, symlinks, emit, locales,
 *           ilibAdditionalResourcesPath, cacheId}
 *
 * Returns {define, plugin} — `define` is the `ILIB_*` constant map, `plugin` is
 * the esbuild plugin that emits the data.
 */
const path = require('path');
const fs = require('fs');
const app = require('../../option-parser');
// Shared with PrerenderPlugin (webpack `--isomorphic`) — dependency-free locale
// resolution.
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

module.exports = function EsbuildILibPlugin(options = {}) {
	const opts = Object.assign({}, options);
	const context = opts.context || process.cwd();
	const symlinks = opts.symlinks !== false;
	const publicPath = opts.publicPath || '/';
	const emit = opts.emit !== false;

	// Locale filtering (webpack `-l`). Null = no filtering (emit everything).
	const locales = opts.locales ? parseLocales(context, opts.locales) : null;
	const allowedLocales = locales ? locales.map(l => l.replace(/-/g, '/')) : null;

	// Keep a manifest file if it's shared (non-locale) data, or its locale
	// directory lies on the lineage of a requested locale. A locale directory has
	// a 2-3 char lowercase language code as its first segment; the few 3-char iLib
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

	// Resolve the iLib base package (with @enact/i18n/ilib backward-compat),
	// matching ILibPlugin.
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

	// The iLib tree is ~70 MB / 6,700 small JSON files and is effectively
	// immutable between runs, so copying it dominates the build tail if done
	// naively. Two defenses, mirroring ViteILibPlugin: files whose destination
	// is already current (same size, not older) are skipped — a stat pair per
	// file is orders of magnitude cheaper than a copy — and the copies that ARE
	// needed run async with a concurrency pool (fs.promises.copyFile fans out
	// over libuv's threadpool) instead of a synchronous single-threaded walk.
	const listPairs = (srcDir, dest, files) => {
		const pairs = [];
		if (files) {
			for (const f of files) pairs.push([path.join(srcDir, f), path.join(dest, f)]);
		} else {
			const stack = [[srcDir, dest]];
			while (stack.length) {
				const [s, d] = stack.pop();
				let entries;
				try {
					entries = fs.readdirSync(s, {withFileTypes: true});
				} catch (e) {
					continue;
				}
				for (const entry of entries) {
					const sp = path.join(s, entry.name);
					const dp = path.join(d, entry.name);
					if (entry.isDirectory()) stack.push([sp, dp]);
					else pairs.push([sp, dp]);
				}
			}
		}
		return pairs;
	};

	const copyOne = async ([src, dst]) => {
		let s;
		try {
			s = await fs.promises.stat(src);
		} catch (e) {
			return; // missing source (manifest drift) — skip
		}
		try {
			const d = await fs.promises.stat(dst);
			if (d.size === s.size && d.mtimeMs >= s.mtimeMs) return; // already current
		} catch (e) {
			// missing destination — copy below
		}
		await fs.promises.mkdir(path.dirname(dst), {recursive: true});
		await fs.promises.copyFile(src, dst);
	};

	// Copy the collected iLib/resource data into the output — the filtered file
	// set (with a trimmed manifest) when locale filtering is active, otherwise
	// the whole tree.
	async function copyAssets(outdir) {
		for (const {urlDir, srcDir, files} of assets) {
			const dest = path.join(outdir, urlDir);
			try {
				const pairs = listPairs(srcDir, dest, files);
				const POOL = 32;
				let next = 0;
				const worker = async () => {
					while (next < pairs.length) await copyOne(pairs[next++]);
				};
				await Promise.all(Array.from({length: Math.min(POOL, pairs.length)}, worker));
				if (files) {
					await fs.promises.mkdir(dest, {recursive: true});
					await fs.promises.writeFile(
						path.join(dest, 'ilibmanifest.json'),
						JSON.stringify({files}, null, '\t')
					);
				}
			} catch (e) {
				// eslint-disable-next-line no-console
				console.warn(`EsbuildILibPlugin: failed to copy iLib data ${srcDir} -> ${dest}: ${e.message}`);
			}
		}
	}

	return {
		define: defined,
		plugin: {
			name: 'enact-esbuild-ilib',
			setup(build) {
				if (!emit || !assets.length) return;
				// esbuild's dev server reruns onEnd on every request; the data
				// doesn't change between rebuilds, so copy it once per process.
				let copied = false;
				// Async and awaited: esbuild waits for onEnd promises, so the build
				// (and `pack`'s process exit) can't outrun the copy pool.
				build.onEnd(async () => {
					if (copied) return;
					copied = true;
					const outdir =
						build.initialOptions.outdir ||
						(build.initialOptions.outfile && path.dirname(build.initialOptions.outfile)) ||
						opts.outdir ||
						path.resolve(context, 'dist');
					await copyAssets(outdir);
				});
			}
		}
	};
};
