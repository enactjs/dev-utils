const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const {SyncHook} = require('tapable');
const templates = require('./templates');
const vdomServer = require('./vdom-server-render');

class PrerenderPlugin {
	constructor(options = {}) {
		this.options = options;
		this.options.chunk = this.options.chunk || 'main.js';
		if (!this.options.chunk.endsWith('.js')) this.options.chunk += '.js';
		if (this.options.locales === undefined) this.options.locales = 'en-US';
		if (this.options.mapfile === undefined || this.options.mapfile === true)
			this.options.mapfile = 'locale-map.json';
		// eslint-disable-next-line
		if (!this.options.server) this.options.server = require.resolve('react-dom/server');
	}

	apply(compiler) {
		const opts = this.options;
		const status = {prerender: [], attr: [], alias: []};
		let locales;

		compiler.hooks.compilation.tap('PrerenderPlugin', compilation => {
			const appInfoOptimize = {groups: {}, coverage: []};
			let jsAssets = [];

			// Do nothing when run in virtual or custom output FS
			if (!isNodeOutputFS(compiler)) return;

			// Define compilation hooks
			compilation.hooks.prerenderChunk = new SyncHook(['details']);
			compilation.hooks.prerenderLocale = new SyncHook(['details']);

			// Determine the target locales and load up the startup scripts.
			locales = parseLocales(compiler.context, opts.locales);

			// Ensure that any async chunk-loading jsonp functions are isomorphically compatible.
			compilation.mainTemplate.hooks.bootstrap.tap('PrerenderPlugin', source => {
				return source.replace(/window/g, '(function() { return this; }())');
			});

			// Prerender each locale desired and output an error on failure.
			compilation.hooks.chunkAsset.tap('PrerenderPlugin', (chunk, file) => {
				if (file === opts.chunk) {
					compilation.hooks.prerenderChunk.call({chunk: opts.chunk, locales: locales});
					vdomServer.stage(compilation.assets[opts.chunk].source(), opts);
					for (let i = 0; i < locales.length; i++) {
						try {
							// Prerender the locale.
							const renderOpts = {
								server: opts.server,
								locale: locales[i],
								externals: opts.externals,
								fontGenerator: opts.fontGenerator
							};
							compilation.hooks.prerenderLocale.call({
								chunk: opts.chunk,
								opts: renderOpts
							});
							let appHtml = vdomServer.render(renderOpts);

							// Extract the root CSS classes and react checksum from the prerendered html code.
							status.attr[i] = {classes: ''};
							appHtml = appHtml
								.replace(
									/(<div[^>]*class="((?!enact-locale-)[^"])*)(\senact-locale-[^"]*)"/i,
									(match, before, s, classAttr) => {
										status.attr[i].classes = classAttr;
										return before + '"';
									}
								)
								.replace(/(<div[^>]*data-react-checksum=")([^"]*)"/i, (match, before, checksum) => {
									status.attr[i].checksum = checksum;
									return before + '"';
								});

							// Dedupe the sanitized html code and alias as needed
							const index = status.prerender.indexOf(appHtml);
							if (index === -1) {
								status.prerender[i] = appHtml;
							} else {
								status.alias[i] = locales[index];
							}
						} catch (e) {
							status.err = {locale: locales[i], result: e};
							break;
						}
					}
					if (!status.err) {
						vdomServer.unstage();
						// Simplify out aliases and group together for minimal file output.
						simplifyAliases(locales, status);
					}
				}
			});

			// For any target locales that don't already have appinfo files, dynamically generate new ones.
			compilation.hooks.webosMetaListLocalized.tap('PrerenderPlugin', locList => {
				// No need to process localized appinfo files on error or a singular locale.
				if (!status.err && locales.length > 1) {
					for (let i = 0; i < locales.length; i++) {
						if (locales[i].indexOf('multi') !== 0 && !/\.\d+$/.test(locales[i])) {
							// Handle each locale that isn't a multi-language group item
							const lang = language(locales[i]);
							let appInfo = path.join('resources', locales[i].replace(/-/g, path.sep), 'appinfo.json');
							if (status.alias[i] && status.alias[i].indexOf('multi') === 0) {
								// Locale is part of a multi-language grouping.
								if (
									locales.indexOf(lang) >= 0 ||
									(appInfoOptimize.groups[lang] && appInfoOptimize.groups[lang] !== status.alias[i])
								) {
									// Parent language entry already exists, or the appinfo optimization group for this
									// language points to a different alias, so we can't simplify any further.
									if (locList.indexOf(appInfo) === -1) {
										// Add full locale appinfo entry if not already there.
										locList.push({generate: appInfo});
									}
								} else if (!appInfoOptimize.groups[lang]) {
									// No parent language and no existing appinfo optimization group for this language,
									// so let's create one and simplify the output for the locale.
									appInfoOptimize.groups[lang] = status.alias[i];
									appInfoOptimize.coverage.push(locales[i]);
									appInfo = path.join('resources', lang, 'appinfo.json');
									if (locList.indexOf(appInfo) === -1) {
										locList.push({generate: appInfo});
									}
								}
							} else if (status.alias[i] !== lang && locList.indexOf(appInfo) === -1) {
								// Not aliased, or not aliased to parent language so create appinfo if it does not exist.
								locList.push({generate: appInfo});
							}
						}
					}
				}
				return locList;
			});

			// Update any root appinfo to tag as using prerendering to avoid webOS splash screen.
			// Temporary root value used until webOS parsing of localized appinfo.json boolean values is fixed.
			compilation.hooks.webosMetaRootAppinfo.tap('PrerenderPlugin', meta => {
				if (typeof meta.usePrerendering === 'undefined' && locales.length > 0) {
					meta.usePrerendering = true;
				}
				return meta;
			});

			// For each prerendered target locale's appinfo, update the 'main' value.
			compilation.hooks.webosMetaLocalizedAppinfo.tap('PrerenderPlugin', (meta, info) => {
				let loc = info.locale;
				// Exclude appinfo entries covered by appinfo optimization groups.
				if (appInfoOptimize.coverage.indexOf(loc) === -1) {
					const index = locales.indexOf(loc);
					if (index === -1) {
						// When not found in our target list, fallback to our appinfo optimization groups.
						loc = appInfoOptimize.groups[loc];
					} else if (index >= 0 && status.alias[index]) {
						// Resolve any locale aliases.
						loc = status.alias[index];
					}
					if (loc) {
						meta.main = 'index.' + loc + '.html';
					}
				}
				return meta;
			});

			// Force HtmlWebpackPlugin to use body inject format and set aside the js assets.
			compilation.hooks.htmlWebpackPluginBeforeHtmlProcessing.tapAsync(
				'PrerenderPlugin',
				(htmlPluginData, callback) => {
					htmlPluginData.plugin.options.inject = 'body';
					jsAssets = htmlPluginData.assets.js.map(file => file.path);
					htmlPluginData.assets.js = [];
					callback(null, htmlPluginData);
				}
			);

			// Use the prerendered-startup.js to asynchronously add the js assets at load time and embed that
			// script inline in the HTML head.
			compilation.hooks.htmlWebpackPluginAlterAssetTags.tapAsync(
				'PrerenderPlugin',
				(htmlPluginData, callback) => {
					const startupScriptTag = {
						tagName: 'script',
						closeTag: true,
						attributes: {
							type: 'text/javascript'
						},
						innerHTML: templates.startup(opts.screenTypes, jsAssets)
					};
					const startupPath = 'startup/startup.js';
					if (opts.externalStartup && !compilation.assets[startupPath]) {
						startupScriptTag.attributes.src = startupPath;
						emitAsset(compilation, startupPath, startupScriptTag.innerHTML);
						delete startupScriptTag.innerHTML;
					}
					htmlPluginData.head.unshift(startupScriptTag);
					callback(null, htmlPluginData);
				}
			);

			// Inject prerendered static HTML
			compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tapAsync(
				'PrerenderPlugin',
				(htmlPluginData, callback) => {
					const applyToRoot = rootInjection(htmlPluginData.html);
					Promise.all(
						locales.map((loc, i) => {
							const linked = Object.keys(status.alias).filter(key => status.alias[key] === loc);
							const body = [];
							let mapping;

							if (status.err || !status.prerender[i] || status.alias[i]) return;

							if (linked.length === 0) {
								// Single locale, re-inject root classes and react checksum.
								status.prerender[i] = status.prerender[i]
									.replace(/(<div[^>]*class="[^"]*)"/i, '$1' + status.attr[i].classes + '"')
									.replace(
										/(<div[^>]*data-react-checksum=")"/i,
										'$1' + status.attr[i].checksum + '"'
									);
							} else {
								// Create a mapping of locales and classes
								mapping = linked.reduce(
									(m, c) => Object.assign(m, {[locales[c].toLowerCase()]: status.attr[c]}),
									{}
								);
							}

							// Handle updating of  locales for multi-locale prerenders, along with deeplinking.
							const appHtml = parsePrerender(status.prerender[i]);
							const updater = templates.update(mapping, opts.deep, appHtml.prerender);
							if (opts.deep) appHtml.prerender = '';
							if (updater) {
								const updaterScriptTag = {
									tagName: 'script',
									closeTag: true,
									attributes: {
										type: 'text/javascript'
									}
								};
								if (!opts.externalStartup) {
									updaterScriptTag.innerHTML = updater;
								} else {
									updaterScriptTag.attributes.src = 'startup/' + loc + '.js';
									emitAsset(compilation, updaterScriptTag.attributes.src, updater);
								}
								body.push(updaterScriptTag);
							}

							// Inject app HTML then re-process in HtmlWebpackPlugin for potential minification.
							htmlPluginData.plugin.options.inject = true;
							if (htmlPluginData.plugin.options.minify) {
								// Preserve any React15 HTML comment nodes
								htmlPluginData.plugin.options.minify.removeComments = false;
							}
							return htmlPluginData.plugin
								.postProcessHtml(applyToRoot(appHtml.prerender), {}, {head: appHtml.head, body: body})
								.then(html => {
									if (locales.length === 1) {
										// Only 1 locale, so just output as the default root index.html
										htmlPluginData.html = html;
									} else {
										// Multiple locales, so output as locale-specific html file.
										emitAsset(compilation, 'index.' + loc + '.html', html);
									}
								});
						})
					)
						.then(() => {
							callback(null, htmlPluginData);
						})
						.catch(err => {
							// Avoid misattribution of error to html plugin compiler by assigning error directly.
							compilation.errors.push(err);
							callback(null, htmlPluginData);
						});
				}
			);
		});

		// Report any failed locale prerenders at the compiler level to fail the build,
		// otherwise generate optional locale map asset.
		compiler.hooks.afterCompile.tapAsync('PrerenderPlugin', (compilation, callback) => {
			if (status.err) {
				// @TODO: pretty-print error details
				let message =
					chalk.red(
						chalk.bold('Unable to generate prerender of app state HTML for ' + status.err.locale + ':')
					) + '\n';
				message += status.err.result.stack || status.err.result.message || status.err.result;
				callback(new Error(message));
			} else {
				// Generate a JSON file that maps the locales to their HTML files.
				if (opts.mapfile && locales.length > 1 && isNodeOutputFS(compiler)) {
					const mapper = (m, c, i) =>
						status.alias.includes(c) ? m : Object.assign(m, {[c]: `index.${status.alias[i] || c}.html`});
					const mapping = {fallback: 'index.html', locales: locales.reduce(mapper, {})};
					let out = 'locale-map.json';
					if (typeof opts.mapfile === 'string') {
						out = opts.mapfile;
					}
					emitAsset(compilation, out, JSON.stringify(mapping, null, '\t'));
				}
				callback();
			}
		});
	}
}

// Determine if it's a NodeJS output filesystem or if it's a foreign/virtual one.
function isNodeOutputFS(compiler) {
	return (
		compiler.outputFileSystem &&
		compiler.outputFileSystem.constructor &&
		compiler.outputFileSystem.constructor.name &&
		compiler.outputFileSystem.constructor.name === 'NodeOutputFileSystem'
	);
}

// Determine the desired target locales based of option content.
// Can be a preset like 'tv' or 'signage', 'used' for all used app-level locales, 'all' for
// all locales supported by ilib, a custom json file input, or a comma-separated lists
function parseLocales(context, target) {
	if (!target || target === 'none') {
		return [];
	} else if (Array.isArray(target)) {
		return target;
	} else if (target === 'tv') {
		return JSON.parse(fs.readFileSync(path.join(__dirname, 'locales-tv.json'), {encoding: 'utf8'})).locales;
	} else if (target === 'signage') {
		return JSON.parse(fs.readFileSync(path.join(__dirname, 'locales-signage.json'), {encoding: 'utf8'})).locales;
	} else if (target === 'used') {
		return detectLocales(path.join(context, 'resources', 'ilibmanifest.json'));
	} else if (target === 'all') {
		return detectLocales(path.join('node_modules', '@enact', 'i18n', 'ilib', 'locale', 'ilibmanifest.json'), true);
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

// Simplifies and groups the locales and aliases to ensure minimal output needed.
function simplifyAliases(locales, status) {
	const links = {};
	const sharedCSS = {};
	const common = (a, b) => a.filter(b.includes.bind(b));
	const remove = (targets, classes) =>
		classes
			.split(/\s+/)
			.filter(c => !targets.includes(c))
			.join(' ');
	let multiCount = 1;

	// First pass: simplify alias names to language designations or 'multi' for multi-language groupings.
	// Additionally determines all shared root CSS classes for the groupings.
	for (let i = 0; i < status.alias.length; i++) {
		if (status.alias[i]) {
			const lang = language(locales[i]);
			if (!links[status.alias[i]]) {
				const alias = language(status.alias[i]);
				let regionCount = 0;
				for (const x in links) {
					if (links[x] === alias || links[x].indexOf(alias + '.') === 0) {
						regionCount++;
					}
				}
				links[status.alias[i]] = regionCount > 0 ? alias + '.' + (regionCount + 1) : alias;
			}
			if (links[status.alias[i]].indexOf(lang) !== 0 && links[status.alias[i]].indexOf('multi') !== 0) {
				if (multiCount > 1) {
					links[status.alias[i]] = 'multi.' + multiCount;
				} else {
					links[status.alias[i]] = 'multi';
				}
				multiCount++;
			}

			status.attr[i].classes = status.attr[i].classes || '';
			if (!sharedCSS[status.alias[i]]) {
				sharedCSS[status.alias[i]] = common(
					status.attr[i].classes.split(/\s+/),
					status.attr[locales.indexOf(status.alias[i])].classes.split(/\s+/)
				);
			} else {
				sharedCSS[status.alias[i]] = common(sharedCSS[status.alias[i]], status.attr[i].classes.split(/\s+/));
			}
		}
	}

	// Second pass: with the shared root CSS classes determined, remove from the individual class strings
	// and update the alias names to the new simplified names.
	for (let j = 0; j < status.alias.length; j++) {
		if (status.alias[j]) {
			if (sharedCSS[status.alias[j]]) {
				status.attr[j].classes = remove(sharedCSS[status.alias[j]], status.attr[j].classes);
			}

			if (links[status.alias[j]]) {
				status.alias[j] = links[status.alias[j]];
			}
		}
	}

	// For every grouping processed, create new faux-locale entries to generate html files for, and
	// re-insert the common root CSS classes back into the shared prerendered html code.
	for (const l in links) {
		const index = locales.indexOf(l);
		status.alias[index] = links[l];
		status.attr[index].classes = remove(sharedCSS[l], status.attr[index].classes);
		locales.push(links[l]);
		if (sharedCSS[l] && sharedCSS[l].length > 0) {
			status.prerender[locales.length - 1] = status.prerender[index].replace(
				/(<div[^>]*class="[^"]*)"/i,
				'$1 ' + sharedCSS[l].join(' ') + '"'
			);
		} else {
			status.prerender[locales.length - 1] = status.prerender[index];
		}
		status.prerender[index] = undefined;
	}
}

// Extracts a valid language string from a locale.
function language(locale) {
	const matchLang = locale.match(/\b([a-z]{2})\b/);
	return matchLang && matchLang[1];
}

function rootInjection(html) {
	const rootDiv = findRootDiv(html);
	return function(prerender) {
		if (rootDiv) {
			return rootDiv.before + '<div id="root">' + prerender + '</div>' + rootDiv.after;
		} else {
			throw new Error(
				'PrerenderPlugin: Unable find root div element. Please ' + 'verify it exists within your HTML template.'
			);
		}
	};
}

// Find the location of the root div (can be empty or with contents) and return the
// contents of the HTML before and after it.
function findRootDiv(html, start, end) {
	if (/^<div[^>]+id="root"/i.test(html.substring(start, end + 7))) {
		return {before: html.substring(0, start), after: html.substring(end + 6)};
	}
	const a = html.indexOf('<div', start + 4);
	const b = html.lastIndexOf('</div>', end);
	if (a >= 0 && b >= 0 && a < b) {
		return findRootDiv(html, a, b);
	}
}

// Parse the prerendered HTML to extract any header elements
function parsePrerender(html) {
	const elementParse = /<([^/][^>]*)\/*>([^<]*)/g;
	const head = [];
	const prerender = html.replace(/<!-- head append start -->([\s\S]*)<!-- head append end -->/, (m, content) => {
		let match;
		while ((match = elementParse.exec(content))) {
			const tokens = match[1].split(/\s+/);
			head.push({
				tagName: tokens.shift(),
				closeTag: !match[1].endsWith('/'),
				attributes: tokens.reduce((result, curr) => {
					const [, key, value] = curr.replace(/[/]$/, '').match(/^([^=]*)(?:="(.*)")*/);
					return Object.assign(result, {[key]: value !== undefined ? value : 'true'});
				}, {}),
				innerHTML: match[1].endsWith('/')
					? ''
					: '\n\t\t' + match[2].replace(/^\s+|\s+$/g, '').replace(/\n/g, '\n\t\t') + '\n\t'
			});
		}
		return '';
	});
	return {head, prerender};
}

// Adds a file entry with data to be emitted as an asset.
function emitAsset(compilation, file, data) {
	compilation.assets[file] = {
		size: function() {
			return data.length;
		},
		source: function() {
			return data;
		},
		updateHash: function(hash) {
			return hash.update(data);
		},
		map: function() {
			return null;
		}
	};
}

module.exports = PrerenderPlugin;
