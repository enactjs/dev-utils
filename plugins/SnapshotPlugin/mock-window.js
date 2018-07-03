/* eslint no-var: off, prettier/prettier: off */
/*
 *  mock-window.js
 *
 *  A helper utility meant to simulate a basic window object for ReactDOM usage during snapshot execution.
 */

var orig = {}, listeners = [], nop = function() {};
var defer = function() {
	var objPath = arguments;
	var deferred = function() {
		var ctx = global;
		var key = objPath[objPath.length - 1];
		for(var i = 0; i < objPath.length - 1; i++) {
			ctx = ctx[objPath[i]];
			if (!ctx) return;
		}
		if (ctx[key] && ctx[key] !== deferred) {
			return ctx[key].apply(ctx, arguments);
		}
	};
	return deferred;
};
var mock = {
	CompositionEvent: nop,
	TextEvent: nop,
	addEventListener: function() {
		listeners.push({args: Array.prototype.slice.call(arguments)});
	},
	document: {
		addEventListener: function() {
			listeners.push({doc: true, args: Array.prototype.slice.call(arguments)});
		},
		createElement: function() {
			return {style: {}};
		},
		documentElement: {
			textContent: '',
			style: {
				cssFloat: ''
			}
		},
		onchange: null,
		oninput: null,
		onwheel: null,
		onmousewheel: null,
		onscroll: null,
		onfocus: null,
		removeEventListener: nop
	},
	implementation: {
		hasFeature: function() {
			return true;
		}
	},
	location: {
		protocol: 'http:'
	},
	navigator: {
		userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36'
	},
	setTimeout: defer('setTimeout'),
	clearTimeout: defer('clearTimeout'),
	performance: {
		now: defer('performance', 'now')
	},
	requestAnimationFrame: defer('requestAnimationFrame'),
	console: {
		log: defer('console', 'log'),
		warn: defer('console', 'warn'),
		error: defer('console', 'error'),
		debug: defer('console', 'debug'),
		time: defer('console', 'time'),
		timeEnd: defer('console', 'timeEnd')
	}
};
mock.window = mock.self = mock;

module.exports = {
	activate: function() {
		for (var x in mock) {
			orig[x] = global[x];
			global[x] = mock[x];
		}
	},
	deactivate: function() {
		for (var x in mock) {
			if (orig[x]) {
				global[x] = orig[x];
			} else {
				delete global[x];
			}
		}
	},
	attachListeners: function(realWindow) {
		if (realWindow) {
			for (var i = 0; i < listeners.length; i++) {
				if (listeners[i].doc) {
					realWindow.document.addEventListener.apply(null, listeners[i].args);
				} else {
					realWindow.addEventListener.apply(null, listeners[i].args);
				}
			}
		}
	}
};
