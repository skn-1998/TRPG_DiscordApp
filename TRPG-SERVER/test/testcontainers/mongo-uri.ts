/** 実DB統合specが専用の使い捨てMongoDB以外へ接続することを防ぐ。 */
export function requireIsolatedMongoUri(): string {
  const uri = process.env.MONGODB_URI
  const runId = process.env.TEST_DATABASE_RUN_ID
  let parsed: URL | undefined

  try {
    parsed = uri ? new URL(uri) : undefined
  } catch {
    parsed = undefined
  }

  const databaseName = parsed ? decodeURIComponent(parsed.pathname.slice(1)) : ''
  const isRunSpecificLoopbackUri =
    parsed?.protocol === 'mongodb:' &&
    parsed.hostname === '127.0.0.1' &&
    parsed.port !== '' &&
    Boolean(runId && databaseName.endsWith(`_${runId}`))

  if (process.env.TEST_DATABASE_PROVIDER !== 'isolated-docker' || !runId || !uri || !isRunSpecificLoopbackUri) {
    throw new Error(
      'Character integration tests require the isolated MongoDB Jest config; refusing external MongoDB URI'
    )
  }
  return uri
}
