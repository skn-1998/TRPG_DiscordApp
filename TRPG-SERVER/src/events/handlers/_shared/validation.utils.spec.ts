import {
  validateRequired,
  validateStringLength,
  validatePattern,
  validateEnum,
  validateDiscordId,
  validateCharacterId,
  validateGameSystemId,
  validateObject,
  validateArray,
  validateDate,
  validateUrl,
  validateJsonString,
  validateRange,
  validateEventPayload,
  collectValidationErrors,
  ValidationError,
  MultipleValidationError,
  type ValidationSchema
} from './validation.utils'

/**
 * validation.utils の純粋なバリデーション関数群に対するユニットテスト。
 *
 * 副作用なし・DI なしの純粋関数のため、モックは使わず入力→（戻り値 void / throw）を直接検証する。
 * 各関数について 正常系（throw しない）・境界値・異常系（throw する）を網羅する。
 */
describe('validation.utils', () => {
  describe('validateRequired', () => {
    it('全ての必須フィールドが埋まっていれば throw しない', () => {
      expect(() => validateRequired({ a: 1, b: 'x' }, ['a', 'b'])).not.toThrow()
    })

    it('検証対象フィールドが空配列なら何も検証せず throw しない', () => {
      expect(() => validateRequired({ a: undefined }, [])).not.toThrow()
    })

    it('undefined のフィールドがあれば ValidationError を投げる', () => {
      expect(() => validateRequired({ a: undefined as unknown as number }, ['a'])).toThrow(ValidationError)
    })

    it('null のフィールドがあれば ValidationError を投げる', () => {
      expect(() => validateRequired({ a: null as unknown as number }, ['a'])).toThrow(ValidationError)
    })

    it('空文字のフィールドがあれば ValidationError を投げる', () => {
      expect(() => validateRequired({ a: '' }, ['a'])).toThrow(ValidationError)
    })

    it('0 や false は欠落扱いにならず throw しない', () => {
      expect(() => validateRequired({ a: 0, b: false }, ['a', 'b'])).not.toThrow()
    })

    it('複数の欠落フィールドを全てメッセージに列挙する', () => {
      expect(() => validateRequired({ a: undefined, b: null }, ['a', 'b'])).toThrow('Required fields missing: a, b')
    })
  })

  describe('validateStringLength', () => {
    it('範囲内の文字列なら throw しない', () => {
      expect(() => validateStringLength('hello', 'name', 1, 10)).not.toThrow()
    })

    it('min/max 未指定なら長さに関わらず throw しない', () => {
      expect(() => validateStringLength('', 'name')).not.toThrow()
    })

    it('文字列でなければ ValidationError を投げる', () => {
      expect(() => validateStringLength(123 as unknown as string, 'name')).toThrow('name must be a string')
    })

    it('min ちょうどの長さは許容する（境界値）', () => {
      expect(() => validateStringLength('ab', 'name', 2)).not.toThrow()
    })

    it('min 未満なら ValidationError を投げる', () => {
      expect(() => validateStringLength('a', 'name', 2)).toThrow('name must be at least 2 characters')
    })

    it('max ちょうどの長さは許容する（境界値）', () => {
      expect(() => validateStringLength('abc', 'name', undefined, 3)).not.toThrow()
    })

    it('max 超過なら ValidationError を投げる', () => {
      expect(() => validateStringLength('abcd', 'name', undefined, 3)).toThrow('name must not exceed 3 characters')
    })
  })

  describe('validatePattern', () => {
    it('パターンに一致すれば throw しない', () => {
      expect(() => validatePattern('abc123', 'code', /^[a-z0-9]+$/)).not.toThrow()
    })

    it('パターンに一致しなければデフォルトメッセージで throw する', () => {
      expect(() => validatePattern('ABC', 'code', /^[a-z]+$/)).toThrow('code does not match required pattern')
    })

    it('errorMessage 指定時はそのメッセージで throw する', () => {
      expect(() => validatePattern('ABC', 'code', /^[a-z]+$/, 'カスタムエラー')).toThrow('カスタムエラー')
    })
  })

  describe('validateEnum', () => {
    it('許容値に含まれれば throw しない', () => {
      expect(() => validateEnum('a', 'kind', ['a', 'b'])).not.toThrow()
    })

    it('許容値に含まれなければ ValidationError を投げる', () => {
      expect(() => validateEnum('c', 'kind', ['a', 'b'])).toThrow('kind must be one of: a, b')
    })

    it('数値型の列挙でも一致を判定できる', () => {
      expect(() => validateEnum(2, 'num', [1, 2, 3])).not.toThrow()
      expect(() => validateEnum(9, 'num', [1, 2, 3])).toThrow(ValidationError)
    })
  })

  describe('validateDiscordId', () => {
    it('17〜19桁の数字なら throw しない', () => {
      expect(() => validateDiscordId('12345678901234567', 'userId')).not.toThrow()
      expect(() => validateDiscordId('1234567890123456789', 'userId')).not.toThrow()
    })

    it('16桁以下は ValidationError を投げる', () => {
      expect(() => validateDiscordId('1234567890123456', 'userId')).toThrow(
        'userId must be a valid Discord ID (17-19 digits)'
      )
    })

    it('20桁以上は ValidationError を投げる', () => {
      expect(() => validateDiscordId('12345678901234567890', 'userId')).toThrow(ValidationError)
    })

    it('数字以外を含むと ValidationError を投げる', () => {
      expect(() => validateDiscordId('1234567890123456a', 'userId')).toThrow(ValidationError)
    })
  })

  describe('validateCharacterId', () => {
    it('char_ + 8〜12桁の英小文字数字なら throw しない', () => {
      expect(() => validateCharacterId('char_abc12345', 'charId')).not.toThrow()
      expect(() => validateCharacterId('char_a1b2c3d4e5f6', 'charId')).not.toThrow()
    })

    it('プレフィックスが無いと ValidationError を投げる', () => {
      expect(() => validateCharacterId('abc12345', 'charId')).toThrow(
        'charId must be a valid character ID (char_ prefix + 8-12 lowercase alphanumeric)'
      )
    })

    it('英小文字数字部分が7桁以下なら ValidationError を投げる', () => {
      expect(() => validateCharacterId('char_abc1234', 'charId')).toThrow(ValidationError)
    })

    it('大文字を含むと ValidationError を投げる', () => {
      expect(() => validateCharacterId('char_ABC12345', 'charId')).toThrow(ValidationError)
    })
  })

  describe('validateGameSystemId', () => {
    it.each(['coc', 'dnd5e', 'sw2.5', 'generic'])('許容システム %s は throw しない', (system) => {
      expect(() => validateGameSystemId(system, 'system')).not.toThrow()
    })

    it('未知のシステムは ValidationError を投げる', () => {
      expect(() => validateGameSystemId('unknown', 'system')).toThrow('system must be one of')
    })
  })

  describe('validateObject', () => {
    it('プレーンなオブジェクトなら throw しない', () => {
      expect(() => validateObject({ a: 1 }, 'data')).not.toThrow()
    })

    it('allowEmpty=true（既定）なら null/undefined を許容する', () => {
      expect(() => validateObject(null, 'data')).not.toThrow()
      expect(() => validateObject(undefined, 'data')).not.toThrow()
    })

    it('allowEmpty=false で null/undefined は ValidationError を投げる', () => {
      expect(() => validateObject(null, 'data', false)).toThrow('data cannot be null or undefined')
      expect(() => validateObject(undefined, 'data', false)).toThrow(ValidationError)
    })

    it('配列はオブジェクトとして許容しない', () => {
      expect(() => validateObject([1, 2], 'data')).toThrow('data must be an object')
    })

    it('プリミティブはオブジェクトとして許容しない', () => {
      expect(() => validateObject('str', 'data')).toThrow('data must be an object')
    })

    it('allowEmpty=false で空オブジェクトは ValidationError を投げる', () => {
      expect(() => validateObject({}, 'data', false)).toThrow('data cannot be empty')
    })

    it('allowEmpty=true なら空オブジェクトを許容する', () => {
      expect(() => validateObject({}, 'data', true)).not.toThrow()
    })
  })

  describe('validateArray', () => {
    it('配列なら throw しない', () => {
      expect(() => validateArray([1, 2, 3], 'items')).not.toThrow()
    })

    it('配列でなければ ValidationError を投げる', () => {
      expect(() => validateArray('not-array', 'items')).toThrow('items must be an array')
      expect(() => validateArray({ length: 1 }, 'items')).toThrow(ValidationError)
    })

    it('minLength ちょうどは許容する（境界値）', () => {
      expect(() => validateArray([1, 2], 'items', 2)).not.toThrow()
    })

    it('minLength 未満なら ValidationError を投げる', () => {
      expect(() => validateArray([1], 'items', 2)).toThrow('items must have at least 2 items')
    })

    it('maxLength ちょうどは許容する（境界値）', () => {
      expect(() => validateArray([1, 2], 'items', undefined, 2)).not.toThrow()
    })

    it('maxLength 超過なら ValidationError を投げる', () => {
      expect(() => validateArray([1, 2, 3], 'items', undefined, 2)).toThrow('items must not exceed 2 items')
    })
  })

  describe('validateDate', () => {
    it('有効な Date インスタンスなら throw しない', () => {
      expect(() => validateDate(new Date('2025-01-01'), 'date')).not.toThrow()
    })

    it('有効な日付文字列なら throw しない', () => {
      expect(() => validateDate('2025-01-01', 'date')).not.toThrow()
    })

    it('Date でも文字列でもなければ ValidationError を投げる', () => {
      expect(() => validateDate(123, 'date')).toThrow('date must be a Date or date string')
    })

    it('無効な Date インスタンスは ValidationError を投げる', () => {
      expect(() => validateDate(new Date('invalid'), 'date')).toThrow('date must be a valid date')
    })

    it('無効な日付文字列は ValidationError を投げる', () => {
      expect(() => validateDate('not-a-date', 'date')).toThrow('date must be a valid date')
    })
  })

  describe('validateUrl', () => {
    it('有効な URL なら throw しない', () => {
      expect(() => validateUrl('https://example.com', 'url')).not.toThrow()
    })

    it('無効な URL なら ValidationError を投げる', () => {
      expect(() => validateUrl('not a url', 'url')).toThrow('url must be a valid URL')
    })
  })

  describe('validateJsonString', () => {
    it('有効な JSON 文字列なら throw しない', () => {
      expect(() => validateJsonString('{"a":1}', 'json')).not.toThrow()
    })

    it('無効な JSON 文字列なら ValidationError を投げる', () => {
      expect(() => validateJsonString('{invalid}', 'json')).toThrow('json must be valid JSON')
    })
  })

  describe('validateRange', () => {
    it('範囲内の数値なら throw しない', () => {
      expect(() => validateRange(5, 'num', 1, 10)).not.toThrow()
    })

    it('数値でなければ ValidationError を投げる', () => {
      expect(() => validateRange('5' as unknown as number, 'num')).toThrow('num must be a number')
    })

    it('NaN は ValidationError を投げる', () => {
      expect(() => validateRange(NaN, 'num')).toThrow('num must be a number')
    })

    it('min ちょうどは許容する（境界値）', () => {
      expect(() => validateRange(1, 'num', 1)).not.toThrow()
    })

    it('min 未満なら ValidationError を投げる', () => {
      expect(() => validateRange(0, 'num', 1)).toThrow('num must be at least 1')
    })

    it('max ちょうどは許容する（境界値）', () => {
      expect(() => validateRange(10, 'num', undefined, 10)).not.toThrow()
    })

    it('max 超過なら ValidationError を投げる', () => {
      expect(() => validateRange(11, 'num', undefined, 10)).toThrow('num must not exceed 10')
    })
  })

  describe('validateEventPayload', () => {
    it('スキーマが空でもオブジェクトなら throw しない', () => {
      expect(() => validateEventPayload({ a: 1 }, {})).not.toThrow()
    })

    it('payload がオブジェクトでなければ ValidationError を投げる', () => {
      expect(() => validateEventPayload(null, {})).toThrow('Event payload must be an object')
      expect(() => validateEventPayload('str', {})).toThrow(ValidationError)
    })

    it('required の欠落は ValidationError を投げる', () => {
      const schema: ValidationSchema<{ name: string }> = { required: ['name'] }
      expect(() => validateEventPayload({}, schema)).toThrow(ValidationError)
    })

    it('fields のバリデータを各フィールドに適用する', () => {
      const validator = jest.fn()
      const schema: ValidationSchema<{ name: string }> = { fields: { name: validator } }
      validateEventPayload({ name: 'taro' }, schema)
      expect(validator).toHaveBeenCalledWith('taro', 'name')
    })

    it('undefined のフィールドにはバリデータを適用しない', () => {
      const validator = jest.fn()
      const schema: ValidationSchema<{ name: string }> = { fields: { name: validator } }
      validateEventPayload({}, schema)
      expect(validator).not.toHaveBeenCalled()
    })

    it('fields のバリデータが投げたエラーは伝播する', () => {
      const schema: ValidationSchema<{ name: string }> = {
        fields: {
          name: () => {
            throw new ValidationError('invalid name')
          }
        }
      }
      expect(() => validateEventPayload({ name: 'x' }, schema)).toThrow('invalid name')
    })

    it('custom バリデーションを payload に対して呼び出す', () => {
      const custom = jest.fn()
      const schema: ValidationSchema<{ a: number }> = { custom }
      const payload = { a: 1 }
      validateEventPayload(payload, schema)
      expect(custom).toHaveBeenCalledWith(payload)
    })
  })

  describe('collectValidationErrors', () => {
    it('全バリデータが成功すれば throw しない', () => {
      expect(() => collectValidationErrors({}, [() => {}, () => {}])).not.toThrow()
    })

    it('複数の ValidationError を集約して MultipleValidationError を投げる', () => {
      const validators = [
        () => {
          throw new ValidationError('error1')
        },
        () => {
          throw new ValidationError('error2')
        }
      ]
      expect(() => collectValidationErrors({}, validators)).toThrow(MultipleValidationError)
    })

    it('集約された MultipleValidationError は全エラーを errors に保持する', () => {
      const validators = [
        () => {
          throw new ValidationError('error1')
        },
        () => {
          throw new ValidationError('error2')
        }
      ]
      try {
        collectValidationErrors({}, validators)
        fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MultipleValidationError)
        expect((e as MultipleValidationError).errors).toHaveLength(2)
        expect((e as MultipleValidationError).errors.map((err) => err.message)).toEqual(['error1', 'error2'])
      }
    })

    it('ValidationError 以外の例外も ValidationError に包んで集約する', () => {
      const validators = [
        () => {
          throw new Error('plain error')
        }
      ]
      try {
        collectValidationErrors({}, validators)
        fail('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(MultipleValidationError)
        expect((e as MultipleValidationError).errors[0]).toBeInstanceOf(ValidationError)
        expect((e as MultipleValidationError).errors[0].message).toContain('plain error')
      }
    })
  })

  describe('ValidationError', () => {
    it('name が ValidationError で message を保持する', () => {
      const err = new ValidationError('msg')
      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('ValidationError')
      expect(err.message).toBe('msg')
    })
  })

  describe('MultipleValidationError', () => {
    it('name が MultipleValidationError で全メッセージを集約する', () => {
      const err = new MultipleValidationError([new ValidationError('a'), new ValidationError('b')])
      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('MultipleValidationError')
      expect(err.message).toContain('a')
      expect(err.message).toContain('b')
      expect(err.errors).toHaveLength(2)
    })
  })
})
