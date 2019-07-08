const fs = require('fs');

function FileXHR() {}

FileXHR.prototype.open = function(method, uri, async) {
	this.method = method;
	this.uri = uri;
	this.sync = async === false;
};

FileXHR.prototype.addEventListener = function(evt, fn) {
	this['on' + evt] = fn;
};

FileXHR.prototype.send = function() {
	if (this.method.toUpperCase() === 'GET' && this.uri && this.sync) {
		if (process.env.ILIB_BASE_PATH) {
			// Backward compatability for old iLib location
			if (/i18n[/\\]ilib[/\\]*$/.test(process.env.ILIB_BASE_PATH)) {
				this.uri = this.uri.replace(
					new RegExp('^' + process.env.ILIB_BASE_PATH),
					'node_modules/@enact/i18n/ilib'
				);
			} else {
				this.uri = this.uri.replace(new RegExp('^' + process.env.ILIB_BASE_PATH), 'node_modules/ilib');
			}
		}
		const parsedURI = this.uri.replace(/\\/g, '/').replace(/^(_\/)+/g, match => match.replace(/_/g, '..'));
		try {
			if (!fs.existsSync(parsedURI)) throw new Error('File not found: ' + this.uri);

			this.response = this.responseText = fs.readFileSync(parsedURI, {encoding: 'utf8'});
			this.status = 200;
			this.onload && this.onload();
		} catch (e) {
			this.status = 404;
			this.onerror && this.onerror(e.message || e);
		}
	}
};

module.exports = FileXHR;
