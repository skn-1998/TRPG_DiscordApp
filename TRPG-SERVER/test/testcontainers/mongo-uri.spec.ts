import { requireIsolatedMongoUri } from './mongo-uri'

describe('requireIsolatedMongoUri', () => {
  const original = {
    provider: process.env.TEST_DATABASE_PROVIDER,
    runId: process.env.TEST_DATABASE_RUN_ID,
    uri: process.env.MONGODB_URI
  }

  afterEach(() => {
    if (original.provider === undefined) delete process.env.TEST_DATABASE_PROVIDER
    else process.env.TEST_DATABASE_PROVIDER = original.provider
    if (original.runId === undefined) delete process.env.TEST_DATABASE_RUN_ID
    else process.env.TEST_DATABASE_RUN_ID = original.runId
    if (original.uri === undefined) delete process.env.MONGODB_URI
    else process.env.MONGODB_URI = original.uri
  })

  it('host環境のAtlas URIを拒否する', () => {
    delete process.env.TEST_DATABASE_PROVIDER
    delete process.env.TEST_DATABASE_RUN_ID
    process.env.MONGODB_URI = 'mongodb+srv://example.invalid/production'

    expect(() => requireIsolatedMongoUri()).toThrow(/refusing external MongoDB URI/)
  })

  it('専用markerがあっても外部mongodb URIを拒否する', () => {
    process.env.TEST_DATABASE_PROVIDER = 'isolated-docker'
    process.env.TEST_DATABASE_RUN_ID = 'run-1'
    process.env.MONGODB_URI = 'mongodb://database.example.invalid:27017/test_run-1'

    expect(() => requireIsolatedMongoUri()).toThrow(/refusing external MongoDB URI/)
  })

  it('loopbackでもrun IDとDB名が一致しないURIを拒否する', () => {
    process.env.TEST_DATABASE_PROVIDER = 'isolated-docker'
    process.env.TEST_DATABASE_RUN_ID = 'run-1'
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:49152/test_run-2'

    expect(() => requireIsolatedMongoUri()).toThrow(/refusing external MongoDB URI/)
  })

  it('専用setupが設定した一時MongoDB URIだけを返す', () => {
    process.env.TEST_DATABASE_PROVIDER = 'isolated-docker'
    process.env.TEST_DATABASE_RUN_ID = 'run-1'
    process.env.MONGODB_URI = 'mongodb://127.0.0.1:49152/test_run-1'

    expect(requireIsolatedMongoUri()).toBe('mongodb://127.0.0.1:49152/test_run-1')
  })
})
