const fs = require('graceful-fs');

const replaceable = ['mkdir', 'rmdir', 'unlink', 'writeFile'];

function GracefulFsPlugin(options) {
	this.options = options || {writeFile: true};
}

module.exports = GracefulFsPlugin;
GracefulFsPlugin.prototype.apply = function(compiler) {
	const opts = this.options;
	compiler.plugin('after-environment', () => {
		if (
			compiler.outputFileSystem &&
			compiler.outputFileSystem.constructor &&
			compiler.outputFileSystem.constructor.name === 'NodeOutputFileSystem'
		) {
			for (let i = 0; i < replaceable.length; i++) {
				if (opts[replaceable[i]] && compiler.outputFileSystem[replaceable[i]]) {
					compiler.outputFileSystem[replaceable[i]] = fs[replaceable[i]].bind(fs);
				}
			}
		}
	});
};
