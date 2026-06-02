import { Test } from '@nestjs/testing'
import { CharacterUpdateRequestedHandler } from './character.update.requested'
import { CharacterService } from '../../domains/character/character.service'
import { ValidationError, BusinessLogicError } from './_shared/event-handler.base'
import { CharacterUpdateRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * CharacterUpdateRequestedHandler の現状挙動を固定するユニットテスト
 *
 * 依存（CharacterService）は { provide, useValue } でモックし、
 * typedEventService は setTypedEventService 経由でモックを注入する。
 * 「どの依存が・どの引数で呼ばれ・どのイベントを emit するか」を検証する。
 *
 * 注意:
 * - customValidation（バリデーション分岐）は protected だが分岐網羅のため (handler as any) で直接呼ぶ。
 * - calculateChanges / hasChanged / cloneValue は副作用のない純粋ヘルパなので
 *   (handler as any) 経由で代表ケースを固定する。
 */
describe('CharacterUpdateRequestedHandler', () => {
  let handler: CharacterUpdateRequestedHandler
  let characterService: {
    findOne: jest.Mock
    findByChannelId: jest.Mock
    update: jest.Mock
    updateByChannelId: jest.Mock
  }
  let typedEventService: { emit: jest.Mock }

  const existingCharacter = { characterId: 'char_target0001', characterName: '旧名', discordChannelId: '111' }

  const buildEvent = (overrides: Partial<CharacterUpdateRequestedEvent> = {}): CharacterUpdateRequestedEvent =>
    ({
      type: 'character.update.requested',
      timestamp: new Date('2026-06-02T00:00:00Z'),
      source: 'system',
      characterId: 'char_target0001',
      updateData: { characterName: '新名' },
      ...overrides
    }) as CharacterUpdateRequestedEvent

  beforeEach(async () => {
    jest.clearAllMocks()

    characterService = {
      findOne: jest.fn().mockResolvedValue(existingCharacter),
      findByChannelId: jest.fn().mockResolvedValue(existingCharacter),
      update: jest.fn().mockResolvedValue({ ...existingCharacter, characterName: '新名' }),
      updateByChannelId: jest.fn().mockResolvedValue({ ...existingCharacter, characterName: '新名' })
    }
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterUpdateRequestedHandler, { provide: CharacterService, useValue: characterService }]
    }).compile()

    handler = moduleRef.get(CharacterUpdateRequestedHandler)
    handler.setTypedEventService(typedEventService as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getEventName', () => {
    it('character.update.requested を返す', () => {
      expect(handler.getEventName()).toBe('character.update.requested')
    })
  })

  describe('handle / 正常系', () => {
    it('characterId 指定なら findOne で取得し update に updateData を渡す', async () => {
      // Arrange
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert
      expect(characterService.findOne).toHaveBeenCalledWith('char_target0001')
      expect(characterService.update).toHaveBeenCalledTimes(1)
      expect(characterService.update).toHaveBeenCalledWith(
        'char_target0001',
        expect.objectContaining({ characterName: '新名' })
      )
      expect(characterService.updateByChannelId).not.toHaveBeenCalled()
    })

    it('channelId 指定なら findByChannelId で取得し updateByChannelId を呼ぶ', async () => {
      // Arrange
      const event = buildEvent({ characterId: undefined, channelId: '222' })

      // Act
      await handler.handle(event)

      // Assert
      expect(characterService.findByChannelId).toHaveBeenCalledWith('222')
      expect(characterService.updateByChannelId).toHaveBeenCalledWith(
        '222',
        expect.objectContaining({ characterName: '新名' })
      )
      expect(characterService.update).not.toHaveBeenCalled()
    })

    it('成功時に character.update.completed を emit する', async () => {
      // Arrange
      const updated = { characterId: 'char_target0001', characterName: '新名', discordChannelId: '111' }
      characterService.update.mockResolvedValue(updated)
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.update.completed',
        expect.objectContaining({
          character: updated,
          channelId: '111',
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })

    it('description が指定されていれば update にそのまま渡す', async () => {
      // Arrange
      const description = { note: 'メモ' }
      const event = buildEvent({ updateData: { characterName: '新名', description } as any })

      // Act
      await handler.handle(event)

      // Assert
      expect(characterService.update).toHaveBeenCalledWith('char_target0001', expect.objectContaining({ description }))
    })

    it('description 未指定なら update には description: undefined が渡る', async () => {
      // Arrange
      const event = buildEvent({ updateData: { characterName: '新名' } })

      // Act
      await handler.handle(event)

      // Assert
      const passed = characterService.update.mock.calls[0][1]
      expect(passed.description).toBeUndefined()
    })
  })

  describe('handle / 異常系（失敗イベント）', () => {
    it('更新前キャラが存在しなければ CHARACTER_NOT_FOUND で失敗イベントを emit し再スロー', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(null)
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event)).rejects.toThrow(/Character not found for update/)
      expect(characterService.update).not.toHaveBeenCalled()
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.update.failed',
        expect.objectContaining({
          error: expect.stringContaining('Character not found for update'),
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })

    it('update が null を返したら UPDATE_FAILED で失敗イベントを emit し再スロー', async () => {
      // Arrange
      characterService.update.mockResolvedValue(null)
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event)).rejects.toThrow('Character update failed')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.update.failed',
        expect.objectContaining({ error: 'Character update failed' })
      )
    })

    it('update が例外を投げたら failed を emit しエラーを再スローする', async () => {
      // Arrange
      const error = new Error('update boom')
      characterService.update.mockRejectedValue(error)
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event)).rejects.toThrow('update boom')
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.update.failed',
        expect.objectContaining({ error: 'update boom' })
      )
    })

    it('失敗イベントの channelId は元イベントの channelId を優先する', async () => {
      // Arrange
      characterService.update.mockRejectedValue(new Error('boom'))
      const event = buildEvent({ channelId: '999' })

      // Act
      await expect(handler.handle(event)).rejects.toThrow('boom')

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.update.failed',
        expect.objectContaining({ channelId: '999' })
      )
    })
  })

  describe('customValidation（直接呼び出し） / バリデーション分岐', () => {
    const callValidation = (event: CharacterUpdateRequestedEvent) => (handler as any).customValidation(event)

    it('正常な event は通過し findOne で存在確認する', async () => {
      await expect(callValidation(buildEvent())).resolves.toBeUndefined()
      expect(characterService.findOne).toHaveBeenCalledWith('char_target0001')
    })

    it('updateData も source も無いと ValidationError（必須フィールド）', async () => {
      const event = buildEvent({ updateData: undefined as any, source: undefined as any })
      await expect(callValidation(event)).rejects.toMatchObject({ name: 'ValidationError' })
    })

    it('characterId も channelId も無いと ValidationError', async () => {
      const event = buildEvent({ characterId: undefined, channelId: undefined })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('Either characterId or channelId')
      })
    })

    it('updateData が空オブジェクトなら ValidationError', async () => {
      const event = buildEvent({ updateData: {} as any })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('Update data cannot be empty')
      })
    })

    it('characterName が 100 文字超なら ValidationError', async () => {
      const event = buildEvent({ updateData: { characterName: 'あ'.repeat(101) } })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('must not exceed 100 characters')
      })
    })

    it('characterId 指定でキャラが存在しなければ BusinessLogicError(CHARACTER_NOT_FOUND)', async () => {
      characterService.findOne.mockResolvedValue(null)
      await expect(callValidation(buildEvent())).rejects.toMatchObject({
        name: 'BusinessLogicError',
        code: 'CHARACTER_NOT_FOUND'
      })
    })

    it('channelId 指定でキャラが存在しなければ BusinessLogicError(CHARACTER_NOT_FOUND_IN_CHANNEL)', async () => {
      characterService.findByChannelId.mockResolvedValue(null)
      const event = buildEvent({ characterId: undefined, channelId: '222' })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'BusinessLogicError',
        code: 'CHARACTER_NOT_FOUND_IN_CHANNEL'
      })
    })
  })

  describe('calculateChanges（純粋ヘルパ）', () => {
    const calc = (a: any, b: any) => (handler as any).calculateChanges(a, b)

    it('変更されたフィールドのみ old/new を含めて返す', () => {
      const original = { characterName: '旧', status: 'active' }
      const updated = { characterName: '新', status: 'active' }
      const changes = calc(original, updated)
      expect(changes).toEqual([{ field: 'characterName', oldValue: '旧', newValue: '新' }])
    })

    it('オブジェクトフィールドは深い比較で差分を検出する', () => {
      const original = { parameter: { STR: 50 } }
      const updated = { parameter: { STR: 60 } }
      const changes = calc(original, updated)
      expect(changes).toEqual([{ field: 'parameter', oldValue: { STR: 50 }, newValue: { STR: 60 } }])
    })

    it('変更が無ければ空配列を返す', () => {
      const same = { characterName: '同', parameter: { STR: 50 } }
      expect(calc(same, { ...same, parameter: { STR: 50 } })).toEqual([])
    })
  })

  describe('hasChanged（純粋ヘルパ）', () => {
    const hasChanged = (a: any, b: any) => (handler as any).hasChanged(a, b)

    it('両方 null/undefined なら変更なし', () => {
      expect(hasChanged(null, undefined)).toBe(false)
    })

    it('一方だけ null なら変更あり', () => {
      expect(hasChanged(null, 'x')).toBe(true)
    })

    it('オブジェクトは JSON 比較で判定する', () => {
      expect(hasChanged({ a: 1 }, { a: 1 })).toBe(false)
      expect(hasChanged({ a: 1 }, { a: 2 })).toBe(true)
    })

    it('プリミティブは厳密等価で判定する', () => {
      expect(hasChanged(1, 1)).toBe(false)
      expect(hasChanged(1, 2)).toBe(true)
    })
  })

  describe('cloneValue（純粋ヘルパ）', () => {
    const clone = (v: any) => (handler as any).cloneValue(v)

    it('null はそのまま返す', () => {
      expect(clone(null)).toBeNull()
    })

    it('オブジェクトはディープコピーされ参照が異なる', () => {
      const obj = { a: { b: 1 } }
      const cloned = clone(obj)
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.a).not.toBe(obj.a)
    })

    it('プリミティブはそのまま返す', () => {
      expect(clone(42)).toBe(42)
    })
  })

  describe('isRetryableError / getMaxRetries（オーバーライド）', () => {
    it('BusinessLogicError はリトライ不可', () => {
      expect((handler as any).isRetryableError(new BusinessLogicError('x'))).toBe(false)
    })

    it('ValidationError はリトライ不可', () => {
      expect((handler as any).isRetryableError(new ValidationError('x'))).toBe(false)
    })

    it('TimeoutError は親クラス判定でリトライ可', () => {
      const err = new Error('TimeoutError occurred')
      err.name = 'TimeoutError'
      expect((handler as any).isRetryableError(err)).toBe(true)
    })

    it('最大リトライ回数は 2', () => {
      expect((handler as any).getMaxRetries()).toBe(2)
    })
  })
})
