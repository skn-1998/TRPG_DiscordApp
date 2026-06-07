import {
  isErrorWithMessage,
  isErrorWithCode,
  isMongoError,
  isDuplicateKeyError,
  getErrorMessage,
  formatError
} from './error-helpers'

/**
 * error-helpers は依存ゼロの純粋関数群（型述語・文字列整形）。
 * モックは不要で、入出力を直接固定して各分岐・境界を網羅する。
 */
describe('error-helpers', () => {
  describe('isErrorWithMessage', () => {
    it('message プロパティ(string)を持つオブジェクトは true', () => {
      expect(isErrorWithMessage({ message: 'boom' })).toBe(true)
    })

    it('Error インスタンスは message を持つので true', () => {
      expect(isErrorWithMessage(new Error('x'))).toBe(true)
    })

    it('message が string でない場合は false', () => {
      expect(isErrorWithMessage({ message: 123 })).toBe(false)
    })

    it('message プロパティが無い場合は false', () => {
      expect(isErrorWithMessage({ code: 'E' })).toBe(false)
    })

    it('null は false', () => {
      expect(isErrorWithMessage(null)).toBe(false)
    })

    it('オブジェクト以外(文字列)は false', () => {
      expect(isErrorWithMessage('just a string')).toBe(false)
    })
  })

  describe('isErrorWithCode', () => {
    it('code が string の場合は true', () => {
      expect(isErrorWithCode({ code: 'ENOENT' })).toBe(true)
    })

    it('code が number の場合は true', () => {
      expect(isErrorWithCode({ code: 11000 })).toBe(true)
    })

    it('code が string/number 以外(boolean)は false', () => {
      expect(isErrorWithCode({ code: true })).toBe(false)
    })

    it('code プロパティが無い場合は false', () => {
      expect(isErrorWithCode({ message: 'x' })).toBe(false)
    })

    it('null は false', () => {
      expect(isErrorWithCode(null)).toBe(false)
    })
  })

  describe('isMongoError', () => {
    it("name が 'MongoError' なら true", () => {
      expect(isMongoError({ name: 'MongoError' })).toBe(true)
    })

    it("name が 'MongoServerError' なら true", () => {
      expect(isMongoError({ name: 'MongoServerError' })).toBe(true)
    })

    it("name が 'Mongo' で始まれば true", () => {
      expect(isMongoError({ name: 'MongoBulkWriteError' })).toBe(true)
    })

    it('name が Mongo 以外で始まる場合は false', () => {
      expect(isMongoError({ name: 'TypeError' })).toBe(false)
    })

    it('name が string でない場合は false', () => {
      expect(isMongoError({ name: 42 })).toBe(false)
    })

    it('name プロパティが無い場合は false', () => {
      expect(isMongoError({ code: 11000 })).toBe(false)
    })

    it('null は false', () => {
      expect(isMongoError(null)).toBe(false)
    })
  })

  describe('isDuplicateKeyError', () => {
    it('Mongo エラーで code=11000 かつ keyValue ありなら true', () => {
      expect(isDuplicateKeyError({ name: 'MongoServerError', code: 11000, keyValue: { email: 'a@example.com' } })).toBe(
        true
      )
    })

    it('Mongo エラーでも code が 11000 以外なら false', () => {
      expect(isDuplicateKeyError({ name: 'MongoServerError', code: 121, keyValue: { a: 1 } })).toBe(false)
    })

    it('code=11000 でも keyValue が無ければ false', () => {
      expect(isDuplicateKeyError({ name: 'MongoServerError', code: 11000 })).toBe(false)
    })

    it('Mongo エラーでない場合は false', () => {
      expect(isDuplicateKeyError({ name: 'TypeError', code: 11000, keyValue: { a: 1 } })).toBe(false)
    })
  })

  describe('getErrorMessage', () => {
    it('message を持つエラーはその message を返す', () => {
      expect(getErrorMessage(new Error('具体的なエラー'))).toBe('具体的なエラー')
    })

    it('重複キーエラーは重複キー・値を含むメッセージを返す', () => {
      const err = { name: 'MongoServerError', code: 11000, keyValue: { email: 'dup@example.com' } }
      expect(getErrorMessage(err)).toBe('重複エラー: email=dup@example.com は既に使用されています。')
    })

    it('message を持たない Mongo エラーは name と code を含むメッセージを返す', () => {
      const err = { name: 'MongoNetworkError', code: 89 }
      expect(getErrorMessage(err)).toBe('データベースエラー: MongoNetworkError 89')
    })

    it('code が無い Mongo エラーは name のみのメッセージを返す', () => {
      const err = { name: 'MongoTimeoutError' }
      expect(getErrorMessage(err)).toBe('データベースエラー: MongoTimeoutError ')
    })

    it('判別できないエラーは既定メッセージを返す', () => {
      expect(getErrorMessage(12345)).toBe('不明なエラーが発生しました')
    })
  })

  describe('formatError', () => {
    it('文字列はそのまま返す', () => {
      expect(formatError('plain error')).toBe('plain error')
    })

    it('message を持つエラーはその message を返す', () => {
      expect(formatError(new Error('msg'))).toBe('msg')
    })

    it('message を持たないオブジェクトは整形 JSON を返す', () => {
      expect(formatError({ foo: 'bar' })).toBe(JSON.stringify({ foo: 'bar' }, null, 2))
    })

    it('循環参照で JSON 化できない場合は String(error) を返す', () => {
      const circular: Record<string, unknown> = {}
      circular.self = circular
      expect(formatError(circular)).toBe('[object Object]')
    })

    it('null は JSON.stringify の結果("null")を返す', () => {
      expect(formatError(null)).toBe('null')
    })
  })
})
