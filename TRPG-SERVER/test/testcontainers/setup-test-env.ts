import { existsSync, readFileSync } from 'fs'
import { setupTestEnvironment } from '../config/test-environment'
import { testcontainersStateFilePath } from './runtime-state'

interface RuntimeState {
  containerId: string
  mongoUri: string
}

setupTestEnvironment()

if (existsSync(testcontainersStateFilePath)) {
  const state = JSON.parse(readFileSync(testcontainersStateFilePath, 'utf-8')) as RuntimeState
  process.env.MONGODB_URI = state.mongoUri
  process.env.MONGO_URI = state.mongoUri
}

console.log('Testcontainers setup loaded')
console.log(`MONGODB_URI: ${process.env.MONGODB_URI}`)
