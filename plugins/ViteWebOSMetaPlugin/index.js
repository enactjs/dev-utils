/* eslint-env node, es6 */
/**
 * ViteWebOSMetaPlugin
 *
 * Vite counterpart to the webpack `WebOSMetaPlugin`. Discovers the root
 * `appinfo.json` (in the project root or `./webos-meta/`) plus any localized
 * `resources/**\/appinfo.json`, and makes them — together with the image assets
 * they reference (icons, splash, etc.) — available in the output:
 *   - build → written/copied into the output on `writeBundle`.
 *   - dev   → served from computed content / on-disk source via middleware.
 *
 * The document `<title>` fallback (use appinfo.title when no app title is set) is
 * handled in `vite.config.js` where `ViteHtmlPlugin` gets its title, since that
 * plugin owns the HTML document.
 *
 * `$`-prefixed system assets (sys-assets/<spec>/…) are not yet handled.
 *
 * Options: {context, path (explicit appinfo dir), publicPath}
 */
const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');
// appinfo helpers shared with WebOSMetaPlugin (webpack) — dependency-free.
const {props: ASSET_PROPS, readAppInfo, rootAppInfo} = require('../WebOSMetaPlugin/appinfo');

const MIME = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.json': 'application/json'
};

function joinUrl(...parts) {
	return parts
		.filter(p => p != null && p !== '')
		.join('/')
		.replace(/([^:])\/{2,}/g, '$1/')
		.replace(/^\/{2,}/, '/');
}

// Read the appinfo title (root) for use as an HTML <title> fallback.
ViteWebOSMetaPlugin.readTitle = function (context, specific) {
	const meta = rootAppInfo(context, specific);
	return meta && meta.obj && meta.obj.title;
};

function ViteWebOSMetaPlugin(options = {}) {
	const context = options.context || process.cwd();
	const scan = options.path;
	const publicPath = options.publicPath || '/';

	// Output entries: {name: output-relative path, src?: source file, source?: string content}.
	const outputs = [];

	function addAssets(metaDir, outDir, appinfo) {
		for (const prop of ASSET_PROPS) {
			const val = appinfo[prop];
			if (val && val.charAt(0) !== '$') {
				const src = path.resolve(metaDir, val);
				if (fs.existsSync(src)) {
					outputs.push({name: joinUrl(outDir, val), src});
				}
			}
		}
	}

	// Root appinfo + its assets.
	const meta = rootAppInfo(context, scan);
	if (meta && meta.obj) {
		addAssets(meta.path, '', meta.obj);
		outputs.push({name: 'appinfo.json', source: JSON.stringify(meta.obj, null, '\t')});
	}

	// Localized appinfo files under resources/ + their assets.
	const localized = glob.sync('resources/**/appinfo.json', {cwd: context, onlyFiles: true});
	for (const rel of localized) {
		const file = path.join(context, rel);
		const locMeta = readAppInfo(file);
		if (locMeta) {
			addAssets(path.dirname(file), path.dirname(rel), locMeta);
			outputs.push({name: rel.replace(/\\/g, '/'), source: JSON.stringify(locMeta, null, '\t')});
		}
	}

	let resolvedBase = publicPath;

	return {
		name: 'enact-vite-webosmeta',
		configResolved(resolved) {
			resolvedBase = resolved.base || publicPath;
		},
		// Build: write appinfo.json(s) and copy their referenced assets into the output.
		writeBundle(outputOptions) {
			const outDir = outputOptions.dir || (outputOptions.file && path.dirname(outputOptions.file));
			if (!outDir) return;
			for (const o of outputs) {
				const dest = path.join(outDir, o.name);
				try {
					fs.mkdirSync(path.dirname(dest), {recursive: true});
					if (o.src) fs.copyFileSync(o.src, dest);
					else fs.writeFileSync(dest, o.source);
				} catch (e) {
					this.warn(`ViteWebOSMetaPlugin: failed to emit ${o.name}: ${e.message}`);
				}
			}
		},
		// Dev: serve the appinfo files and assets from computed content / source.
		configureServer(server) {
			const routes = new Map();
			for (const o of outputs) routes.set(joinUrl(resolvedBase, o.name), o);
			server.middlewares.use((req, res, next) => {
				const url = decodeURIComponent((req.url || '').split('?')[0]);
				const o = routes.get(url);
				if (!o) return next();
				res.statusCode = 200;
				res.setHeader('Content-Type', MIME[path.extname(o.name).toLowerCase()] || 'application/octet-stream');
				if (o.src) fs.createReadStream(o.src).pipe(res);
				else res.end(o.source);
			});
		}
	};
}

module.exports = ViteWebOSMetaPlugin;
