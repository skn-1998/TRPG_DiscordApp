import * as fs from 'fs'
import { loadJsonFile, saveJsonFile, convertToJson } from './file.util'

// fs の副作用を固定化（読み書き・存在判定をモック）
jest.mock('fs')

const mockedFs = fs as jest.Mocked<typeof fs>

/**
 * file.util は path.resolve で正規化し fs で読み書きする副作用ユーティリティ。
 * 副作用の境界（fs）のみモックし、JSON パース・例外ラップ・mkdir 判定の分岐を検証する。
 * path はモックせず実モジュールを使う（純粋関数なので決定的）。
 */
describe('file.util', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loadJsonFile', () => {
    it('読み込んだ JSON 文字列をパースしてオブジェクトで返す', () => {
      // Arrange
      mockedFs.readFileSync.mockReturnValue('{"name":"テスト","value":1}')

      // Act
      const result = loadJsonFile<{ name: string; value: number }>('data/config.json')

      // Assert
      expect(result).toEqual({ name: 'テスト', value: 1 })
      expect(mockedFs.readFileSync).toHaveBeenCalledWith(expect.any(String), 'utf8')
    })

    it('JSON パースに失敗すると Error をラップして投げる', () => {
      // 不正な JSON → JSON.parse が SyntaxError（Error 派生）を投げる
      mockedFs.readFileSync.mockReturnValue('{ 壊れた json')

      expect(() => loadJsonFile('data/broken.json')).toThrow(/JSONファイルの読み込みに失敗しました/)
    })

    it('readFileSync が Error 以外を投げた場合はそのまま再スローする', () => {
      // Error 派生でない値を投げる異常系
      const nonErrorValue: unknown = 'fsの生文字列エラー'
      mockedFs.readFileSync.mockImplementation(() => {
        throw nonErrorValue
      })

      expect(() => loadJsonFile('data/x.json')).toThrow('fsの生文字列エラー')
    })
  })

  describe('saveJsonFile', () => {
    it('ディレクトリが存在しない場合は recursive で mkdir してから書き込む', () => {
      // Arrange: ディレクトリ未存在
      mockedFs.existsSync.mockReturnValue(false)

      // Act
      saveJsonFile('out/nested/data.json', { a: 1 })

      // Assert: mkdir が recursive で呼ばれ、その後 writeFileSync
      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true })
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(expect.any(String), JSON.stringify({ a: 1 }, null, 2), 'utf8')
    })

    it('ディレクトリが存在する場合は mkdir せずに書き込む', () => {
      mockedFs.existsSync.mockReturnValue(true)

      saveJsonFile('out/data.json', { b: 2 })

      expect(mockedFs.mkdirSync).not.toHaveBeenCalled()
      expect(mockedFs.writeFileSync).toHaveBeenCalled()
    })

    it('書き込みに失敗すると Error をラップして投げる', () => {
      mockedFs.existsSync.mockReturnValue(true)
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('ディスク満杯')
      })

      expect(() => saveJsonFile('out/data.json', {})).toThrow('JSONファイルの書き込みに失敗しました: ディスク満杯')
    })
  })

  describe('convertToJson', () => {
    it('オブジェクトを整形済み JSON 文字列に変換する', () => {
      const result = convertToJson({ x: 1, y: 'あ' })

      expect(result).toBe(JSON.stringify({ x: 1, y: 'あ' }, null, 2))
    })

    it('循環参照など変換不能な値では Error をラップして投げる', () => {
      // 循環参照を作ると JSON.stringify が TypeError を投げる
      const circular: Record<string, unknown> = {}
      circular.self = circular

      expect(() => convertToJson(circular)).toThrow(/JSONへの変換に失敗しました/)
    })
  })
})
