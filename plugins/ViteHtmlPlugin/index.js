/* eslint-env node, es6 */
/**
 * ViteHtmlPlugin
 *
 * Vite counterpart to the webpack `HtmlWebpackPlugin` wiring used by @enact/cli.
 * Enact apps do not ship an `index.html`; Therefore, default Vite bahaviour cannot be applied
 * the document is synthesized from an`.ejs` template (the same one the webpack build uses) with the app entry
 * injected as an ES module.
 *
 * It handles both modes:
 *   - dev server: serves the synthesized document at `/`, letting Vite inject
 *     its HMR client via `transformIndexHtml`.
 *   - production build: emits `index.html` with the hashed entry chunk and its
 *     CSS linked, honoring the configured `base` public path.
 *
 * Options:
 *   entry    {string}  Absolute path to the (combined) app entry module.
 *   title    {string}  Document title.
 *   template {string}  Absolute path to an .ejs/.html template (optional).
 */
const fs = require('fs');

// A classic (non-module) head script that runs before any deferred module script.
// Enact's `polyfills.js` and core-js reference the Node `global`, which doesn't
// exist in the browser (webpack supplied it via node-polyfill-webpack-plugin).
// Defining it on the global object makes bare `global` references to be resolved without
// modifying any code. `globalThis === window` on the browser main thread.
const NODE_GLOBALS_SHIM = '<script>globalThis.global=globalThis;</script>';

// Render the base document from the template (or a sane default), substituting
// the single `<%= ... %>` title token used by the Enact HTML template, and
// injecting the Node-globals shim into <head>.
function baseHtml(template, title) {
	let html;
	if (template && fs.existsSync(template)) {
		html = fs.readFileSync(template, 'utf8').replace(/<%=[^%]*%>/g, title || '');
	} else {
		html =
			'<!DOCTYPE html><html><head><meta charset="UTF-8">' +
			'<meta http-equiv="x-ua-compatible" content="ie=edge">' +
			'<meta name="viewport" content="width=device-width, initial-scale=1, ' +
			'minimum-scale=1, maximum-scale=1, user-scalable=no">' +
			`<title>${title || ''}</title></head><body><div id="root"></div></body></html>`;
	}
	return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${NODE_GLOBALS_SHIM}</head>`) : NODE_GLOBALS_SHIM + html;
}

// Dev: reference the source entry through Vite's filesystem endpoint so the
// combined polyfills+app module (and its CSS) is loaded and HMR-tracked.
function injectDev(html, entry) {
	const src = '/@fs/' + entry.replace(/\\/g, '/');
	const script = `<script type="module" src="${src}"></script>`;
	return html.replace(/<\/body>/i, `${script}</body>`);
}

// Build: reference the emitted entry chunk and link its CSS.
function injectBuild(html, {scriptFile, cssFiles, base}) {
	const prefix = base.endsWith('/') ? base : base + '/';
	const links = cssFiles.map(f => `<link rel="stylesheet" href="${prefix}${f}">`).join('');
	const script = `<script type="module" src="${prefix}${scriptFile}"></script>`;
	return html.replace(/<\/head>/i, `${links}</head>`).replace(/<\/body>/i, `${script}</body>`);
}

module.exports = function ViteHtmlPlugin({entry, title = '', template} = {}) {
	let base = '/';
	return {
		name: 'enact-vite-html',
		// SPA so Vite doesn't expect an MPA-style html input.
		config() {
			return {appType: 'spa'};
		},
		configResolved(resolved) {
			base = resolved.base || '/';
		},
		// Dev server: intercept the root request and serve the synthesized document.
		configureServer(server) {
			server.middlewares.use(async (req, res, next) => {
				const url = req.url && req.url.split('?')[0];
				if (url !== '/' && url !== '/index.html') return next();
				try {
					let html = injectDev(baseHtml(template, title), entry);
					html = await server.transformIndexHtml(req.url, html);
					res.statusCode = 200;
					res.setHeader('Content-Type', 'text/html');
					res.end(html);
				} catch (err) {
					next(err);
				}
			});
		},
		// Production build: locate the entry chunk + its CSS and emit index.html.
		generateBundle(options, bundle) {
			let entryChunk;
			const cssFiles = [];
			const seen = new Set();
			const addCss = f => {
				if (!seen.has(f)) {
					seen.add(f);
					cssFiles.push(f);
				}
			};

			for (const fileName of Object.keys(bundle)) {
				const chunk = bundle[fileName];
				if (chunk.type === 'chunk' && chunk.isEntry) {
					entryChunk = chunk;
					const imported = chunk.viteMetadata && chunk.viteMetadata.importedCss;
					if (imported) imported.forEach(addCss);
				}
			}
			// Include any remaining top-level CSS assets (e.g. --no-split-css output).
			for (const fileName of Object.keys(bundle)) {
				if (bundle[fileName].type === 'asset' && fileName.endsWith('.css')) addCss(fileName);
			}

			if (!entryChunk) {
				this.warn('ViteHtmlPlugin: no entry chunk found; skipping index.html emission.');
				return;
			}

			const html = injectBuild(baseHtml(template, title), {
				scriptFile: entryChunk.fileName,
				cssFiles,
				base
			});
			this.emitFile({type: 'asset', fileName: 'index.html', source: html});
		}
	};
};
