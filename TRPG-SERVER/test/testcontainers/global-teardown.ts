import { existsSync, readFileSync, rmSync } from 'fs'
import { execSync } from 'child_process'
import { testcontainersStateFilePath } from './runtime-state'

interface RuntimeState {
  containerId: string
  mongoUri: string
}

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(testcontainersStateFilePath)) {
    return
  }

  const state = JSON.parse(readFileSync(testcontainersStateFilePath, 'utf-8')) as RuntimeState

  try {
    execSync(`docker rm -f ${state.containerId}`, { stdio: 'ignore' })
  } catch (_error) {
    // Container might already be removed by Ryuk.
  }

  rmSync(testcontainersStateFilePath, { force: true })
}
