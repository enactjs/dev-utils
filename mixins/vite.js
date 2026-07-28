const path = require('path');

// Vite counterpart to the webpack `mixins.apply`. Given a resolved Vite `InlineConfig`
// and the CLI `opts`, applies the small build-shaping flags that don't belong in the
// base config factory: `--no-minify`, `--verbose`, and `--stats`. Mirrors the webpack
// mixins (unmangled.js, verbose.js, stats.js)
module.exports = {
	apply: function (config, opts = {}) {
		config.plugins = config.plugins || [];

		// --no-minify (private): keep Terser's optimizations/dead-code removal but
		// disable mangling and beautify the output for readability. Mirrors the webpack
		// `unmangled` mixin. Only meaningful when the build actually minifies (production);
		// a development build is already unminified, so leave it untouched.
		if (opts.minify === false && config.build && config.build.minify) {
			config.build.minify = 'terser';
			config.build.terserOptions = Object.assign({}, config.build.terserOptions, {
				mangle: false,
				compress: true,
				format: Object.assign({beautify: true, comments: true}, (config.build.terserOptions || {}).format)
			});
		}

		// --verbose: raise Vite's log level and log build-phase transitions with a running
		// module count. Rollup doesn't know the total module count up front, so unlike the
		// webpack ProgressPlugin there's no percentage; module counts are the honest analog.
		if (opts.verbose) {
			config.logLevel = 'info';
			config.plugins.push(verbosePlugin());
		}

		// --stats: emit a static bundle-analysis treemap next to the build output
		// (webpack: webpack-bundle-analyzer's BundleAnalyzerPlugin -> stats.html).
		if (opts.stats) {
			let visualizer;
			try {
				({visualizer} = require('rollup-plugin-visualizer'));
			} catch (e) {
				console.log(
					'NOTICE: --stats requires the "rollup-plugin-visualizer" package, which is not ' +
						'installed; skipping bundle analysis.'
				);
				return config;
			}
			const outDir = (config.build && config.build.outDir) || 'dist';
			config.plugins.push(
				visualizer({
					filename: path.join(outDir, 'stats.html'),
					title: 'Enact bundle analysis',
					template: 'treemap',
					open: false,
					gzipSize: true,
					brotliSize: true
				})
			);
		}

		return config;
	}
};

// Lightweight Rollup/Vite plugin that narrates the build phases when `--verbose` is set.
function verbosePlugin() {
	let modules = 0;
	return {
		name: 'enact-vite-verbose',
		apply: 'build',
		buildStart() {
			modules = 0;
			console.log('[verbose] build start — resolving & transforming modules…');
		},
		moduleParsed() {
			modules++;
		},
		renderStart() {
			console.log(`[verbose] render start — ${modules} modules parsed, generating chunks…`);
		},
		generateBundle(options, bundle) {
			console.log(`[verbose] emitting ${Object.keys(bundle).length} output file(s)…`);
		}
	};
}
