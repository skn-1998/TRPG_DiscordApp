import { existsSync, rmSync, writeFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { MongoContainerRuntimeState, testcontainersLockFilePath, testcontainersStateFilePath } from './runtime-state'

const docker = (args: string[]): string =>
  execFileSync('docker', args, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim()

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds))

export default async function globalSetup(): Promise<void> {
  const runId = `${process.pid}-${Date.now()}`
  const databaseName = `${process.env.TEST_DB_NAME || 'trpg_test_db'}_${runId}`
  let containerId: string | undefined
  let ownsLock = false

  try {
    try {
      writeFileSync(testcontainersLockFilePath, runId, { encoding: 'utf-8', flag: 'wx' })
    } catch (error) {
      const errorCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
      if (errorCode === 'EEXIST') {
        throw new Error(
          `Isolated MongoDB lock already exists at ${testcontainersLockFilePath}; verify no test is running before removing a stale lock`
        )
      }
      throw error
    }
    ownsLock = true
    if (existsSync(testcontainersStateFilePath)) {
      throw new Error('Isolated MongoDB runtime state already exists; refusing a concurrent or stale test run')
    }

    containerId = docker([
      'run',
      '--detach',
      '--rm',
      '--publish',
      '127.0.0.1::27017',
      '--label',
      `trpg.test.run=${runId}`,
      'mongo:7'
    ])

    const portOutput = docker(['port', containerId, '27017/tcp'])
    const port = portOutput.match(/:(\d+)\s*$/)?.[1]
    if (!port) throw new Error(`Could not resolve MongoDB mapped port: ${portOutput}`)

    const deadline = Date.now() + 60_000
    let ready = false
    while (Date.now() < deadline) {
      try {
        ready = docker(['exec', containerId, 'mongosh', '--quiet', '--eval', 'db.adminCommand({ ping: 1 }).ok']) === '1'
      } catch {
        ready = false
      }
      if (ready) break
      await sleep(500)
    }
    if (!ready) throw new Error('MongoDB container did not become ready within 60 seconds')

    const state: MongoContainerRuntimeState = {
      containerId,
      mongoUri: `mongodb://127.0.0.1:${port}/${databaseName}`,
      runId
    }

    writeFileSync(testcontainersStateFilePath, JSON.stringify(state, null, 2), 'utf-8')
  } catch (error) {
    if (containerId) {
      try {
        docker(['rm', '-f', containerId])
      } catch (cleanupError) {
        console.error(`Failed to remove MongoDB test container ${containerId} after setup error`, cleanupError)
      }
    }
    throw error
  } finally {
    if (ownsLock) {
      rmSync(testcontainersLockFilePath, { force: true })
    }
  }
}
