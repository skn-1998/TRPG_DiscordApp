import { TypeOrmModuleOptions } from '@nestjs/typeorm'
import * as dotenv from 'dotenv'

// 環境変数を読み込む
dotenv.config()

// テスト用のデータベース設定
export const testDbConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.TEST_DB_NAME || 'trpg_test_db', // テスト用のデータベース名
  entities: ['src/**/*.model.ts', 'src/**/*.entity.ts'],
  synchronize: true, // テスト環境では自動マイグレーションを有効化
  logging: false // テスト環境ではロギングを無効化
}
