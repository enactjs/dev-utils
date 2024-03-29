const fs = require('graceful-fs');

const replaceable = ['mkdir', 'rmdir', 'unlink', 'writeFile'];

class GracefulFsPlugin {
	constructor(options = {writeFile: true}) {
		this.options = options;
	}

	apply(compiler) {
		compiler.hooks.afterEnvironment.tap('GracefulFsPlugin', () => {
			if (compiler.outputFileSystem && JSON.stringify(compiler.outputFileSystem) === JSON.stringify(fs)) {
				for (let i = 0; i < replaceable.length; i++) {
					if (this.options[replaceable[i]] && compiler.outputFileSystem[replaceable[i]]) {
						compiler.outputFileSystem[replaceable[i]] = fs[replaceable[i]].bind(fs);
					}
				}
			}
		});
	}
}

module.exports = GracefulFsPlugin;
