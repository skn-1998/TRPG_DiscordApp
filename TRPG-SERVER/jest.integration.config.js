const baseConfig = require('./jest.config')

module.exports = {
  ...baseConfig,
  displayName: 'character-integration-isolated-mongo',
  testRegex: [
    'src[\\\\/]domains[\\\\/]character[\\\\/]character\\.(integration|crud)\\.spec\\.ts$',
    'src[\\\\/]scripts[\\\\/]backfill-template-pin\\.integration\\.spec\\.ts$'
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['<rootDir>/test/testcontainers/setup-test-env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/utils/jest-setup.ts'],
  globalSetup: '<rootDir>/test/testcontainers/global-setup.ts',
  globalTeardown: '<rootDir>/test/testcontainers/global-teardown.ts',
  testTimeout: 60000,
  maxWorkers: 1,
  collectCoverage: false
}
