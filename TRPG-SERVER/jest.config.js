module.exports = {
  // テスト環境の設定
  testEnvironment: 'node',
  
  // ファイル拡張子
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // テストファイルのパターン
  testRegex: '.*\\.spec\\.ts$',
  
  // TypeScript変換
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: 'tsconfig.spec.json'
    }]
  },
  
  // モジュールパスマッピング
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^test/(.*)$': '<rootDir>/test/$1'
  },
  
  // セットアップファイル
  setupFilesAfterEnv: [
    '<rootDir>/test/setup-test-env.ts',
    '<rootDir>/test/utils/jest-setup.ts'
  ],
  
  // カバレッジ設定
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/**/*.spec.ts',
    '!src/**/*.e2e-spec.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.model.ts',
    '!src/main.ts',
    '!src/**/*module.ts'
  ],
  
  // カバレッジ閾値
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/utils/error-handler.ts': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/domains/auth/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // カバレッジレポート形式
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  // テストタイムアウト
  testTimeout: 10000,
  
  // 並列実行設定
  maxWorkers: '50%',
  
  // 詳細出力
  verbose: true,
  
  // エラー時の詳細表示
  errorOnDeprecated: true,
  
  // クリアモック
  clearMocks: true,
  restoreMocks: true,
  
  // グローバル設定
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.spec.json'
    }
  }
} 