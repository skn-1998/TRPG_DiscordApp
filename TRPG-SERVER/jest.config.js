module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      tsconfig: 'tsconfig.spec.json'
    }]
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/$1',
    '^@app/(.*)$': '<rootDir>/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@domains/(.*)$': '<rootDir>/domains/$1',
    '^@auth/(.*)$': '<rootDir>/auth/$1',
    '^@discord/(.*)$': '<rootDir>/discord/$1',
    '^@middleware/(.*)$': '<rootDir>/middleware/$1'
  },
  moduleDirectories: ['node_modules', 'src', '../node_modules'],
  modulePaths: ['<rootDir>'],
  testPathIgnorePatterns: ['/node_modules/', '/src/db/', '/src/DB/']
} 