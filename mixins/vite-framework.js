// Vite counterpart to the webpack DLL framework/externals mixins (framework.js +
// externals.js / EnactFrameworkPlugin + EnactFrameworkRefPlugin). Instead of a webpack
// DLL registry, this builds the shared framework as reusable ESM addressed by an import
// map, and externalizes it out of app builds. See docs/vite-framework-externals-spike.md.
//
// Model (matches webpack): `--framework` builds a shared, app-independent framework from
// the FULL @enact surface + react + ilib, emitting the bundle + a manifest of every
// importable specifier -> output file. `--externals=<path>` externalizes those specifiers
// from the app build and injects an import map (+ the shared stylesheet) resolved from the
// manifest.

const fs = require('fs');
const path = require('path');
const {nonRuntimeEnactPackages} = require('./framework-libraries');

const MANIFEST = 'enact-framework-manifest.json';
const FRAMEWORK_CSS = 'enact.css';

// @enact packages that are build/test tooling, never part of the runtime framework.
const ENACT_TOOL_PKGS = new Set(nonRuntimeEnactPackages);

// react family + ilib are CJS and need enumerate-named-export wrappers (see below).
const CJS_SPECS = ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client', 'ilib'];

// The core-js polyfill entry, included in the framework only with --externals-polyfill.
const POLYFILL_SPEC = 'core-js/stable';

// Whether an import specifier belongs in / should resolve to the shared framework.
function isFrameworkSpec(id) {
	if (/^react($|\/)/.test(id) || /^react-dom($|\/)/.test(id) || id === 'ilib') return true;
	const m = /^@enact\/([^/]+)/.exec(id);
	return Boolean(m) && !ENACT_TOOL_PKGS.has(m[1]);
}

function isCjsSpec(id) {
	return /^react($|\/)/.test(id) || /^react-dom($|\/)/.test(id) || id === 'ilib';
}

// Side-effect-only specifiers (core-js polyfill): no default/named exports to re-export.
function isSideEffectSpec(id) {
	return /^core-js(\/|$)/.test(id);
}

// Turn a specifier into a safe, unique output basename.
function specToName(id) {
	return id.replace(/[@]/g, '').replace(/[/]/g, '-').replace(/^-+/, '');
}

// Enumerate the importable specifiers of the shared framework, independent of any app:
// every @enact/<pkg> package root + each of its component subpaths (dirs with a
// package.json `main` or an index.js), plus the react family and ilib.
function enumerateSpecifiers(context, opts = {}) {
	const nm = path.join(context, 'node_modules');
	const specs = new Set(CJS_SPECS);
	// --externals-polyfill: bundle core-js into the shared framework instead of each app.
	if (opts.polyfill) specs.add(POLYFILL_SPEC);
	const enactDir = path.join(nm, '@enact');
	let pkgs = [];

	try {
		pkgs = fs.readdirSync(enactDir);
	} catch (e) {
		pkgs = [];
	}

	for (const pkg of pkgs) {
		if (ENACT_TOOL_PKGS.has(pkg)) continue;
		const pkgDir = path.join(enactDir, pkg);
		let stat;

		try {
			stat = fs.statSync(pkgDir);
		} catch (e) {
			continue;
		}

		if (!stat.isDirectory()) continue;
		// package root, if importable
		if (fs.existsSync(path.join(pkgDir, 'package.json')) || fs.existsSync(path.join(pkgDir, 'index.js'))) {
			specs.add('@enact/' + pkg);
		}
		// component subpaths
		let subs = [];

		try {
			subs = fs.readdirSync(pkgDir);
		} catch (e) {
			subs = [];
		}

		for (const sub of subs) {
			if (sub === 'node_modules' || sub === 'tests' || sub === 'build' || sub === 'dist' || sub.startsWith('.')) {
				continue;
			}
			const subDir = path.join(pkgDir, sub);
			let sstat;
			try {
				sstat = fs.statSync(subDir);
			} catch (e) {
				continue;
			}
			if (!sstat.isDirectory()) continue;
			if (fs.existsSync(path.join(subDir, 'package.json')) || fs.existsSync(path.join(subDir, 'index.js'))) {
				specs.add('@enact/' + pkg + '/' + sub);
			}
		}
	}
	return [...specs].sort();
}

// Generate a re-export WRAPPER file per specifier into srcDir, returning {input, names}.
// Wrappers (never the resolved file as an entry) keep the real module transitive, which is
// what lets Vite's commonjs interop handle @enact's CJS-in-source the way a normal app
// build does. CJS specifiers additionally need explicit enumerated named exports.
function writeWrappers(specifiers, srcDir, appRequire) {
	fs.mkdirSync(srcDir, {recursive: true});
	const idRe = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
	const input = {};
	const names = {};
	for (const spec of specifiers) {
		const name = specToName(spec);
		const file = path.join(srcDir, name + '.js');
		try {
			if (isSideEffectSpec(spec)) {
				// core-js polyfill: side-effect only, no exports. Resolves via the build's
				// core-js alias (apps don't depend on core-js directly), so no resolve check.
				fs.writeFileSync(file, `import '${spec}';\n`);
			} else if (isCjsSpec(spec)) {
				const mod = appRequire(spec);
				const exp = Object.keys(mod).filter(k => k !== 'default' && k !== '__esModule' && idRe.test(k));
				fs.writeFileSync(
					file,
					`import __m from '${spec}';\nexport default __m;\n` +
						(exp.length ? `export const { ${exp.join(', ')} } = __m;\n` : '')
				);
			} else {
				// verify it resolves before emitting a wrapper (skip phantom specifiers)
				appRequire.resolve(spec);
				fs.writeFileSync(
					file,
					`import * as __m from '${spec}';\n` +
						`export * from '${spec}';\n` +
						`export default (__m.default !== undefined ? __m.default : __m);\n`
				);
			}
		} catch (e) {
			continue; // unresolvable specifier; leave it out of the framework
		}
		input[name] = file;
		names[spec] = name;
	}
	return {input, names};
}

// Mutate a resolved app-build config into the FRAMEWORK build config.
function applyFramework(config, {input, outDir}) {
	config.build.outDir = outDir;
	config.build.emptyOutDir = true;
	// one shared stylesheet (import maps can't load per-chunk CSS)
	config.build.cssCodeSplit = false;
	config.build.rollupOptions = config.build.rollupOptions || {};
	config.build.rollupOptions.input = input;
	config.build.rollupOptions.preserveEntrySignatures = 'strict';
	config.build.rollupOptions.output = Object.assign({}, config.build.rollupOptions.output, {
		entryFileNames: '[name].js',
		chunkFileNames: 'chunk-[name].js',
		assetFileNames: info => ((info.name || '').endsWith('.css') ? FRAMEWORK_CSS : '[name][extname]')
	});
	// The framework has no HTML document / appinfo; drop those plugins.
	const DROP = new Set(['enact-vite-html', 'enact-vite-webosmeta']);
	config.plugins = (config.plugins || []).flat().filter(p => !p || !DROP.has(p.name));
	return config;
}

// Mutate a resolved app-build config to EXTERNALIZE the framework specifiers, recording
// which are actually imported into `collected`. Externalization is manifest-aware: a
// specifier is only externalized if the framework actually provides it, so an app whose
// imports the framework doesn't cover still builds (the uncovered pieces stay bundled).
function applyExternals(config, collected, manifest, opts = {}) {
	const inManifest = id => Boolean(manifest && manifest.imports && manifest.imports[id]);
	// --externals-polyfill: the framework provides core-js. Externalizing it as one unit
	// needs it to stay a bare specifier, so drop the core-js alias (the app config points
	// it at the CLI's copy) before it gets resolved+inlined.
	if (opts.polyfill && inManifest(POLYFILL_SPEC) && config.resolve && Array.isArray(config.resolve.alias)) {
		config.resolve.alias = config.resolve.alias.filter(a => String(a.find) !== 'core-js');
	}
	config.build.rollupOptions = config.build.rollupOptions || {};
	config.build.rollupOptions.external = id => {
		const wanted = isFrameworkSpec(id) || (opts.polyfill && id === POLYFILL_SPEC);
		if (wanted && inManifest(id)) {
			collected.add(id);
			return true;
		}
		return false;
	};
	return config;
}

function writeManifest(outDir, names) {
	const manifest = {css: fs.existsSync(path.join(outDir, FRAMEWORK_CSS)) ? FRAMEWORK_CSS : null, imports: {}};
	for (const spec of Object.keys(names)) manifest.imports[spec] = names[spec] + '.js';
	fs.writeFileSync(path.join(outDir, MANIFEST), JSON.stringify(manifest, null, 2));
	return manifest;
}

function readManifest(frameworkPath) {
	return JSON.parse(fs.readFileSync(path.join(frameworkPath, MANIFEST), {encoding: 'utf8'}));
}

// Inject the import map + shared stylesheet <link> into the app's built index.html.
// `base` is the public URL prefix to the framework files (from --externals-public, or the
// relative ./framework path).
function injectHtml(htmlPath, manifest, collected, base) {
	const imports = {};

	for (const spec of collected) {
		if (manifest.imports[spec]) imports[spec] = base.replace(/\/$/, '') + '/' + manifest.imports[spec];
	}

	let html = fs.readFileSync(htmlPath, {encoding: 'utf8'});
	const importmap = '<script type="importmap">' + JSON.stringify({imports}) + '</script>';
	// import map must precede any module import
	html = html.replace(/<head[^>]*>/, m => m + '\n' + importmap);

	if (manifest.css) {
		const link = '<link rel="stylesheet" href="' + base.replace(/\/$/, '') + '/' + manifest.css + '">';
		if (/<link[^>]+stylesheet/i.test(html)) {
			html = html.replace(/(<link[^>]+stylesheet[^>]*>)/i, link + '\n$1');
		} else {
			html = html.replace('</head>', link + '\n</head>');
		}
	}
	fs.writeFileSync(htmlPath, html);
	return Object.keys(imports).length;
}

// Only the functions the CLI (`pack.js`) actually calls are exported. MANIFEST /
// FRAMEWORK_CSS / isFrameworkSpec are internal helpers.
module.exports = {
	enumerateSpecifiers,
	writeWrappers,
	applyFramework,
	applyExternals,
	writeManifest,
	readManifest,
	injectHtml
};
