import globals from 'globals'
import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import pluginJest from 'eslint-plugin-jest'

const featureImportPatterns = ['**/features', '**/features/**']
const domainImportPatterns = ['**/domains', '**/domains/**', '@domains', '@domains/**']

export default defineConfig(
  {
    ignores: ['eslint.config.mjs', 'jest.config.js', 'prettier.config.js', 'webpack-hmr.config.js', 'dist/**/*', 'node_modules/**/*']
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    plugins: { jest: pluginJest },
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.json', 'tsconfig.e2e.json'],
        tsconfigRootDir: import.meta.dirname
      },
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.jest,
        ...pluginJest.environments.globals.globals,
        ...globals.es2015
      }
    },
    rules: {
      ...pluginJest.configs.recommended.rules,
      // '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      // '@typescript-eslint/explicit-module-boundary-types': 'off',
      // '@typescript-eslint/no-explicit-any': 'off',

      // 未使用変数の警告設定 - DIパターンに優しい設定
      'no-unused-vars': 'off', // 基本のルールをオフにする
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: true,
          // プライベートクラスプロパティ（コンストラクタインジェクション用）を無視
          varsIgnorePattern: '^_',
          // コンストラクタパラメータを無視
          argsIgnorePattern: '^_',
          // クラスプロパティなどの分割代入を無視
          destructuredArrayIgnorePattern: '^_',
          // キャッチされた例外も同じパターンで無視
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_'
        }
      ],

      'prefer-const': 'error',
      // "no-console": "warn",
      indent: ['error', 2, { SwitchCase: 1 }],
      // "linebreak-style": ["error", "windows"]

      // --- 本プロジェクト実態に合わせた調整 ---
      // recommendedTypeChecked は厳格すぎるため、本コードベースが意図的に採用している
      // スタイル（any 多用・async シグネチャ統一）由来のルールは無効化する。
      // any 由来の型安全ルール（no-explicit-any を許容する以上、派生の unsafe-* も無効化）
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      // ログ等で `${obj}` を多用するため
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      // async でシグネチャを揃える方針のため await 無しを許容
      '@typescript-eslint/require-await': 'off',

      // --- 潜在的バグは error で止めず warn で可視化する ---
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      // メソッド参照（DI・イベント登録・jest mock 参照）を多用するため warn に留める
      '@typescript-eslint/unbound-method': 'warn',

      // --- 本プロジェクトで意図的に使われるパターンは warn（可視・非ブロック）に ---
      '@typescript-eslint/no-require-imports': 'warn', // JSON/CJS 連携での require
      'no-empty': 'warn', // 意図的な空 catch 等
      '@typescript-eslint/no-namespace': 'warn', // 既存の namespace 利用
      'jest/no-conditional-expect': 'warn' // 一部 spec の実用的な条件付き expect
    }
  },
  {
    files: ['src/core/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: featureImportPatterns,
              message: 'core から features への依存は禁止です。ARCHITECTURE.md §4 を参照してください'
            },
            {
              group: domainImportPatterns,
              message: 'core から domains への依存は禁止です。ARCHITECTURE.md §4 を参照してください'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/domains/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: featureImportPatterns,
              message: 'domains から features への依存は禁止です。ARCHITECTURE.md §4 を参照してください'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/events/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    // features パターンだけなのは意図的な非対称。events → domains は ARCHITECTURE.md §4 の表で
    // 許可された辺（events.module.ts が domains/character を参照）で、domains を足すと即 error になる
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: featureImportPatterns,
              message: 'events core から features への依存は禁止です。ARCHITECTURE.md §4 を参照してください'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/discord/interactions/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: featureImportPatterns,
              message: 'interactions core から features への依存は禁止です。ARCHITECTURE.md §4 を参照してください'
            }
          ]
        }
      ]
    }
  },
  {
    // 全てのテストファイル（.spec.ts）
    files: ['**/*.spec.ts'],
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.spec.json']
      },
      globals: {
        ...globals.jest,
        ...pluginJest.environments.globals.globals
      }
    },
    rules: {
      ...pluginJest.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error'
    }
  },
  {
    // E2Eテスト用の設定
    files: ['test/**/*.e2e-spec.ts'],
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.e2e.json']
      },
      globals: {
        ...globals.jest,
        ...pluginJest.environments.globals.globals
      }
    },
    rules: {
      ...pluginJest.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'error',
      'jest/no-identical-title': 'error',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-expect': 'error'
    }
  },
  {
    // テストディレクトリ内の全てのTypeScriptファイル
    files: ['test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.spec.json']
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'no-console': 'off'
    }
  },
  {
    // モックファイル
    files: ['**/*.mock.ts', '**/*mock*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.spec.json']
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    // ファクトリーファイル
    files: ['**/*.factory.ts', '**/*factory*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['tsconfig.spec.json']
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off'
    }
  },
  {
    // テストヘルパー・ユーティリティファイル
    files: ['**/*helper*.ts', '**/*util*.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...pluginJest.environments.globals.globals
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'jest/no-standalone-expect': 'off',
      'jest/no-jasmine-globals': 'off',
      'jest/valid-title': 'off'
    }
  },
  {
    // 認証関連ファイル（外部ライブラリとの接続でany使用が必要）
    files: ['**/auth/**/*.ts', '**/*.strategy.ts', '**/discord.service.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off'
    }
  },
  {
    // NestJSの依存性注入を使ったファイルパターン
    files: [
      '**/services/*.ts',
      '**/controllers/*.ts',
      '**/providers/*.ts',
      '**/guards/*.ts',
      '**/*.service.ts',
      '**/*.controller.ts',
      '**/*.guard.ts',
      '**/*.strategy.ts',
      '**/*.module.ts',
      '**/*.interface.ts',
      '**/*.model.ts',
      '**/*.config.ts'
    ],
    rules: {
      // 依存性注入でよく使用されるパターンについての警告を緩和
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          // クラスプロパティ用 (private readonly someService: SomeService)
          varsIgnorePattern:
            '^([a-zA-Z0-9]+)Service$|^([a-zA-Z0-9]+)Repository$|^([a-zA-Z0-9]+)Controller$|^([a-zA-Z0-9]+)Gateway$|^([a-zA-Z0-9]+)Guard$|^([a-zA-Z0-9]+)Strategy$|^([a-zA-Z0-9]+)Interceptor$|^_',
          // 特定のインジェクションパターンを無視
          argsIgnorePattern: '^_'
        }
      ]
    }
  },
  {
    // テスト系ファイルでは unbound-method を無効化（jest の expect(mock.method)・
    // DI/イベント登録のメソッド参照が大量に該当し、実害がないため）
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'test/**/*.ts', '**/*.mock.ts', '**/*mock*.ts', '**/*.factory.ts', '**/*factory*.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off'
    }
  },
  eslintConfigPrettier
)
