import { Logger } from '@nestjs/common'
import * as fs from 'fs'
import { loadJsonFile } from './loadJsonFile'

// fs の読み込みを固定化
jest.mock('fs')

const mockedFs = fs as jest.Mocked<typeof fs>

/**
 * loadJsonFile（discord/utils 版）は readFileSync の結果を JSON.parse して返すが、
 * 失敗時は Logger.error を出して undefined を返す（戻り値型が緩い点に注意）。
 * 副作用の境界（fs と Logger.error）をモックし、正常 parse と異常系の挙動を検証する。
 */
describe('loadJsonFile', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('読み込んだ JSON 文字列をパースして返す', () => {
    // Arrange
    mockedFs.readFileSync.mockReturnValue('{"key":"値"}')

    // Act
    const result = loadJsonFile('config.json')

    // Assert
    expect(result).toEqual({ key: '値' })
    expect(mockedFs.readFileSync).toHaveBeenCalledWith('config.json', 'utf8')
  })

  it('JSON パースに失敗すると Logger.error を出して undefined を返す', () => {
    // Arrange: 不正な JSON
    mockedFs.readFileSync.mockReturnValue('{ 壊れた')
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    // Act
    const result = loadJsonFile('broken.json')

    // Assert: 例外を投げず undefined、エラーログは出す
    expect(result).toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith('Error reading the file', expect.any(Error))
  })

  it('ファイル読み込み自体が失敗しても Logger.error を出して undefined を返す', () => {
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('ENOENT')
    })
    const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    const result = loadJsonFile('missing.json')

    expect(result).toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
  })
})
