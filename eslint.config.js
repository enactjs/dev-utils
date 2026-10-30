const enactConfig = require('eslint-config-enact');
const prettierConfig = require('eslint-config-prettier');
const importPlugin = require('eslint-plugin-import');
const prettierPlugin = require('eslint-plugin-prettier');
const globals = require('globals');

module.exports = [
	...enactConfig,
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				...globals.node
			},
			parserOptions: {
				ecmaFeatures: {
					jsx: true
				}
			}
		},
		plugins: {
			import: importPlugin,
			prettier: prettierPlugin
		},
		ignores: ['plugins/SnapshotPlugin/snapshot-helper.js', 'plugins/SnapshotPlugin/mock-window.js'],
		rules: {
			// import plugin rules
			// `chalk` is ESM-only and, since v6, ships a conditional `exports`
			// map that eslint-import-resolver-node (used by eslint-plugin-import)
			// cannot resolve, producing false `import/no-unresolved` errors for
			// our dynamic `import('chalk')` calls. The import resolves fine at
			// runtime, so ignore it here.
			'import/no-unresolved': ['error', {commonjs: true, caseSensitive: true, ignore: ['^chalk$']}],
			'import/named': 'error',
			'import/first': 'warn',
			'import/no-duplicates': 'error',
			'import/extensions': ['warn', 'always', {js: 'never', json: 'always'}],
			'import/newline-after-import': 'warn',
			'import/order': [
				'warn',
				{
					'newlines-between': 'never',
					groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index']
				}
			],

			// prettier rules
			...prettierPlugin.configs.recommended.rules,
			...prettierConfig.rules
		}
	}
];
