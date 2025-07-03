module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json', './tsconfig.e2e.json'],
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

  ignorePatterns: [
    '.eslintrc.js', 
    'jest.config.js', 
    'webpack-hmr.config.js',
    'dist/**/*',
    'node_modules/**/*'
  ],
  rules: {
    // '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    // '@typescript-eslint/explicit-module-boundary-types': 'off',
    // '@typescript-eslint/no-explicit-any': 'off',
    
    // 未使用変数の警告設定 - DIパターンに優しい設定
    "no-unused-vars": "off", // 基本のルールをオフにする
    "@typescript-eslint/no-unused-vars": ["warn", {
      "vars": "all",
      "args": "after-used",
      "ignoreRestSiblings": true,
      // プライベートクラスプロパティ（コンストラクタインジェクション用）を無視
      "varsIgnorePattern": "^_",
      // コンストラクタパラメータを無視
      "argsIgnorePattern": "^_",
      // クラスプロパティなどの分割代入を無視
      "destructuredArrayIgnorePattern": "^_",
      // キャッチされた例外も同じパターンで無視
      "caughtErrors": "all",
      "caughtErrorsIgnorePattern": "^_"
    }],
    
    "prefer-const": "error",
    // "no-console": "warn",
    "indent": ["error", 2,{"SwitchCase": 1}],
    // "linebreak-style": ["error", "windows"]
  },
  overrides: [
    {
      // 全てのテストファイル（.spec.ts）
      files: ['**/*.spec.ts'],
      parserOptions: {
        project: ['./tsconfig.spec.json']
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
      // E2Eテスト用の設定
      files: ['test/**/*.e2e-spec.ts'],
      parserOptions: {
        project: ['./tsconfig.e2e.json']
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
      // テストディレクトリ内の全てのTypeScriptファイル
      files: ['test/**/*.ts'],
      parserOptions: {
        project: ['./tsconfig.spec.json']
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
      parserOptions: {
        project: ['./tsconfig.spec.json']
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
      parserOptions: {
        project: ['./tsconfig.spec.json']
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
      env: {
        jest: true
      },
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
      files: ['**/services/*.ts', '**/controllers/*.ts', '**/providers/*.ts', '**/guards/*.ts', '**/*.service.ts', '**/*.controller.ts', '**/*.guard.ts', '**/*.strategy.ts','**/*.module.ts','**/*.interface.ts','**/*.model.ts', '**/*.config.ts'],
      rules: {
        // 依存性注入でよく使用されるパターンについての警告を緩和
        '@typescript-eslint/no-unused-vars': ["warn", {
          // クラスプロパティ用 (private readonly someService: SomeService)
          "varsIgnorePattern": "^([a-zA-Z0-9]+)Service$|^([a-zA-Z0-9]+)Repository$|^([a-zA-Z0-9]+)Controller$|^([a-zA-Z0-9]+)Gateway$|^([a-zA-Z0-9]+)Guard$|^([a-zA-Z0-9]+)Strategy$|^([a-zA-Z0-9]+)Interceptor$|^_",
          // 特定のインジェクションパターンを無視
          "argsIgnorePattern": "^_"
        }]
      }
    }
  ]
};
