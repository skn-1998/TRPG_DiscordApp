import { setupTestEnvironment } from './config/test-environment'

// テスト環境の設定を実行
setupTestEnvironment()

console.log('テスト環境をセットアップしました')
console.log(`NODE_ENV: ${process.env.NODE_ENV}`)
console.log(`データベース: ${process.env.TEST_DB_NAME || 'trpg_test_db'}`)
console.log(`MONGODB_URI: ${process.env.MONGODB_URI ? 'Atlas URI設定済み' : 'localhost fallback'}`)
console.log(`Discord モック: ${process.env.TEST_MOCK_DISCORD}`)
console.log(`データベース モック: ${process.env.TEST_MOCK_DATABASE}`)
console.log(`ログ抑制: ${process.env.TEST_SUPPRESS_LOGS}`)
