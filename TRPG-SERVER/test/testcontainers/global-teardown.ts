import { existsSync, readFileSync, rmSync } from 'fs'
import { execFileSync } from 'child_process'
import { MongoContainerRuntimeState, testcontainersStateFilePath } from './runtime-state'

export default async function globalTeardown(): Promise<void> {
  if (!existsSync(testcontainersStateFilePath)) {
    return
  }

  const state = JSON.parse(readFileSync(testcontainersStateFilePath, 'utf-8')) as MongoContainerRuntimeState
  const existingContainerId = execFileSync(
    'docker',
    ['ps', '--all', '--quiet', '--filter', `id=${state.containerId}`],
    { encoding: 'utf-8' }
  ).trim()

  if (existingContainerId) {
    execFileSync('docker', ['rm', '-f', state.containerId], { stdio: 'ignore' })
  }

  rmSync(testcontainersStateFilePath, { force: true })
}
