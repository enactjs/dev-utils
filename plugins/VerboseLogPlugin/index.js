'use strict';

const path = require('path');
const {constructor: Chalk} = require('chalk');
const {ProgressPlugin} = require('webpack');

class VerboseLogPlugin {
	constructor(options = {}) {
		this.options = options;
		this.options.stream = this.options.stream || process.stdout;
	}

	apply(compiler) {
		const columns = this.options.stream.isTTY && this.options.stream.columns;
		const chalk = new Chalk({enabled: !!this.options.stream.isTTY});
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
				const prefix = chalk.magenta(padPercent(Math.round(percent * 100))) + ' ';
				let output = append('', message, columns && columns - 5);
				if (details) output = append(output, details, columns && columns - 5);
				if (file) output = append(output, file, columns && columns - 5, chalk.gray);
				this.options.stream.write(prefix + output + '\n');
				active = file;
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

		new ProgressPlugin((percent, message, details, extra, idx) => {
			let file;
			if (idx) file = ' ' + sanitizeName(idx);
			update({percent, message, details, file});
		}).apply(compiler);

		compiler.hooks.compilation.tap('VerboseLogPlugin', compilation => {
			if (compilation.hooks.prerenderChunk) {
				compilation.hooks.prerenderChunk.tap('VerboseLogPlugin', () => {
					update({
						percent: 0.885,
						message: 'prerendering chunk to HTML'
					});
				});
			}
		});

		if (compiler.hooks.v8Snapshot) {
			compiler.hooks.v8Snapshot.tap('VerboseLogPlugin', () => {
				update({
					percent: 0.97,
					message: 'generating v8 snapshot blob'
				});
			});
		}
	}
}

module.exports = VerboseLogPlugin;
