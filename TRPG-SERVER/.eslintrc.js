module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    // 'plugin:prettier/recommended',
    "prettier"
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    "es6": true // ECMAScript 6の機能を有効にする
  },

  ignorePatterns: ['.eslintrc.js'],
  rules: {
    // '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'warn',
    // '@typescript-eslint/explicit-module-boundary-types': 'off',
    // '@typescript-eslint/no-explicit-any': 'off',
    "no-unused-vars": "warn",
    "prefer-const": "error",
    // "no-console": "warn",
    "indent": ["error", 2,{"SwitchCase": 1}],
    // "linebreak-style": ["error", "windows"]
  },
};
