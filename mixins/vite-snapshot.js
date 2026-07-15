/* eslint-env node, es6 */
/**
 * vite-snapshot.js
 *
 * Vite/Rollup counterpart to the webpack `SnapshotPlugin` + isomorphic snapshot
 * specialization. `--snapshot` implies `--isomorphic`; on top of the isomorphic
 * client build it produces a **self-contained UMD** `main.js` that:
 *   - runs in a bare V8 (what `mksnapshot` executes) — single file, no external
 *     `import`/`require`, `global` shimmed, attaches the app to `global.App`;
 *   - prepends the (bundler-agnostic) snapshot helpers so `react-dom/client` is
 *     initialized against a mock window and `global.updateEnvironment` is defined;
 *   - substitutes `react-dom/client` → snapshot-helper (and `react-redux` →
 *     snapshot-redux-helper), except when imported by the helper itself.
 *
 * The heap that `mksnapshot` captures (after this bundle's top-level eval) becomes
 * `snapshot_blob.bin`; on-device the `templates.js` startup script sees the
 * preloaded `App`/`ReactDOMClient` globals and hydrates. The snapshot helpers,
 * `mock-window`, and `@enact/core/snapshot` deferral are reused as-is from the
 * webpack `SnapshotPlugin` — they are plain CJS with no webpack coupling.
 *
 * Rollup notes (why the helpers are staged under node_modules):
 *   - The helpers are CommonJS but live outside the app's node_modules, so Vite
 *     would treat them as ESM source and leave their `require()` intact. We copy
 *     them into `<app>/node_modules/.cache/enact-vite/snapshot/` so Vite's default
 *     commonjs transform (which covers node_modules) rewrites their requires.
 *   - `strictRequires` is scoped to those staged files so their requires stay
 *     function-scoped/lazy — critical because `require('react-dom/client')` must
 *     run *after* `mockWindow.activate()` (a hoisted top-level import would load
 *     react-dom against the absent real window), and `updateEnvironment()`'s
 *     requires must run on-device, not at snapshot time.
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const SRC_DIR = path.join(__dirname, '..', 'plugins', 'SnapshotPlugin');
const HELPER_FILES = ['snapshot-mock.js', 'snapshot-helper-esm.js', 'mock-window.js'];

// Optional deps the snapshot helper facade references; any that don't resolve in
// the app (absent package, or a missing subpath — e.g. `fbjs` is gone in React 19,
// a theme may lack `internal/$L`) fall back to a harmless no-op so the helper's
// calls (clearResBundle, updateLocale, …) do nothing — matching "library not used".
const OPTIONAL_LIBS = ['@enact/i18n', '@enact/moonstone', '@enact/sandstone', '@enact/limestone', 'ilib', 'react-redux', 'fbjs'];

// Prelude injected at the ABSOLUTE top of main.js (before esbuild's helper block,
// which captures `__getOwnPropDescs = Object.getOwnPropertyDescriptors` etc. up front).
// The mksnapshot V8 is OLD (chromium 53): no `globalThis` (ES2020) and no window /
// HTML head-shim, so resolve the real global object via `Function('return this')()`
// and expose it as `global`/`globalThis`; and polyfill `Object.getOwnPropertyDescriptors`
// (ES2017) that esbuild's object-spread helpers need but chrome 53 lacks (no WeakMap, so
// it stays snapshot-serializable — unlike core-js's internal state).
const SNAPSHOT_PRELUDE =
	'var global=typeof global!=="undefined"?global:' +
	'(typeof globalThis!=="undefined"?globalThis:(typeof self!=="undefined"?self:Function("return this")()));' +
	'if(typeof globalThis==="undefined"){try{global.globalThis=global;}catch(e){}}' +
	'if(!Object.getOwnPropertyDescriptors){Object.getOwnPropertyDescriptors=function(o){' +
	'var r={},k=Object.getOwnPropertyNames(o),s=Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(o):[],i;' +
	'for(i=0;i<k.length;i++)r[k[i]]=Object.getOwnPropertyDescriptor(o,k[i]);' +
	'for(i=0;i<s.length;i++)r[s[i]]=Object.getOwnPropertyDescriptor(o,s[i]);return r;};}\n';

// Prepend the prelude to the entry chunk in generateBundle (which runs AFTER the esbuild
// minify renderChunk pass), so it is genuinely the first code the snapshot V8 executes.
function snapshotPreludePlugin () {
	return {
		name: 'enact-snapshot-prelude',
		generateBundle (options, bundle) {
			for (const file of Object.keys(bundle)) {
				const chunk = bundle[file];
				if (chunk.type === 'chunk' && chunk.isEntry) chunk.code = SNAPSHOT_PRELUDE + chunk.code;
			}
		}
	};
}

// Copy the CJS helpers into the build cache (under node_modules so Vite transforms
// their requires) and a shared no-op module for absent optional libs.
function stageHelpers (context) {
	const dir = path.join(context, 'node_modules', '.cache', 'enact-vite', 'snapshot');
	fs.mkdirSync(dir, {recursive: true});
	for (const f of HELPER_FILES) fs.copyFileSync(path.join(SRC_DIR, f), path.join(dir, f));
	const noop = path.join(dir, 'noop-module.cjs');
	fs.writeFileSync(noop, 'module.exports = new Proxy(function(){}, {get: function(){ return function(){}; }});\n');
	return {
		dir,
		helperEsmJs: path.join(dir, 'snapshot-helper-esm.js'),
		noop
	};
}

// Write the combined snapshot entry: the ESM helper facade first (installs the
// mock window, initializes react-dom against it, defines updateEnvironment), then
// core-js, then re-export the app's default so the UMD `App` global becomes the
// app element.
function createSnapshotEntry (dir, staged, appEntry) {
	const file = path.join(dir, 'snapshot-entry.js');
	const rel = target => {
		let r = path.relative(dir, target).replace(/\\/g, '/');
		if (!r.startsWith('.')) r = './' + r;
		return r;
	};
	// core-js polyfills are included in the snapshot by default (as in the webpack path). On a
	// modern snapshot V8 (e.g. Chrome 132) the polyfills' WeakMap-based internal state
	// serializes fine. Only a VERY OLD snapshot V8 (~Chrome 53) can't serialize a WeakMap
	// with entries — mksnapshot throws "illegal access" → 0-byte blob — for BOTH webpack and
	// Vite (verified). For such old firmware, set ENACT_SNAPSHOT_NO_COREJS=1 to drop core-js
	// (the syntax stays valid via V8_SNAPSHOT_TARGET; runtime builtins go unpolyfilled).
	const body =
		`import ${JSON.stringify(rel(staged.helperEsmJs))};\n` +
		(process.env.ENACT_SNAPSHOT_NO_COREJS ? '' : `import 'core-js/stable';\n`) +
		`export {default} from ${JSON.stringify(rel(appEntry))};\n`;
	fs.writeFileSync(file, body);
	return file;
}

// Rollup plugin: redirect app imports of `react-dom/client` to the ESM helper
// facade (except the facade's own import, which must reach the real module), and
// resolve absent optional libs to the shared no-op module.
function snapshotResolvePlugin (staged) {
	const norm = id => id && id.replace(/\\/g, '/');
	const FACADE = norm(staged.helperEsmJs);
	const inSnapshotDir = id => norm(id) && norm(id).indexOf('/enact-vite/snapshot/') !== -1;
	return {
		name: 'enact-snapshot-resolve',
		enforce: 'pre',
		async resolveId (source, importer) {
			// App imports of react-dom/client → the ESM helper facade (but the facade's
			// own import must reach the real module).
			if (source === 'react-dom/client' && norm(importer) !== FACADE) return staged.helperEsmJs;
			// The staged helper's optional Enact/i18n deps: resolve if available, else no-op.
			if (inSnapshotDir(importer) && OPTIONAL_LIBS.some(l => source === l || source.startsWith(l + '/'))) {
				const resolved = await this.resolve(source, importer, {skipSelf: true});
				return resolved || staged.noop;
			}
			return null;
		}
	};
}

// Mutate an isomorphic client config into the self-contained UMD snapshot build.
function applySnapshotBuild (config, {context, appEntry}) {
	const staged = stageHelpers(context);
	const snapshotEntry = createSnapshotEntry(staged.dir, staged, appEntry);
	config.build = config.build || {};
	config.build.cssCodeSplit = false;
	// The snapshot must parse in the target board's V8. By default the app's browserslist
	// drives the output (matches the firmware for a modern webOS, e.g. Chrome 132). Only for
	// a much OLDER firmware than the app targets does the bundler-generated wrapper/helper
	// code need extra lowering — set V8_SNAPSHOT_TARGET (e.g. "chrome53") to force esbuild to
	// lower the whole output (app code is already lowered by babel-preset-enact; this also
	// catches Rollup/esbuild's helpers + the minifier output).
	if (process.env.V8_SNAPSHOT_TARGET) config.build.target = process.env.V8_SNAPSHOT_TARGET;
	config.build.rollupOptions = config.build.rollupOptions || {};
	config.build.rollupOptions.input = {main: snapshotEntry};
	// UMD so the app's default export is exposed as the `App` global — what mksnapshot
	// captures and the startup script reads on-device (mirrors the webpack isomorphic
	// `output.library='App'`/`libraryTarget='umd'`). `preserveEntrySignatures:'strict'`
	// keeps that export (an app build otherwise drops entry signatures → export-less
	// IIFE). `inlineDynamicImports` yields the single self-contained file mksnapshot
	// runs; the banner shims `global` for the bare-V8 context. ViteHtmlPlugin is kept so
	// index.html is still emitted for the isomorphic assembly.
	config.build.rollupOptions.preserveEntrySignatures = 'strict';
	config.build.rollupOptions.output = Object.assign({}, config.build.rollupOptions.output, {
		format: 'umd',
		name: 'App',
		entryFileNames: 'main.js',
		inlineDynamicImports: true
	});
	config.plugins = config.plugins || [];
	config.plugins.unshift(snapshotResolvePlugin(staged));
	config.plugins.push(snapshotPreludePlugin());
	return config;
}

// Spawn the V8 `mksnapshot` toolchain against the emitted bundle, producing the
// startup blob. Returns {ok, blob, error}. No-op (ok:false) when V8_MKSNAPSHOT is unset.
function runMkSnapshot ({outDir, target = 'main.js', exec = process.env.V8_MKSNAPSHOT}) {
	const args = process.env.V8_SNAPSHOT_ARGS
		? process.env.V8_SNAPSHOT_ARGS.split(/\s+/)
		: ['--profile-deserialization', '--random-seed=314159265', '--abort_on_uncaught_exception', '--startup-blob=snapshot_blob.bin'];
	const blobArg = args.find(a => a.startsWith('--startup-blob='));
	const blob = blobArg ? blobArg.replace('--startup-blob=', '') : 'snapshot_blob.bin';
	if (!exec) return {ok: false, blob, error: new Error('V8_MKSNAPSHOT is not set')};
	const child = cp.spawnSync(exec, args.concat(target), {cwd: outDir, encoding: 'utf8'});
	if (child.status !== 0) return {ok: false, blob, error: new Error(child.stdout + '\n' + child.stderr)};
	try {
		if (fs.statSync(path.join(outDir, blob)).size > 0) return {ok: true, blob};
	} catch (e) { /* fall through */ }
	return {ok: false, blob, error: new Error(child.stdout + '\n' + child.stderr)};
}

// Record the blob in the root appinfo.json so webOS loads the snapshot at launch.
function writeSnapshotAppinfo ({outDir, blob = 'snapshot_blob.bin'}) {
	const p = path.join(outDir, 'appinfo.json');
	if (!fs.existsSync(p)) return;
	const meta = JSON.parse(fs.readFileSync(p, 'utf8'));
	meta.v8SnapshotFile = blob;
	fs.writeFileSync(p, JSON.stringify(meta, null, '\t'));
}

module.exports = {applySnapshotBuild, runMkSnapshot, writeSnapshotAppinfo};
