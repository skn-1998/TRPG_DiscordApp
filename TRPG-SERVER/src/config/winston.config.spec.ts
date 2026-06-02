import * as winston from 'winston'
import { join } from 'path'
import { createWinstonConfig, winstonConfigFactory } from './winston.config'
import type { AppConfigService } from './config.service'

/**
 * winston.config.ts は AppConfigService から取得したログ設定を元に
 * winston の transports/level を組み立てる factory。
 * 副作用の境界は AppConfigService.get（設定取得）のみ。これを型付きモックし、
 * consoleEnabled / fileEnabled の分岐で transports の構成が変わることを検証する。
 * winston そのものは実物を使い、生成された transport の型・件数・level を確認する。
 */
type LoggingConfig = {
  level: string
  fileEnabled: boolean
  consoleEnabled: boolean
  filePath: string
  errorFilePath: string
}

const createConfigServiceMock = (logging: LoggingConfig): jest.Mocked<Pick<AppConfigService, 'get'>> => {
  const map: Record<string, unknown> = {
    'logging.level': logging.level,
    'logging.fileEnabled': logging.fileEnabled,
    'logging.consoleEnabled': logging.consoleEnabled,
    'logging.filePath': logging.filePath,
    'logging.errorFilePath': logging.errorFilePath
  }
  return {
    get: jest.fn((path: string) => map[path]) as unknown as jest.Mocked<Pick<AppConfigService, 'get'>>['get']
  }
}

const baseLogging: LoggingConfig = {
  level: 'info',
  fileEnabled: false,
  consoleEnabled: false,
  filePath: 'logs/app.log',
  errorFilePath: 'logs/error.log'
}

describe('createWinstonConfig', () => {
  it('取得した logging.level を返り値の level に反映する', () => {
    const configService = createConfigServiceMock({ ...baseLogging, level: 'debug' })

    const result = createWinstonConfig(configService as unknown as AppConfigService)

    expect(result.level).toBe('debug')
  })

  it('console も file も無効なら transports は空', () => {
    const configService = createConfigServiceMock({ ...baseLogging })

    const result = createWinstonConfig(configService as unknown as AppConfigService)

    expect(result.transports).toHaveLength(0)
  })

  it('consoleEnabled=true のとき Console transport を1つ追加する', () => {
    const configService = createConfigServiceMock({ ...baseLogging, consoleEnabled: true })

    const result = createWinstonConfig(configService as unknown as AppConfigService)

    expect(result.transports).toHaveLength(1)
    expect(result.transports[0]).toBeInstanceOf(winston.transports.Console)
  })

  it('fileEnabled=true のとき File transport を2つ（全ログ・エラー専用）追加する', () => {
    const configService = createConfigServiceMock({ ...baseLogging, fileEnabled: true })

    const result = createWinstonConfig(configService as unknown as AppConfigService)

    const fileTransports = result.transports.filter((t) => t instanceof winston.transports.File)
    expect(fileTransports).toHaveLength(2)
  })

  it('console と file 両方有効なら transports は3つ（Console1 + File2）', () => {
    const configService = createConfigServiceMock({
      ...baseLogging,
      consoleEnabled: true,
      fileEnabled: true
    })

    const result = createWinstonConfig(configService as unknown as AppConfigService)

    expect(result.transports).toHaveLength(3)
    expect(result.transports.filter((t) => t instanceof winston.transports.Console)).toHaveLength(1)
    expect(result.transports.filter((t) => t instanceof winston.transports.File)).toHaveLength(2)
  })

  it('File transport のファイル名は cwd と設定パスを結合したものになる', () => {
    const configService = createConfigServiceMock({
      ...baseLogging,
      fileEnabled: true,
      filePath: 'logs/app.log',
      errorFilePath: 'logs/error.log'
    })

    const result = createWinstonConfig(configService as unknown as AppConfigService)

    const fileTransports = result.transports.filter(
      (t): t is winston.transports.FileTransportInstance => t instanceof winston.transports.File
    )
    // winston は filename(ベース名) と dirname(ディレクトリ) を分離保持するため結合して検証する
    const fullPaths = fileTransports.map((t) => join(t.dirname ?? '', t.filename ?? ''))
    expect(fullPaths).toContain(join(process.cwd(), 'logs/app.log'))
    expect(fullPaths).toContain(join(process.cwd(), 'logs/error.log'))
  })

  it('エラー専用 File transport は level=error で生成される', () => {
    const configService = createConfigServiceMock({
      ...baseLogging,
      level: 'info',
      fileEnabled: true
    })

    const result = createWinstonConfig(configService as unknown as AppConfigService)

    const errorTransport = result.transports
      .filter((t): t is winston.transports.FileTransportInstance => t instanceof winston.transports.File)
      .find((t) => t.level === 'error')
    expect(errorTransport).toBeDefined()
  })
})

describe('winstonConfigFactory', () => {
  it('createWinstonConfig と同等の結果を返す（委譲）', () => {
    const configService = createConfigServiceMock({ ...baseLogging, consoleEnabled: true })

    const result = winstonConfigFactory(configService as unknown as AppConfigService)

    expect(result.level).toBe('info')
    expect(result.transports).toHaveLength(1)
    expect(result.transports[0]).toBeInstanceOf(winston.transports.Console)
  })
})
