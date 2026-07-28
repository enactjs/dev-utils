/* eslint-env node, es6 */
/**
 * EsbuildHtmlPlugin
 *
 * esbuild counterpart to the webpack `HtmlWebpackPlugin` wiring used by
 * @enact/cli (and sibling of `ViteHtmlPlugin`). Enact apps do not ship an
 * `index.html`; the document is synthesized from the same `.ejs` template the
 * webpack build uses (only its `<%= … %>` title token is substituted — no full
 * EJS engine needed, matching ViteHtmlPlugin), and the JS/CSS esbuild actually
 * emitted (read from the build `metafile`) are injected as `<script defer>` /
 * `<link rel="stylesheet">`, mirroring HtmlWebpackPlugin's `inject: 'body'`.
 *
 * esbuild's dev server serves straight from `outdir`, so writing `index.html`
 * into `outdir` on `onEnd` covers both build and serve.
 *
 * Options:
 *   title      {string}  Document title.
 *   template   {string}  Absolute path to an .ejs/.html template (optional).
 *   publicPath {string}  Public URL prefix for emitted assets.
 *   production {boolean} Strip comments/blank lines from the emitted HTML.
 *   liveReload {boolean} Inject esbuild's `/esbuild` live-reload listener (dev
 *                        server only) so full-page reloads happen on rebuild.
 */
const fs = require('fs');
const path = require('path');

// esbuild's dev server exposes a `/esbuild` Server-Sent-Events endpoint but does
// not inject any client for it; this tiny listener reloads the page whenever a
// rebuild completes (esbuild has no HMR — full reload is the built-in behavior).
const LIVE_RELOAD_SCRIPT =
	'\t<script>new EventSource("/esbuild").addEventListener("change", () => location.reload());</script>';

// Render the base document from the template (or a sane default), substituting
// the single `<%= … %>` title token used by the Enact HTML template.
function baseHtml(template, title) {
	if (template && fs.existsSync(template)) {
		return fs.readFileSync(template, 'utf8').replace(/<%=[^%]*%>/g, title || '');
	}
	return (
		'<!DOCTYPE html><html><head><meta charset="UTF-8">' +
		'<meta http-equiv="x-ua-compatible" content="ie=edge">' +
		'<meta name="viewport" content="width=device-width, initial-scale=1, ' +
		'minimum-scale=1, maximum-scale=1, user-scalable=no">' +
		`<title>${title || ''}</title></head><body><div id="root"></div></body></html>`
	);
}

module.exports = function EsbuildHtmlPlugin({
	title = '',
	template,
	publicPath = '',
	production = false,
	liveReload = false
} = {}) {
	const toUrl = (outdir, file) => `${publicPath}/${path.relative(outdir, path.resolve(file))}`.replace(/\\/g, '/');

	return {
		name: 'enact-esbuild-html',
		setup(build) {
			// The metafile is what tells us which JS/CSS chunks were emitted.
			build.initialOptions.metafile = true;
			build.onEnd(result => {
				if (!result.metafile) return;
				const outdir =
					build.initialOptions.outdir ||
					(build.initialOptions.outfile && path.dirname(build.initialOptions.outfile)) ||
					path.resolve('dist');

				const outputs = Object.keys(result.metafile.outputs);
				const scripts = outputs
					.filter(f => f.endsWith('.js') && !f.endsWith('.map'))
					.map(f => toUrl(outdir, f));
				const styles = outputs
					.filter(f => f.endsWith('.css') && !f.endsWith('.map'))
					.map(f => toUrl(outdir, f));

				// HtmlWebpackPlugin injects tags after rendering (`inject: 'body'`);
				// replicate that: CSS <link> into <head>, JS <script defer> before
				// </body>.
				let html = baseHtml(template, title);
				const linkTags = styles.map(href => `\t\t<link rel="stylesheet" href="${href}">`).join('\n');
				const scriptTags = scripts.map(src => `\t<script defer src="${src}"></script>`).join('\n');
				if (linkTags && /<\/head>/i.test(html)) {
					html = html.replace(/<\/head>/i, `${linkTags}\n\t</head>`);
				}
				if (scriptTags) {
					html = /<\/body>/i.test(html)
						? html.replace(/<\/body>/i, `${scriptTags}\n</body>`)
						: html + scriptTags;
				}
				// Dev server only: add the live-reload listener before </body>.
				if (liveReload) {
					html = /<\/body>/i.test(html)
						? html.replace(/<\/body>/i, `${LIVE_RELOAD_SCRIPT}\n</body>`)
						: html + LIVE_RELOAD_SCRIPT;
				}
				// Naive equivalent of HtmlWebpackPlugin's production `minify`.
				if (production) {
					html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\n\s*\n/g, '\n');
				}

				fs.mkdirSync(outdir, {recursive: true});
				fs.writeFileSync(path.join(outdir, 'index.html'), html);
			});
		}
	};
};
