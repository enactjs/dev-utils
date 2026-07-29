// Shared constants for the framework/externals mixins (webpack `framework.js` +
// `externals.js` and the Vite `vite-framework.js`). The build ALGORITHMS differ per
// bundler (webpack DLL vs Vite import map), but these library lists are common.

// @enact packages that are build/test tooling — never part of the runtime framework
// bundle (excluded from the framework glob / specifier enumeration).
const nonRuntimeEnactPackages = [
	'dev-utils',
	'docs-utils',
	'storybook-utils',
	'ui-test-utils',
	'screenshot-test-utils'
];

// The react packages bundled into / externalized to the shared framework.
const reactLibraries = ['react', 'react-dom', 'react-dom/client', 'react-dom/server'];

module.exports = {
	nonRuntimeEnactPackages,
	reactLibraries
};
