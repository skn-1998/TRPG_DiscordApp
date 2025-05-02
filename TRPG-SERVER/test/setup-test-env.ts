import * as dotenv from 'dotenv'
import * as path from 'path'

// テスト用の環境変数を読み込む
dotenv.config({
  path: path.resolve(__dirname, '.env.test')
})

// テスト環境固有の設定があれば追加
process.env.NODE_ENV = 'test'
process.env.MONGO_URI = 'mongodb://localhost:27017/trpg_test_db'

console.log('テスト環境をセットアップしました')
console.log(`データベース: ${process.env.TEST_DB_NAME || 'trpg_test_db'}`)
