// Vite counterpart to the webpack `--isomorphic` prerendering (mixins/isomorphic.js +
// PrerenderPlugin). Vite has first-class SSR, so this does a real `vite build --ssr` of the
// app entry, renders it per-locale in Node (FileXHR for iLib locale data), and assembles the
// same output shape as webpack: a fallback index.html + deduped index.<variant>.html files +
// locale-map.json, plus per-locale webOS appinfo. Reuses the bundler-agnostic PrerenderPlugin
// helpers (templates.js, FileXHR). See docs/vite-isomorphic-scope.md.

const fs = require('fs');
const path = require('path');
const templates = require('../plugins/PrerenderPlugin/templates');
const FileXHR = require('../plugins/PrerenderPlugin/FileXHR');

// The client build ignores ALL iLib platform loaders (browser can't use them). For SSR in
// Node we KEEP the Node loader (ilib-node/NodeLoader) so iLib reads locale data from disk;
// only the Qt/Rhino/Ringo loaders are irrelevant here.
const SSR_LOADER_IGNORE = /(?:[/\\]|^\.\/lib\/)ilib-(?:qt|rhino|ringo)[\w-]*\.js$|(?:Rhino|Qt|Ringo)Loader(?:\.js)?$/;

// Mutate a resolved client build config into the SSR build config (Node-loadable CJS bundle
// whose default export is the app element).
function applySsrBuild(config, {serverEntry, outDir}) {
	config.build.outDir = outDir;
	config.build.ssr = serverEntry;
	config.build.rollupOptions = config.build.rollupOptions || {};
	config.build.rollupOptions.input = serverEntry;
	// CJS: the bundle carries leftover require() (iLib's platform loaders); ESM throws.
	config.build.rollupOptions.output = {
		format: 'cjs',
		entryFileNames: 'app.server.cjs',
		inlineDynamicImports: true
	};
	config.build.cssCodeSplit = false;
	// Bundle @enact (JSX-in-.js needs the babel transform) + ilib (its dynamic imports break
	// when externalized); react/react-dom stay external (Node provides them).
	config.ssr = Object.assign({}, config.ssr, {noExternal: [/^@enact\//, /^ilib($|\/)/]});
	config.build.commonjsOptions = Object.assign({}, config.build.commonjsOptions, {
		ignore: id => SSR_LOADER_IGNORE.test(id)
	});
	// No HTML document / appinfo for the SSR bundle.
	// Also drop the browser Node polyfills (vite-plugin-node-polyfills:*) — the SSR
	// bundle runs in Node and must use the real builtins (path/fs/crypto), not shims.
	const DROP = new Set(['enact-vite-html', 'enact-vite-webosmeta']);
	config.plugins = (config.plugins || [])
		.flat()
		.filter(p => !p || (!DROP.has(p.name) && !String(p.name).startsWith('vite-plugin-node-polyfills')));
	return config;
}

// FileXHR subclass: Vite's base is '/', so @enact/i18n builds absolute locale URLs; FileXHR
// reads relative to cwd (the app dir), so strip the leading '/'.
// Must SUBCLASS rather than wrap: the `xhr` package that @enact/i18n's loader uses assigns
// its completion handler as a property (`xhr.onload = fn`) instead of calling
// addEventListener, and FileXHR.send() invokes `this.onload`. A wrapper holding a private
// FileXHR would strand that handler on the outer object, so no locale data would ever load
// and every locale would prerender unlocalized.
function makeLocaleXHR() {
	function LocaleXHR() {
		FileXHR.call(this);
	}
	LocaleXHR.prototype = Object.create(FileXHR.prototype);
	LocaleXHR.prototype.constructor = LocaleXHR;
	LocaleXHR.prototype.open = function (m, uri, async) {
		FileXHR.prototype.open.call(this, m, String(uri).replace(/^\/+/, ''), async);
	};
	return LocaleXHR;
}

// Render each locale to markup, extract enact-locale-* root classes (stored separately) and
// dedupe identical (sanitized) markup. `load(locale)` returns the app element (uncached).
// `fontGenerator` (optional path) supplies per-locale font CSS, prepended as a head-append
// block (participates in dedupe; extracted into <head> during assembly).
// Returns {prerenders, attr, aliasOf}: prerenders = unique markups, attr[i] = locale classes,
// aliasOf[i] = index into prerenders for locale i.
function prerender({locales, load, renderToString, fontGenerator}) {
	const LocaleXHR = makeLocaleXHR();
	let genFn = null;
	if (fontGenerator) {
		try {
			const m = require(path.resolve(fontGenerator));
			genFn = m && (m.default || m);
		} catch (e) {
			genFn = null;
		}
	}
	const prerenders = [];
	const attr = [];
	const aliasOf = [];
	for (let i = 0; i < locales.length; i++) {
		global.XMLHttpRequest = LocaleXHR;
		process.env.LANG = locales[i];
		let markup = renderToString(load(locales[i]));
		if (genFn) {
			let style = genFn(locales[i]) || '';
			if (typeof genFn.fontOverrideGenerator === 'function') {
				style += genFn.fontOverrideGenerator(locales[i]) || '';
			}
			if (style) markup = '<!-- head append start -->\n' + style + '\n<!-- head append end -->' + markup;
		}
		attr[i] = '';
		markup = markup.replace(
			/(<div[^>]*class="((?!enact-locale-)[^"])*)(\senact-locale-[^"]*)"/i,
			(match, before, s, cls) => {
				attr[i] = cls;
				return before + '"';
			}
		);
		const found = prerenders.indexOf(markup);
		aliasOf[i] = found === -1 ? prerenders.push(markup) - 1 : found;
	}
	return {prerenders, attr, aliasOf};
}

// Assemble the isomorphic output from the client build's index.html + the prerenders.
// Emits the fallback index.html, the deduped index.<variant>.html file(s), and (for >1 locale)
// locale-map.json. Returns {localeMap, variantOf} where variantOf[v] is the emitted filename.
function assemble({outDir, locales, prerenders, attr, aliasOf, screenTypes = [], snapshot = false}) {
	const indexPath = path.join(outDir, 'index.html');
	const clientHtml = fs.readFileSync(indexPath, {encoding: 'utf8'});
	const rootRe = /<div id="root">\s*<\/div>/;
	const jsAssets = [...clientHtml.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].map(m => m[1]);

	// Fallback index.html: remove the body module script, prepend the startup script that
	// shows the (empty here) root then loads the JS at window.onload.
	let fallback = clientHtml.replace(/<script[^>]+type="module"[^>]*><\/script>/g, '');
	// `templates.startup` appends each app asset as a CLASSIC <script> (webpack chunk model).
	// Vite emits ES modules, so mark the dynamically-added script `type="module"` — a single
	// `main.js` module self-loads its own chunks. EXCEPT the snapshot build, whose `main.js`
	// is a UMD bundle that must load as a classic script (it attaches the `App` global to
	// `this`/window, which a module's undefined `this` would break); leave it classic.
	const startupJs = snapshot
		? templates.startup(screenTypes, jsAssets)
		: templates
				.startup(screenTypes, jsAssets)
				.replace(/script\.type = 'text\/javascript'/, "script.type = 'module'");
	const startupTag = '<script type="text/javascript">' + startupJs + '</script>';
	fallback = fallback.replace(/<head[^>]*>/, m => m + '\n' + startupTag);

	const multi = locales.length > 1;
	// Name a variant by its representative (first) locale; a single variant covering every
	// locale is named 'multi' (matches webpack's grouped alias).
	const variantName = v => {
		if (!multi) return 'index.html';
		if (prerenders.length === 1) return 'index.multi.html';
		return 'index.' + locales.find((_, i) => aliasOf[i] === v) + '.html';
	};

	const localeMap = {fallback: 'index.html', locales: {}};
	const variantOf = [];
	for (let v = 0; v < prerenders.length; v++) {
		const linked = locales.filter((_, i) => aliasOf[i] === v);
		const mapping = linked.reduce(
			(mm, loc) => Object.assign(mm, {[loc.toLowerCase()]: {classes: attr[locales.indexOf(loc)]}}),
			{}
		);
		// Split any font-CSS head-append block out of the markup: it goes into <head>, the
		// remaining app markup into #root.
		let appMarkup = prerenders[v];
		let headAppend = '';
		appMarkup = appMarkup.replace(/<!-- head append start -->([\s\S]*?)<!-- head append end -->/, (m, content) => {
			headAppend = content.trim();
			return '';
		});
		// Only need the locale-mapping update script when a variant serves multiple locales.
		const updater = templates.update(prerenders.length > 1 || linked.length > 1 ? mapping : null, null, appMarkup);
		let html = fallback.replace(rootRe, '<div id="root">' + appMarkup + '</div>');
		if (headAppend) html = html.replace(/<head[^>]*>/, m => m + '\n' + headAppend);
		if (updater) html = html.replace('</body>', '<script type="text/javascript">' + updater + '</script>\n</body>');

		const fname = variantName(v);
		fs.writeFileSync(path.join(outDir, fname), html);
		variantOf[v] = fname;
		linked.forEach(loc => {
			localeMap.locales[loc] = fname;
		});
	}

	// For a single locale the prerendered page IS index.html; otherwise index.html is the
	// fallback shell and each locale maps to a variant file.
	if (!multi) {
		// variantName returned 'index.html', already written above.
	} else {
		fs.writeFileSync(indexPath, fallback);
		fs.writeFileSync(path.join(outDir, 'locale-map.json'), JSON.stringify(localeMap, null, '\t'));
	}
	return {localeMap, variantOf};
}

// Phase D: webOS appinfo. Tag the root appinfo with usePrerendering, and (for >1 locale)
// write per-locale resources/<locale>/appinfo.json pointing `main` at the locale's variant.
function writeAppinfo({outDir, locales, localeMap}) {
	const rootPath = path.join(outDir, 'appinfo.json');
	if (fs.existsSync(rootPath) && locales.length > 0) {
		const root = JSON.parse(fs.readFileSync(rootPath, {encoding: 'utf8'}));
		if (typeof root.usePrerendering === 'undefined') {
			root.usePrerendering = true;
			fs.writeFileSync(rootPath, JSON.stringify(root, null, '\t'));
		}
	}
	if (locales.length > 1) {
		for (const loc of locales) {
			const variant = localeMap.locales[loc];
			if (!variant) continue;
			const dir = path.join(outDir, 'resources', loc.replace(/-/g, path.sep));
			fs.mkdirSync(dir, {recursive: true});
			const p = path.join(dir, 'appinfo.json');
			let meta = {};
			try {
				meta = JSON.parse(fs.readFileSync(p, {encoding: 'utf8'}));
			} catch (e) {
				meta = {};
			}
			meta.main = variant;
			fs.writeFileSync(p, JSON.stringify(meta, null, '\t'));
		}
	}
}

module.exports = {applySsrBuild, prerender, assemble, writeAppinfo};
