module.exports = {
	root: true,
	env: {
		browser: true,
		node: true,
	},
	extends: [
		'@hakatashi',
	],
	rules: {
		'node/no-unsupported-features': 'off',
		'node/no-unsupported-features/es-syntax': 'off',
		'array-plural/array-plural': ['error', {
			allows: ['array', 'list', 'group', 'table'],
		}],
	},
	globals: {},
};
