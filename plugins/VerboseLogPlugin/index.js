'use strict';

const path = require('path');

class VerboseLogPlugin {
	constructor(options = {}) {
		this.options = options;
		this.options.stream = this.options.stream || process.stdout;
	}

	apply(compiler) {
		const opts = this.options;
		const columns = this.options.stream.isTTY && this.options.stream.columns;
		let chalk;
		import('chalk')
			.then(({Chalk}) => {
				chalk = new Chalk({level: this.options.stream.isTTY ? 1 : 0});
			})
			.catch(err => {
				console.error('ERROR: ' + err.message);
				process.exit(1);
			});
		let active;
		const padPercent = val => val + '%' + ' '.repeat(val.length - 3);

		const append = (base, content, limit, transform = o => o) => {
			const test = base + ' ' + content;
			if (limit && test.length > limit) {
				return base + ' ' + transform(content.substring(0, limit - base.length - 1));
			} else {
				return base + ' ' + transform(content);
			}
		};

		const update = ({percent, message, details, file}) => {
			if (active !== file || !file) {
				if (chalk) {
					const prefix = chalk.magenta(padPercent(Math.round(percent * 100))) + ' ';
					let output = append('', message, columns && columns - 5);
					if (details) output = append(output, details, columns && columns - 5);
					if (file) output = append(output, file, columns && columns - 5, chalk.gray);
					this.options.stream.write(prefix + output + '\n');
					active = file;
				} else {
					setTimeout(() => update({percent, message, details, file}), 0);
				}
			}
		};

		const sanitizeName = file => {
			let i = file.lastIndexOf('!');
			if (i >= 0) file = file.substring(i + 1);
			if (compiler.context) file = path.relative(compiler.context, file);
			file = file.replace(/\\/g, '/');
			i = file.lastIndexOf('node_modules/');
			if (i >= 0) file = file.substring(i + 13);
			return file;
		};

		new compiler.webpack.ProgressPlugin((percent, message, details, extra, idx) => {
			let file;
			if (idx) file = ' ' + sanitizeName(idx);
			update({percent, message, details, file});
		}).apply(compiler);

		compiler.hooks.compilation.tap('VerboseLogPlugin', compilation => {
			if (opts.prerenderPlugin) {
				const prerenderPluginHooks = opts.prerenderPlugin.getHooks(compilation);
				prerenderPluginHooks.prerenderChunk.tap('VerboseLogPlugin', () => {
					update({
						percent: 0.92,
						message: 'prerendering chunk to HTML'
					});
				});
			}
			if (opts.snapshotPlugin) {
				const snapshotPluginHooks = opts.snapshotPlugin.getHooks(compilation);
				snapshotPluginHooks.v8Snapshot.tap('VerboseLogPlugin', () => {
					update({
						percent: 0.98,
						message: 'generating v8 snapshot blob'
					});
				});
			}
		});
	}
}

module.exports = VerboseLogPlugin;
