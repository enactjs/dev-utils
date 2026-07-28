/* eslint-env node, es6 */
/**
 * EsbuildWebOSMetaPlugin
 *
 * esbuild counterpart to the webpack `WebOSMetaPlugin` (and sibling of
 * `ViteWebOSMetaPlugin`). Discovers the root `appinfo.json` (in the project root
 * or `./webos-meta/`) plus any localized `resources/**\/appinfo.json`, and emits
 * them — together with the image assets they reference (icons, splash, etc.) —
 * into the build `outdir` on `onEnd`. esbuild's dev server serves straight from
 * `outdir`, so the same copy covers both build and serve.
 *
 * `$`-prefixed system assets (`$icon.png` → sys-assets/<spec>/icon.png) are
 * emitted preserving their `sys-assets/<spec>/` layout; the appinfo value is left
 * untouched (the platform resolves `$` to the active spec at runtime).
 *
 * The document `<title>` fallback (use appinfo.title when no app title is set) is
 * exposed via `EsbuildWebOSMetaPlugin.readTitle`, consumed by `esbuild.config.js`
 * where `EsbuildHtmlPlugin` gets its title (that plugin owns the HTML document).
 *
 * Options: {context, path (explicit appinfo dir), publicPath, outdir}
 */
const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');
// appinfo helpers shared with WebOSMetaPlugin (webpack) — dependency-free.
const {props: ASSET_PROPS, readAppInfo, rootAppInfo} = require('../WebOSMetaPlugin/appinfo');

function joinUrl(...parts) {
	return parts
		.filter(p => p != null && p !== '')
		.join('/')
		.replace(/([^:])\/{2,}/g, '$1/')
		.replace(/^\/{2,}/, '/');
}

// Read the appinfo title (root) for use as an HTML <title> fallback.
EsbuildWebOSMetaPlugin.readTitle = function (context, specific) {
	const meta = rootAppInfo(context, specific);
	return meta && meta.obj && meta.obj.title;
};

function EsbuildWebOSMetaPlugin(options = {}) {
	const context = options.context || process.cwd();
	const scan = options.path;

	// Output entries: {name: output-relative path, src?: source file, source?: string content}.
	const outputs = [];
	const seenAssets = new Set();

	function addAsset(name, src) {
		// De-dupe by output name — sys-assets are shared across locales/props.
		if (seenAssets.has(name)) return;
		seenAssets.add(name);
		outputs.push({name, src});
	}

	// System assets: appinfo values starting with '$' refer to a file within a
	// variable spec directory (`$icon.png` → sys-assets/<spec>/icon.png, where
	// <spec> is 'HD720', 'HD1080', etc.). `sysAssetsBasePath` overrides the base.
	let sysAssetsPath = 'sys-assets';
	let variableSysPaths = null;

	function loadSysAssetDirs(appinfo) {
		// Honor a per-appinfo sysAssetsBasePath override, then list the spec subdirs.
		if (appinfo.sysAssetsBasePath && appinfo.sysAssetsBasePath !== sysAssetsPath) {
			sysAssetsPath = appinfo.sysAssetsBasePath;
			variableSysPaths = null;
		}
		if (!variableSysPaths) {
			const base = path.join(context, sysAssetsPath);
			variableSysPaths = fs.existsSync(base)
				? fs
						.readdirSync(base)
						.map(name => path.join(base, name))
						.filter(p => fs.statSync(p).isDirectory())
				: [];
		}
	}

	function detectSysAssets(val) {
		// Every `<spec>/<name>` (name minus the leading '$') that exists on disk.
		const trueName = val.substring(1);
		return variableSysPaths.map(dir => path.resolve(dir, trueName)).filter(abs => fs.existsSync(abs));
	}

	function addAssets(metaDir, outDir, appinfo) {
		for (const prop of ASSET_PROPS) {
			const val = appinfo[prop];
			if (!val) continue;
			if (val.charAt(0) === '$') {
				loadSysAssetDirs(appinfo);
				for (const abs of detectSysAssets(val)) {
					// Output name relative to context → preserves the sys-assets/<spec>/ path.
					addAsset(path.relative(context, abs).replace(/\\/g, '/'), abs);
				}
			} else {
				const src = path.resolve(metaDir, val);
				if (fs.existsSync(src)) {
					addAsset(joinUrl(outDir, val), src);
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

	// Write appinfo.json(s) and copy their referenced assets into the output.
	function emitOutputs(outdir) {
		for (const o of outputs) {
			const dest = path.join(outdir, o.name);
			try {
				fs.mkdirSync(path.dirname(dest), {recursive: true});
				if (o.src) fs.copyFileSync(o.src, dest);
				else fs.writeFileSync(dest, o.source);
			} catch (e) {
				// eslint-disable-next-line no-console
				console.warn(`EsbuildWebOSMetaPlugin: failed to emit ${o.name}: ${e.message}`);
			}
		}
	}

	return {
		name: 'enact-esbuild-webosmeta',
		setup(build) {
			if (!outputs.length) return;
			// Copy once per process (esbuild's dev server reruns onEnd per request).
			let emitted = false;
			build.onEnd(() => {
				if (emitted) return;
				emitted = true;
				const outdir =
					build.initialOptions.outdir ||
					(build.initialOptions.outfile && path.dirname(build.initialOptions.outfile)) ||
					options.outdir ||
					path.resolve(context, 'dist');
				emitOutputs(outdir);
			});
		}
	};
}

module.exports = EsbuildWebOSMetaPlugin;
