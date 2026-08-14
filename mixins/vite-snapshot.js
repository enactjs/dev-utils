/*
 *  vite-snapshot.js
 *
 *  V8 snapshot blob generation for `enact pack --snapshot`, shared by the
 *  Vite and esbuild paths. `runMkSnapshot`/`writeSnapshotAppinfo` are ported
 *  from plugins/SnapshotPlugin/index.js's `afterEmit`/`compilation` hook
 *  handlers into plain functions — the underlying mksnapshot invocation
 *  (spawnSync against a built JS file, same default CLI args, same
 *  0-byte-blob-on-error quirk handling) and appinfo.json patching
 *  (`v8SnapshotFile`) don't depend on webpack's compiler at all, so nothing
 *  here is bundler-specific.
 */
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const HELPER_DIR = path.join(__dirname, '..', 'plugins', 'SnapshotPlugin');
const FACADE_PATH = path.join(HELPER_DIR, 'snapshot-helper-esm.js');

// Optional deps the facade references; any that don't resolve in the app
// (absent package, or a missing subpath) fall back to a harmless no-op via
// viteSnapshotResolvePlugin below, matching esbuild-snapshot.js's identical
// OPTIONAL_LIB_RE/no-op substitution.
const OPTIONAL_LIB_RE = /^(@enact\/i18n(\/|$)|@enact\/moonstone(\/|$)|@enact\/sandstone(\/|$)|@enact\/limestone(\/|$)|ilib(\/|$)|react-redux(\/|$)|fbjs(\/|$))/;

// Bare V8 (mksnapshot's execution context) has no `globalThis` and no
// `Object.getOwnPropertyDescriptors` on some older V8 builds; this prelude
// shim is prepended to the snapshot bundle's output so both exist before any
// bundled code runs. Matches esbuild-snapshot.js's SNAPSHOT_PRELUDE exactly
// (the shim itself doesn't depend on which bundler produced the rest of the
// file).
const SNAPSHOT_PRELUDE =
	'var global=typeof global!=="undefined"?global:' +
	'(typeof globalThis!=="undefined"?globalThis:(typeof self!=="undefined"?self:Function("return this")()));' +
	'if(typeof globalThis==="undefined"){try{global.globalThis=global;}catch(e){}}' +
	'if(!Object.getOwnPropertyDescriptors){Object.getOwnPropertyDescriptors=function(o){' +
	'var r={},k=Object.getOwnPropertyNames(o),s=Object.getOwnPropertySymbols?Object.getOwnPropertySymbols(o):[],i;' +
	'for(i=0;i<k.length;i++)r[k[i]]=Object.getOwnPropertyDescriptor(o,k[i]);' +
	'for(i=0;i<s.length;i++)r[s[i]]=Object.getOwnPropertyDescriptor(o,s[i]);return r;};}\n';

function norm (p) {
	try {
		return fs.realpathSync(p).replace(/\\/g, '/');
	} catch (e) {
		return path.resolve(p).replace(/\\/g, '/');
	}
}

// Writes the throwaway snapshot entry: imports the facade (for its side
// effects — initializing react-dom/client against the mock window), then
// the app's default export, assigned directly to `globalThis.App` for the
// on-device startup script to read once the blob is restored. Matches
// esbuild-snapshot.js's createSnapshotEntry.
function createSnapshotEntry (dir, appEntry) {
	fs.mkdirSync(dir, {recursive: true});
	const file = path.join(dir, 'snapshot-entry.js');
	let corejsImport = '';
	if (!process.env.ENACT_SNAPSHOT_NO_COREJS) {
		const corejsPath = require.resolve('core-js/stable');
		corejsImport = `import ${JSON.stringify(corejsPath)};\n`;
	}
	const body =
		`import ${JSON.stringify(FACADE_PATH)};\n` +
		corejsImport +
		`import __app from ${JSON.stringify(path.resolve(appEntry))};\n` +
		'globalThis.App = __app;\n';
	fs.writeFileSync(file, body);
	return file;
}

// Redirects `react-dom/client` imports to the facade for every importer
// except the facade's own self-import (which must reach the real module),
// and substitutes a no-op module for the facade's optional Enact/i18n/
// locale/fbjs deps when they don't resolve — mirrors esbuild's
// esbuildSnapshotResolvePlugin exactly (same OPTIONAL_LIB_RE, same
// importer-scoping) rather than assuming Rollup's CJS interop leaves
// try/catch-guarded require() calls genuinely unresolved at build time,
// which isn't something to assume without the actual installed
// Rollup/@rollup/plugin-commonjs version to verify against — a browser
// target build has no live `require` to fall back on at runtime the way
// real Node does, so it likely needs everything resolved statically
// regardless of try/catch wrapping, same as esbuild.
const NOOP_MODULE_ID = '\0enact-snapshot-noop';
const NOOP_CONTENTS = 'module.exports = new Proxy(function(){}, {get: function(){ return function(){}; }});';

function viteSnapshotResolvePlugin () {
	const facade = norm(FACADE_PATH);
	return {
		name: 'enact-vite-snapshot-resolve',
		resolveId (source, importer) {
			if (source === 'react-dom/client') {
				if (importer && norm(importer) === facade) return null; // let it resolve for real
				return FACADE_PATH;
			}
			if (OPTIONAL_LIB_RE.test(source) && importer && norm(importer) === facade) {
				try {
					require.resolve(source, {paths: [HELPER_DIR]});
					return null; // resolves fine; let Vite handle it normally
				} catch (e) {
					return NOOP_MODULE_ID + ':' + source;
				}
			}
			return null;
		},
		load (id) {
			if (id.indexOf(NOOP_MODULE_ID + ':') === 0) {
				return NOOP_CONTENTS;
			}
			return null;
		}
	};
}

// Mutates a Vite InlineConfig into the self-contained IIFE snapshot build.
// `context`/`appEntry` mirror esbuild-snapshot.js's applyEsbuildSnapshotBuild
// signature.
function applySnapshotBuild (config, {context, appEntry}) {
	const entryDir = path.join(context, 'node_modules', '.cache', 'enact-vite', 'snapshot');
	const snapshotEntry = createSnapshotEntry(entryDir, appEntry);

	config.build = config.build || {};
	config.build.rollupOptions = Object.assign({}, config.build.rollupOptions, {
		input: snapshotEntry,
		output: Object.assign({}, config.build.rollupOptions && config.build.rollupOptions.output, {
			format: 'iife',
			// Self-contained single file: no chunk boundaries to worry about
			// lining up with what mksnapshot executes.
			inlineDynamicImports: true,
			banner: SNAPSHOT_PRELUDE,
			entryFileNames: 'main.js'
		})
	});
	if (process.env.V8_SNAPSHOT_TARGET) {
		config.build.target = process.env.V8_SNAPSHOT_TARGET;
	}
	config.plugins = (config.plugins || []).concat([viteSnapshotResolvePlugin()]);

	return config;
}

const DEFAULT_ARGS = [
	'--profile-deserialization',
	'--random-seed=314159265',
	'--abort_on_uncaught_exception',
	'--startup-blob=snapshot_blob.bin'
];

function getBlobName (args) {
	for (let i = 0; i < args.length; i++) {
		if (args[i].indexOf('--startup-blob=') === 0) {
			return args[i].replace('--startup-blob=', '');
		}
	}
	return 'snapshot_blob.bin';
}

// Runs the mksnapshot utility (V8_MKSNAPSHOT env var, or `exec` override)
// against `target` (default "main.js") inside `outDir`, producing a
// snapshot blob. Returns `{blob}` on success (blob is the filename, relative
// to outDir) or `{blob: null, error, command}` on failure/when no mksnapshot
// binary is configured — callers check `.blob` truthiness the same way the
// original webpack plugin checked `opts.exec` before attempting anything.
function runMkSnapshot ({outDir, exec, args, target} = {}) {
	const mkExec = exec || process.env.V8_MKSNAPSHOT;
	if (!mkExec) {
		return {blob: null, skipped: true, reason: 'V8_MKSNAPSHOT is not set; skipping snapshot blob generation.'};
	}

	let mkArgs = args || DEFAULT_ARGS.slice();
	if (process.env.V8_SNAPSHOT_ARGS) {
		mkArgs = process.env.V8_SNAPSHOT_ARGS.split(/\s+/);
	}
	mkArgs = mkArgs.concat([target || 'main.js']);

	const blob = getBlobName(mkArgs);
	const command = `${mkExec} ${mkArgs.join(' ')}`;
	const child = spawnSync(mkExec, mkArgs, {cwd: outDir, encoding: 'utf8'});

	let err;
	if (child.error) {
		err = child.error;
	} else if (child.status === 0) {
		try {
			// mksnapshot can return exit code 0 even on failure, and can leave
			// a 0-byte blob behind on error — both need to be treated as
			// failures, matching the original webpack plugin's handling.
			const stat = fs.statSync(path.join(outDir, blob));
			if (!(stat.size > 0)) {
				err = new Error((child.stdout || '') + '\n' + (child.stderr || ''));
			}
		} catch (e) {
			err = new Error((child.stdout || '') + '\n' + (child.stderr || ''));
		}
	} else {
		err = new Error((child.stdout || '') + '\n' + (child.stderr || ''));
	}

	if (err) {
		return {blob: null, error: err, command};
	}
	return {blob, command};
}

// Records the snapshot blob's filename on the root appinfo.json (already
// emitted by the client/isomorphic build), matching what the original
// plugin's `webosMetaRootAppinfo` hook set on `meta.v8SnapshotFile`.
function writeSnapshotAppinfo ({outDir, blob}) {
	const appInfoPath = path.join(outDir, 'appinfo.json');
	if (!blob || !fs.existsSync(appInfoPath)) return false;

	const info = JSON.parse(fs.readFileSync(appInfoPath, {encoding: 'utf8'}));
	info.v8SnapshotFile = blob;
	fs.writeFileSync(appInfoPath, JSON.stringify(info, null, '\t'));
	return true;
}

module.exports = {applySnapshotBuild, runMkSnapshot, writeSnapshotAppinfo};