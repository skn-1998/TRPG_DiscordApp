import { existsSync, readFileSync } from 'fs'
import { setupTestEnvironment } from '../config/test-environment'
import { MongoContainerRuntimeState, testcontainersStateFilePath } from './runtime-state'

if (!existsSync(testcontainersStateFilePath)) {
  throw new Error('Testcontainers runtime state is missing; refusing to use MONGODB_URI from the host environment')
}

const state = JSON.parse(readFileSync(testcontainersStateFilePath, 'utf-8')) as MongoContainerRuntimeState

setupTestEnvironment()
process.env.MONGODB_URI = state.mongoUri
process.env.MONGO_URI = state.mongoUri
process.env.TEST_DATABASE_PROVIDER = 'isolated-docker'
process.env.TEST_DATABASE_RUN_ID = state.runId
process.env.TEST_MOCK_DATABASE = 'false'

console.log('Isolated MongoDB setup loaded')
console.log(`MONGODB_URI: ${process.env.MONGODB_URI}`)
