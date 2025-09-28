const js = require('@eslint/js');
const { FlatCompat } = require('@eslint/eslintrc');
const typescript = require('@typescript-eslint/eslint-plugin');
const typescriptParser = require('@typescript-eslint/parser');
const globals = require('globals');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  js.configs.recommended,
  
  // TypeScript設定
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      }],
      'prefer-const': 'error',
      'no-console': 'warn',
      '@typescript-eslint/no-namespace': 'off',
      indent: ['error', 2, { SwitchCase: 1 }],
    },
  },

  // テストファイル設定
  {
    files: ['**/*.spec.ts', '**/*.test.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'no-console': 'off',
    },
  },

  // NestJS特有のパターン用設定
  {
    files: [
      '**/*.service.ts',
      '**/*.controller.ts',
      '**/*.module.ts',
      '**/*.guard.ts',
      '**/*.strategy.ts',
    ],
    languageOptions: {
      parser: typescriptParser,
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        varsIgnorePattern: '^([a-zA-Z0-9]+)(Service|Repository|Controller|Gateway|Guard|Strategy|Interceptor)$|^_',
        argsIgnorePattern: '^_',
      }],
    },
  },

  // 除外設定
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'jest.config.js',
      'webpack-hmr.config.js',
      'src/DB/**/*',
      'src/domains/discord/**/*',
    ],
  },
];