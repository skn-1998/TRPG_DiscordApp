import { setupTestEnvironment, testEnvironment } from './test-environment'

describe('setupTestEnvironment MongoDB contract', () => {
  it('通常テストではhost環境の外部URIをlocalhostへ上書きする', () => {
    process.env.MONGODB_URI = 'mongodb+srv://example.invalid/production'

    setupTestEnvironment()

    expect(process.env.MONGODB_URI).toBe(testEnvironment.database.mongo.uri)
  })
})
