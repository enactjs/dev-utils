/* eslint-disable prettier/prettier */

const fn = (js) => js && `
		(function() {
			${js.replace(/\n/g, '\n\t\t')}
		})();
	`;

const startup = (screenTypes, jsAssets) => `
	// Initialize font scaling for resolution independence.
	var screenTypes = ${JSON.stringify(screenTypes)} || [];
	var defaultType = {name: 'standard', pxPerRem: 16, width: window.innerWidth, height: window.innerHeight, aspectRatioName: 'standard', base: true};
	if(screenTypes.length===0) {
		screenTypes.push(defaultType);
	}
	var height = window.innerHeight,
		width = window.innerWidth;
	var scrObj = screenTypes[screenTypes.length - 1];
	var orientation = 'landscape';
	if(height > width) {
		orientation = 'portrait';
		height = window.innerWidth;
		width = window.innerHeight;
	}
	for(var i=screenTypes.length-1; i>=0; i--) {
		if(height <= screenTypes[i].height && width <= screenTypes[i].width) {
			scrObj = screenTypes[i];
		}
	}
	document.documentElement.style.fontSize = scrObj.pxPerRem + 'px';

	// Function to apply root resolution classes
	window.resolutionClasses = function(className) {
		return className
				.replace(/enact-orientation-\\S*/, 'enact-orientation-' + orientation)
				.replace(/enact-res-\\S*/, 'enact-res-' + scrObj.name.toLowerCase())
				.replace(/enact-aspect-ratio-\\S*/, 'enact-aspect-ratio-' + scrObj.aspectRatioName.toLowerCase());
	};

	window.onload = function() { setTimeout(function() {
		if(typeof App === 'undefined') {
			// Add script nodes, loading the chunks sequentially.
			var appendScripts = function(js) {
				if(js.length>0) {
					var src = js.shift();
					var script = document.createElement('script');
					script.type = 'text/javascript';
					script.src = src;
					script.onload = function() {
						appendScripts(js);
					};
					document.body.appendChild(script);
				}
			};
			appendScripts(${JSON.stringify(jsAssets)});
		} else {
			// V8 snapshot, so update the javascript environment then render.
			if(typeof updateEnvironment === 'function') {
				updateEnvironment();
			}
			if(typeof App === 'object' && (typeof ReactDOM === 'object')) {
				ReactDOM.render(App['default'] || App, document.getElementById('root'));
			} else {
				console.log('ERROR: Snapshot app not found');
			}
		}
	}, 0); };
`;

const resolution = (after) => `
	// Update resolution classes
	var reactRoot = document.getElementById("root").children[0];
	if(window.resolutionClasses && reactRoot) {
		reactRoot.className = window.resolutionClasses(reactRoot.className);
		delete window.resolutionClasses;
	}
	${after ? after.replace(/\n/g, '\n\t') : ''}
`;

const deepLink = (conditions, prerender, wrapped) => conditions ? `
	// Handle any deep link conditions.
	if(!(${(Array.isArray(conditions) ? conditions.join(' && ') : conditions)})) {
		document.getElementById("root").innerHTML = ${JSON.stringify(prerender)};
		${wrapped ? wrapped.replace(/\n/g, '\n\t') : ''}
	}
` : (wrapped || null);

const multiLocale = (mapping) => mapping && `
	// Apply locale-specific root classes and checksum.
	var details = ${JSON.stringify(mapping, null, '\t').replace(/\n/g, '\n\t')};
	var lang = navigator.language.toLowerCase();
	var conf = details[lang] || details[lang.substring(0, 2)];
	if(conf && reactRoot) {
		reactRoot.className += ' ' + conf.classes;
		reactRoot.setAttribute("data-react-checksum", conf.checksum);
	}
`;

module.exports = {
	// Startup inline script, which initializes the window scaling and loads the app.
	startup: (screenTypes, jsAssets) => fn(startup(screenTypes, jsAssets)),
	// Update inline script, which updates the template/prerender content prior to app render.
	// Used for locale and deeplinking customizations.
	update: (mapping, deep, prerender) => fn(deepLink(deep, prerender, resolution(multiLocale(mapping))))
};
