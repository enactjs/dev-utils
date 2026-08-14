/*
 *  framework-libraries.js
 *
 *  The list of `@enact/*` packages that are build/dev tooling rather than
 *  runtime application code — excluded from framework specifier discovery
 *  (mixins/vite-framework.js's `enumerateSpecifiers`) and from the
 *  `isFrameworkSpec` predicate on the app-build side (esbuild-externals.js,
 *  and its Vite counterpart's own copy of the same check).
 */
const nonRuntimeEnactPackages = [
	'cli',
	'dev-utils',
	'docs-utils',
	'storybook-utils',
	'ui-test-utils',
	'screenshot-test-utils'
];

module.exports = {nonRuntimeEnactPackages};