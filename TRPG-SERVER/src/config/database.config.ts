import { registerAs } from '@nestjs/config'
import { env } from './environment'

/**
 * データベース関連の設定
 */
export const DatabaseConfig = registerAs('database', () => ({
  /**
   * MongoDB接続URI
   */
  mongoUri: env.MONGODB_URI,

  /**
   * 接続オプション
   */
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true
  },

  /**
   * コレクション設定
   */
  collections: {
    user: 'trpg-usertable',
    character: 'trpg-charactertable'
  }
}))
