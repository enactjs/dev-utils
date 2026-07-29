/* eslint-env node, es6 */
/**
 * parse-locales
 *
 * Locale-list resolution shared by `PrerenderPlugin` (webpack `--isomorphic`) and
 * `ViteILibPlugin` (Vite iLib locale filtering, `-l`).
 */
const fs = require('fs');
const path = require('path');

// Determine the desired target locales based of option content.
// Can be a preset like 'tv' or 'signage', 'used' for all used app-level locales, 'all' for
// all locales supported by ilib, a custom json file input, or a comma-separated lists
function parseLocales(context, target) {
	if (!target || target === 'none') {
		return [];
	} else if (Array.isArray(target)) {
		return target;
	} else if (target.toLowerCase() === 'webos') {
		return JSON.parse(fs.readFileSync(path.join(__dirname, 'locales-webos.json'), {encoding: 'utf8'})).locales;
	} else if (target === 'tv') {
		return JSON.parse(fs.readFileSync(path.join(__dirname, 'locales-tv.json'), {encoding: 'utf8'})).locales;
	} else if (target === 'signage') {
		return JSON.parse(fs.readFileSync(path.join(__dirname, 'locales-signage.json'), {encoding: 'utf8'})).locales;
	} else if (target === 'used') {
		return detectLocales(path.join(context, 'resources', 'ilibmanifest.json'));
	} else if (target === 'all') {
		return detectLocales(path.join('node_modules', 'ilib', 'locale', 'ilibmanifest.json'), true);
	} else if (/\.json$/i.test(target)) {
		return JSON.parse(fs.readFileSync(target, {encoding: 'utf8'})).locales;
	} else {
		return target.split(/\s*[\n,]\s*/).filter(Boolean);
	}
}

// Scan an ilib manifest and detect all locales that it uses.
function detectLocales(manifest, deepestOnly) {
	try {
		const meta = JSON.parse(fs.readFileSync(manifest, {encoding: 'utf8'}));
		const locales = [];
		let curr, currLocale;
		for (let i = 0; meta.files && i < meta.files.length; i++) {
			curr = path.dirname(meta.files[i]);
			currLocale = curr.replace(/[\\/]+/, '-');
			if (locales.indexOf(curr) === -1 && /^([a-z]{2})\b/.test(currLocale)) {
				if (deepestOnly) {
					// Remove any matches of parent directories.
					for (let x = curr; x.indexOf('/') !== -1 || x.indexOf('\\') !== -1; x = path.dirname(x)) {
						const index = locales.indexOf(x.replace(/[\\/]+/, '-'));
						if (index >= 0) {
							locales.splice(index, 1);
						}
					}
					// Only add the entry if children aren't already in the list.
					let childFound = false;
					for (let k = 0; k < locales.length && !childFound; k++) {
						childFound = locales[k].indexOf(currLocale) === 0;
					}
					if (!childFound) {
						locales.push(currLocale);
					}
				} else {
					locales.push(currLocale);
				}
			}
		}
		locales.sort((a, b) => a.split('-').length > b.split('-').length);
		return locales;
	} catch (e) {
		return [];
	}
}

module.exports = {parseLocales, detectLocales};
