/*
 *  vite-framework.js
 *
 *  Shared framework/externals support for `enact pack --framework`/
 *  `--externals`. `enumerateSpecifiers`, `enumerateSelfSpecs`, `writeWrappers`,
 *  `writeManifest`, `readManifest`, and `injectHtml` are plain filesystem/
 *  string operations with no bundler coupling, and are used identically by
 *  both the Vite path (pack.js's `viteFramework`/`viteBuild`) and the esbuild
 *  path (esbuild-framework.js/esbuild-pack.js/esbuild-isomorphic.js — see
 *  those files for the esbuild-specific build-options mutation this module
 *  intentionally doesn't do). `applyFramework`/`applyExternals` mutate a
 *  Vite `InlineConfig`/Rollup options object directly and are Vite-specific;
 *  esbuild's equivalents live in esbuild-externals.js/esbuild-framework.js
 *  since esbuild's build-options shape is different enough to need its own
 *  implementation rather than sharing this one.
 */
const fs = require('fs');
const path = require('path');
const fastGlob = require('fast-glob');
const {nonRuntimeEnactPackages} = require('./framework-libraries');

const MANIFEST_FILENAME = 'framework-manifest.json';
const FRAMEWORK_CSS = 'enact.css';
const TOOL_PKGS = new Set(nonRuntimeEnactPackages);

// ---------------------------------------------------------------------
// Ported from plugins/dll/EnactFrameworkPlugin.js's `normalizeModuleID` —
// converts a discovered file path into a stable, require()-resolvable
// specifier (e.g. "node_modules/@enact/core/kind.js" -> "@enact/core/kind").
// Genuinely bundler-agnostic (pure fs/package.json inspection), so reused
// here rather than reimplemented.
// ---------------------------------------------------------------------
const pkgCache = {};
function checkPkgMain (dir) {
	if (pkgCache[dir]) return pkgCache[dir].main;
	try {
		const text = fs.readFileSync(path.join(dir, 'package.json'), {encoding: 'utf8'});
		pkgCache[dir] = JSON.parse(text);
		return pkgCache[dir].main;
	} catch (e) {
		return undefined;
	}
}

const parentCache = {};
function findParent (dir) {
	if (parentCache[dir]) return parentCache[dir];
	const currPkg = path.join(dir, 'package.json');
	if (fs.existsSync(currPkg)) {
		return dir;
	} else if (dir === '/' || dir === '' || dir === '.' || dir === path.dirname(dir)) {
		return null;
	}
	return findParent(path.dirname(dir));
}

function normalizeModuleID (id) {
	const dir = fs.existsSync(id) && fs.statSync(id).isDirectory() ? id : path.dirname(id);
	parentCache[dir] = parentCache[dir] || findParent(dir);
	if (parentCache[dir]) {
		const main = checkPkgMain(parentCache[dir]);
		if (main && path.resolve(id) === path.resolve(path.join(parentCache[dir], main))) {
			id = parentCache[dir];
		}
	}
	id = id.replace(/\\/g, '/');

	const nodeModulesPrefix = 'node_modules/';
	const idx = id.lastIndexOf(nodeModulesPrefix);
	if (idx !== -1) {
		id = id.substring(idx + nodeModulesPrefix.length);
	}

	if (id.endsWith('.js') || id.endsWith('.jsx') || id.endsWith('.es6')) {
		id = id.substring(0, id.lastIndexOf('.'));
	}
	if (id.endsWith('/index') && id.length > 6) {
		id = id.substring(0, id.length - 6);
	}
	return id;
}

// ---------------------------------------------------------------------
// enumerateSpecifiers / enumerateSelfSpecs
// ---------------------------------------------------------------------

// Ported from mixins/framework.js's fastGlob-based discovery (same glob
// patterns/ignore lists), converting each discovered file into a stable
// specifier via normalizeModuleID rather than returning raw file paths —
// callers resolve those specifiers themselves (writeWrappers, below).
function enumerateSpecifiers (context, opts = {}) {
	const nodeModulesDir = path.resolve(path.join(context, 'node_modules'));
	const specs = new Set();

	if (fs.existsSync(nodeModulesDir)) {
		const enactFiles = fastGlob.sync('@enact/**/*.@(js|jsx|es6)', {
			cwd: nodeModulesDir,
			onlyFiles: true,
			ignore: [
				'**/webpack.config.js',
				'**/eslint.config.js',
				'**/karma.conf.js',
				'**/build/**/*.*',
				'**/dist/**/*.*',
				'**/samples/**/*.*',
				'**/tests/**/*.*',
				'**/__tests__/**/*.*',
				...nonRuntimeEnactPackages.map(pkg => `@enact/${pkg}/**/*.*`)
			],
			followSymbolicLinks: true
		});
		const ilibFiles = fastGlob.sync('ilib/**/*.@(js|jsx|es6)', {
			cwd: nodeModulesDir,
			onlyFiles: true,
			ignore: [
				'**/localedata/**/*.*',
				'**/ilib-node*.js',
				'**/ilib-qt*.js',
				'**/ilib-rhino*.js',
				'**/ilib-ringo*.js',
				'**/AsyncNodeLoader.js',
				'**/NodeLoader.js',
				'**/RhinoLoader.js',
				'**/QtLoader.js'
			],
			followSymbolicLinks: true
		});
		enactFiles.concat(ilibFiles).forEach(relFile => {
			specs.add(normalizeModuleID(path.join('node_modules', relFile)));
		});
	}

	['react', 'react-dom', 'react-dom/client', 'react-dom/server'].forEach(s => specs.add(s));
	if (opts.polyfill) specs.add('core-js/stable');

	return Array.from(specs).sort();
}

// A theme repo (e.g. building --framework from inside @enact/<theme> itself)
// also wants its own local components included, even though they aren't
// under node_modules/@enact. Mirrors webpack mixins/framework.js's
// `libraries.push('.')` self-inclusion.
function enumerateSelfSpecs (context) {
	let pkg;
	try {
		pkg = JSON.parse(fs.readFileSync(path.join(context, 'package.json'), {encoding: 'utf8'}));
	} catch (e) {
		return null;
	}
	if (!pkg.name || !pkg.name.startsWith('@enact/')) return null;

	const themeMarkers = ['MoonstoneDecorator', 'ThemeDecorator', 'SandstoneDecorator', 'AgateDecorator'];
	const looksLikeTheme = themeMarkers.some(dir => fs.existsSync(path.join(context, dir))) || pkg.name === '@enact/i18n';
	if (!looksLikeTheme) return null;

	const files = fastGlob.sync('**/*.@(js|jsx|es6)', {
		cwd: context,
		onlyFiles: true,
		ignore: [
			'node_modules/**/*.*',
			'samples/**/*.*',
			'dist/**/*.*',
			'build/**/*.*',
			'resources/**/*.*',
			'coverage/**/*.*',
			'tests/**/*.*',
			'**/__tests__/**/*.*',
			'**/?(*.)+(spec|test).[jt]s?(x)',
			'**/*-specs.@(js|jsx)'
		]
	});

	const specs = files.map(f => {
		const withoutExt = f.replace(/\.(js|jsx|es6)$/, '').replace(/\/index$/, '');
		return withoutExt === '' || withoutExt === 'index' ? pkg.name : `${pkg.name}/${withoutExt}`;
	});

	return {name: pkg.name, root: context, specs: Array.from(new Set(specs)).sort()};
}

// ---------------------------------------------------------------------
// writeWrappers
// ---------------------------------------------------------------------

function safeFileName (spec) {
	return spec.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// Wraps the resolved module with a namespace re-export rather than a literal
// `export {default} from '...'` — the latter throws a hard build error for
// any target module that genuinely has no default export, which is common
// enough across a few hundred discovered files that it isn't safe to assume.
// This pushes the "does it have a default" check to runtime instead, which
// esbuild/Rollup's CJS interop already makes safe either way.
function wrapperSource (importPath) {
	return (
		`import * as __ns from ${JSON.stringify(importPath)};\n` +
		'export default __ns && __ns.default !== undefined ? __ns.default : __ns;\n' +
		`export * from ${JSON.stringify(importPath)};\n`
	);
}

// Resolves every specifier to its real file and writes a small wrapper into
// `srcDir`, one per specifier, so the bundler gets a stable, individually
// addressable entry point per specifier regardless of how deep/differently
// named the real file is. Returns `{input, names}`:
//   input: {specifier: absoluteWrapperFilePath, ...} — usable directly as
//     bundler entryPoints (both Vite's rollupOptions.input and esbuild's
//     entryPoints accept this {name: path} shape).
//   names: {specifier: specifier, ...} — a companion map writeManifest
//     reads afterward; kept as a real (if currently identity) mapping
//     rather than reusing `input`'s keys directly, since a future revision
//     may need input keys that differ from the public specifier (e.g. if a
//     specifier contains characters that don't survive round-tripping
//     through a particular bundler's entry-name handling).
// Specifiers that fail to resolve (e.g. an optional dependency not
// installed) are silently skipped rather than failing the whole build.
function writeWrappers (specs, srcDir, requireFn, selfSet) {
	fs.mkdirSync(srcDir, {recursive: true});
	const input = {};
	const names = {};

	specs.forEach(spec => {
		let resolved;
		try {
			resolved = requireFn.resolve(spec);
		} catch (e) {
			if (selfSet && selfSet.has(spec)) {
				// Self-referencing resolution (a theme package requiring its
				// own name) needs the package.json's own `exports`/self-ref
				// support to work via a plain require.resolve. If that isn't
				// set up, there's no root path available here to fall back
				// to manual resolution with (writeWrappers only receives the
				// specifier list, not the theme root) — skip rather than
				// guess wrong.
			}
			return;
		}

		const wrapperPath = path.join(srcDir, safeFileName(spec) + '.js');
		const relResolved = path.relative(path.dirname(wrapperPath), resolved).replace(/\\/g, '/');
		const importPath = relResolved.startsWith('.') ? relResolved : './' + relResolved;

		fs.writeFileSync(wrapperPath, wrapperSource(importPath));
		input[spec] = wrapperPath;
		names[spec] = spec;
	});

	return {input, names};
}

// ---------------------------------------------------------------------
// writeManifest / readManifest
// ---------------------------------------------------------------------

// Scans `outDir` for the actual built output file for each specifier in
// `names` (bundler-output-agnostic by design: takes only the output
// directory + name map, not a metafile/bundle result, so it works
// identically for Vite and esbuild output). Every specifier that resolved
// to a wrapper in writeWrappers is expected to have produced
// `outDir/{specifier}.js` exactly (both this module's callers configure
// their entry-name/output-path templates so the specifier IS the relative
// output path, with no content-hash suffix on framework builds) —
// specifiers whose output file doesn't exist (dropped by tree-shaking, or
// deduped entirely into another chunk) are simply omitted from the manifest.
function writeManifest (outDir, names) {
	const imports = {};
	Object.keys(names).forEach(key => {
		const spec = names[key];
		const relPath = spec + '.js';
		if (fs.existsSync(path.join(outDir, relPath))) {
			imports[spec] = './' + relPath;
		}
	});

	const cssPath = path.join(outDir, FRAMEWORK_CSS);
	const manifest = {
		version: 1,
		generated: new Date().toISOString(),
		imports,
		css: fs.existsSync(cssPath) ? FRAMEWORK_CSS : null
	};

	fs.writeFileSync(path.join(outDir, MANIFEST_FILENAME), JSON.stringify(manifest, null, '\t'));
	return manifest;
}

// `--externals <path>` may point at either the framework's output directory
// (the common case) or directly at a framework-manifest.json file.
function readManifest (manifestPathOrDir) {
	let manifestFile = manifestPathOrDir;
	if (fs.existsSync(manifestPathOrDir) && fs.statSync(manifestPathOrDir).isDirectory()) {
		manifestFile = path.join(manifestPathOrDir, MANIFEST_FILENAME);
	}
	if (!fs.existsSync(manifestFile)) {
		throw new Error(
			`--externals: could not find a framework manifest at "${manifestPathOrDir}". ` +
			'Run `enact pack --framework` first (or point --externals at its output directory).'
		);
	}
	return JSON.parse(fs.readFileSync(manifestFile, {encoding: 'utf8'}));
}

// ---------------------------------------------------------------------
// injectHtml
// ---------------------------------------------------------------------

// Injects a browser-native import map for every specifier in `collected`
// (the ones the app build actually externalized/imported — not necessarily
// every specifier the framework manifest provides), plus a <link> to the
// framework's shared stylesheet if present. Returns the number of
// specifiers injected, for the caller's own log line.
function injectHtml (htmlPath, manifest, collected, base) {
	if (!fs.existsSync(htmlPath) || !manifest) return 0;

	const specs = Array.from(collected).filter(spec => manifest.imports && manifest.imports[spec]);
	if (!specs.length && !manifest.css) return 0;

	const baseUrl = String(base || '.').replace(/\/$/, '');
	const imports = {};
	specs.forEach(spec => {
		imports[spec] = `${baseUrl}/${manifest.imports[spec].replace(/^\.\//, '')}`;
	});

	let html = fs.readFileSync(htmlPath, 'utf8');

	if (specs.length) {
		const importMapTag = `<script type="importmap">${JSON.stringify({imports})}</script>`;
		html = html.includes('</head>') ? html.replace('</head>', `${importMapTag}</head>`) : importMapTag + html;
	}
	if (manifest.css) {
		const cssTag = `<link rel="stylesheet" href="${baseUrl}/${manifest.css}">`;
		html = html.includes('</head>') ? html.replace('</head>', `${cssTag}</head>`) : cssTag + html;
	}

	fs.writeFileSync(htmlPath, html);
	return specs.length;
}

// ---------------------------------------------------------------------
// applyFramework / applyExternals — Vite/Rollup-specific config mutation.
// Not used by the esbuild path (see esbuild-externals.js/esbuild-framework.js
// for its own build-options-shaped equivalents).
// ---------------------------------------------------------------------

// Points a Vite framework build's rollupOptions at the wrapper entries
// writeWrappers produced, and (for a theme-repo self build) aliases the
// theme's own package name to its repo root so internal self-imports
// resolve without needing to be installed under node_modules.
function applyFramework (config, {input, outDir, selfAlias}) {
	config.build = config.build || {};
	config.build.outDir = outDir;
	config.build.emptyOutDir = true;
	config.build.cssCodeSplit = false;
	config.build.lib = false;
	config.build.rollupOptions = Object.assign({}, config.build.rollupOptions, {
		input,
		output: Object.assign({}, config.build.rollupOptions && config.build.rollupOptions.output, {
			format: 'es',
			entryFileNames: '[name].js',
			chunkFileNames: 'chunk.[name]-[hash].js',
			assetFileNames: assetInfo =>
				assetInfo.name && assetInfo.name.endsWith('.css') ? FRAMEWORK_CSS : 'assets/[name]-[hash][extname]'
		})
	});

	if (selfAlias) {
		config.resolve = config.resolve || {};
		config.resolve.alias = Object.assign({}, config.resolve.alias, {[selfAlias.find]: selfAlias.replacement});
	}

	return config;
}

// Mirrors the unexported `isFrameworkSpec` predicate esbuild-externals.js
// re-derives against the same TOOL_PKGS list, kept here as the single
// canonical copy for the Vite path (Rollup's `external` accepts a predicate
// function directly, unlike esbuild's static array, so this doesn't need
// the onResolve-hook indirection esbuild-externals.js uses).
function isFrameworkSpec (id) {
	if (/^react($|\/)/.test(id) || /^react-dom($|\/)/.test(id) || id === 'ilib') return true;
	const m = /^@enact\/([^/]+)/.exec(id);
	return Boolean(m) && !TOOL_PKGS.has(m[1]);
}

// Mutates a Vite InlineConfig in place to externalize the framework's
// specifiers, recording which ones the app actually imports into
// `collected` (a Set the caller passes in, then reads after the build to
// drive injectHtml) — mirrors applyEsbuildExternals in esbuild-externals.js.
function applyExternals (config, collected, manifest, opts = {}) {
	const inManifest = id => Boolean(manifest && manifest.imports && manifest.imports[id]);
	const polyfillSpec = 'core-js/stable';

	config.build = config.build || {};
	config.build.rollupOptions = config.build.rollupOptions || {};
	const previousExternal = config.build.rollupOptions.external;

	config.build.rollupOptions.external = id => {
		const wanted = isFrameworkSpec(id) || (opts.polyfill && id === polyfillSpec);
		if (wanted && inManifest(id)) {
			collected.add(id);
			return true;
		}
		if (typeof previousExternal === 'function') return previousExternal(id);
		if (Array.isArray(previousExternal)) return previousExternal.includes(id);
		return false;
	};

	return config;
}

module.exports = {
	enumerateSpecifiers,
	enumerateSelfSpecs,
	writeWrappers,
	writeManifest,
	readManifest,
	injectHtml,
	applyFramework,
	applyExternals
};