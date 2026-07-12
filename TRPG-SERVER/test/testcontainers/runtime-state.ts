import * as path from 'path'

export const testcontainersStateFilePath = path.resolve(__dirname, '.runtime-state.json')
export const testcontainersLockFilePath = path.resolve(__dirname, '.runtime-state.lock')

export interface MongoContainerRuntimeState {
  containerId: string
  mongoUri: string
  runId: string
}
