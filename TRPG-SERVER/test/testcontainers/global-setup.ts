import { writeFileSync } from 'fs'
import { GenericContainer } from 'testcontainers'
import { testcontainersStateFilePath } from './runtime-state'

const TEST_DB_NAME = process.env.TEST_DB_NAME || 'trpg_test_db'

export default async function globalSetup(): Promise<void> {
  const container = await new GenericContainer('mongo:7').withExposedPorts(27017).withReuse().start()

  const host = container.getHost()
  const port = container.getMappedPort(27017)
  const mongoUri = `mongodb://${host}:${port}/${TEST_DB_NAME}`

  const state = {
    containerId: container.getId(),
    mongoUri
  }

  writeFileSync(testcontainersStateFilePath, JSON.stringify(state, null, 2), 'utf-8')
}
