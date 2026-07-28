import globals from 'globals'
import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import pluginReactHooks from 'eslint-plugin-react-hooks'
import pluginJsxA11y from 'eslint-plugin-jsx-a11y'
import importPlugin from 'eslint-plugin-import'
import eslintConfigPrettier from 'eslint-config-prettier/flat'

export default defineConfig(
  {
    ignores: [
      'node_modules/**',
      'build/**',
      'dist/**',
      'coverage/**',
      '.cache/**',
      'public/**',
      'pnpm-lock.yaml',
      '!**/.server/**',
      '!**/.client/**'
    ]
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022
      }
    }
  },
  {
    files: ['app/config/**/*.{ts,tsx}', 'app/lib/api-client.ts'],
    languageOptions: {
      globals: {
        process: 'readonly'
      }
    }
  },
  {
    files: ['vite.config.mjs', 'eslint.config.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['jest.config.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        ...globals.node
      }
    }
  },
  // React
  {
    files: ['**/*.{js,jsx,mjs,cjs,ts,tsx}'],
    plugins: {
      react: pluginReact,
      'jsx-a11y': pluginJsxA11y,
      'react-hooks': pluginReactHooks
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReact.configs['jsx-runtime'].rules,
      ...pluginJsxA11y.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/no-danger': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      },
      formComponents: ['Form'],
      linkComponents: [
        { name: 'Link', linkAttribute: 'to' },
        { name: 'NavLink', linkAttribute: 'to' }
      ],
      'import/resolver': {
        typescript: {}
      }
    }
  },
  // Typescript
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@trpg/api-contract',
              allowImportNames: [
                'SuccessEnvelope',
                'ErrorEnvelope',
                'LoginDataWire',
                'CharacterDeleteResultWire',
                'CharacterHubStatusWire',
                'CharacterSummaryWire',
                'CharacterWire',
                'CreateCharacterFromTemplateResultWire',
                'DiscordGuildWire',
                'DiscordGuildsPayloadWire',
                'SaveCharacterSheetResultWire',
                'UserProfileWire'
              ],
              message: '永続化スキーマは front で使用禁止。HTTP 応答には公開済みの wire 型だけを使用する'
            }
          ],
          patterns: [
            {
              group: ['@trpg/api-contract/*'],
              message: '契約パッケージはルートからのみ import する'
            }
          ]
        }
      ]
    },
    settings: {
      'import/internal-regex': '^~/',
      'import/resolver': {
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx']
        },
        typescript: {
          alwaysTryTypes: true
        }
      }
    }
  },
  // 追加ルール
  {
    rules: {
      'no-console': 'warn',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-unused-vars': 'off',
      'prefer-const': 'error',
      indent: ['error', 2, { SwitchCase: 1 }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-unresolved': 'off',
      'import/no-relative-parent-imports': 'off'
    }
  },
  eslintConfigPrettier
)
