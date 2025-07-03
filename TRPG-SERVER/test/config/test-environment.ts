// テスト環境設定
export const testEnvironment = {
  // データベース設定
  database: {
    mongo: {
      uri: 'mongodb://localhost:27017/trpg_test_db',
      dbName: 'trpg_test_db'
    }
  },

  // 認証設定
  auth: {
    jwt: {
      secret: 'test-jwt-secret-key-for-testing-only',
      expiresIn: '1h'
    },
    discord: {
      clientId: 'test-discord-client-id',
      clientSecret: 'test-discord-client-secret',
      redirectUri: 'http://localhost:3000/auth/discord/callback',
      botToken: 'test-discord-bot-token'
    }
  },

  // テスト特有の設定
  test: {
    timeout: 10000,
    mockDiscord: true,
    mockDatabase: true,
    suppressLogs: true
  }
}

// 環境変数設定用のヘルパー関数
export function setupTestEnvironment() {
  // テスト環境の環境変数を設定
  process.env.NODE_ENV = 'test'
  process.env.MONGO_URI = testEnvironment.database.mongo.uri
  process.env.TEST_DB_NAME = testEnvironment.database.mongo.dbName

  process.env.JWT_SECRET = testEnvironment.auth.jwt.secret
  process.env.JWT_EXPIRES_IN = testEnvironment.auth.jwt.expiresIn

  process.env.DISCORD_CLIENT_ID = testEnvironment.auth.discord.clientId
  process.env.DISCORD_CLIENT_SECRET = testEnvironment.auth.discord.clientSecret
  process.env.DISCORD_REDIRECT_URI = testEnvironment.auth.discord.redirectUri
  process.env.DISCORD_BOT_TOKEN = testEnvironment.auth.discord.botToken

  // 必須環境変数（environment.schema.ts から）
  process.env.TOKEN = testEnvironment.auth.discord.botToken
  process.env.DISCORD_APPLICATIONID = testEnvironment.auth.discord.clientId
  process.env.DISCORD_SECRET = testEnvironment.auth.discord.clientSecret
  process.env.MONGODB_URI = testEnvironment.database.mongo.uri
  process.env.DISCORD_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-32-characters-long'

  process.env.TEST_TIMEOUT = testEnvironment.test.timeout.toString()
  process.env.TEST_MOCK_DISCORD = testEnvironment.test.mockDiscord.toString()
  process.env.TEST_MOCK_DATABASE = testEnvironment.test.mockDatabase.toString()
  process.env.TEST_SUPPRESS_LOGS = testEnvironment.test.suppressLogs.toString()
}

// テスト環境のリセット
export function resetTestEnvironment() {
  // 主要な環境変数をリセット
  delete process.env.NODE_ENV
  delete process.env.MONGO_URI
  delete process.env.TEST_DB_NAME
  delete process.env.JWT_SECRET
  delete process.env.DISCORD_CLIENT_ID
  delete process.env.DISCORD_CLIENT_SECRET
  delete process.env.DISCORD_BOT_TOKEN
}
