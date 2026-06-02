import { Test } from '@nestjs/testing'
import { CharacterFindByChannelIdRequestedHandler } from './character.findByChannelId.requested'
import { CharacterService } from '../../domains/character/character.service'
import { ValidationError } from './_shared/event-handler.base'
import { CharacterFindByChannelIdRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * CharacterFindByChannelIdRequestedHandler の現状挙動を固定するユニットテスト
 *
 * 依存（CharacterService）は { provide, useValue } でモックし、
 * typedEventService は setTypedEventService 経由でモックを注入する。
 * 「どの依存が・どの引数で呼ばれ・どのイベントを emit するか」を検証する。
 *
 * handle() の主分岐:
 * - 検索でキャラが見つかる → completed を emit（character あり）
 * - 検索で null → completed を emit（character: null）
 * - 検索が throw → failed を emit し、エラーを再スロー
 */
describe('CharacterFindByChannelIdRequestedHandler', () => {
  let handler: CharacterFindByChannelIdRequestedHandler
  let characterService: { findByChannelId: jest.Mock }
  let typedEventService: { emit: jest.Mock }

  const buildEvent = (
    overrides: Partial<CharacterFindByChannelIdRequestedEvent> = {}
  ): CharacterFindByChannelIdRequestedEvent =>
    ({
      type: 'character.findByChannelId.requested',
      timestamp: new Date('2026-06-02T00:00:00Z'),
      source: 'system',
      channelId: '123456789012345678',
      ...overrides
    }) as CharacterFindByChannelIdRequestedEvent

  beforeEach(async () => {
    jest.clearAllMocks()

    characterService = {
      findByChannelId: jest.fn().mockResolvedValue(null)
    }
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterFindByChannelIdRequestedHandler, { provide: CharacterService, useValue: characterService }]
    }).compile()

    handler = moduleRef.get(CharacterFindByChannelIdRequestedHandler)
    handler.setTypedEventService(typedEventService as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getEventName', () => {
    it('character.findByChannelId.requested を返す', () => {
      expect(handler.getEventName()).toBe('character.findByChannelId.requested')
    })
  })

  describe('handle / 正常系（見つかる）', () => {
    it('channelId で findByChannelId を呼ぶ', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue({
        characterId: 'char_abcd1234',
        characterName: 'テストキャラ'
      })
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert
      expect(characterService.findByChannelId).toHaveBeenCalledTimes(1)
      expect(characterService.findByChannelId).toHaveBeenCalledWith('123456789012345678')
    })

    it('見つかったキャラを載せて character.findByChannelId.completed を emit する', async () => {
      // Arrange
      const found = { characterId: 'char_abcd1234', characterName: 'テストキャラ' }
      characterService.findByChannelId.mockResolvedValue(found)
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert: 成功イベントのみ emit
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByChannelId.completed',
        expect.objectContaining({
          channelId: '123456789012345678',
          character: found,
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })
  })

  describe('handle / 正常系（見つからない）', () => {
    it('null でも completed を emit し、character は null で渡す', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(null)
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert: 見つからなくても成功扱いで completed を emit
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByChannelId.completed',
        expect.objectContaining({
          channelId: '123456789012345678',
          character: null,
          source: 'system'
        })
      )
    })
  })

  describe('handle / 異常系（失敗イベント）', () => {
    it('findByChannelId が失敗したら character.findByChannelId.failed を emit し、エラーを再スローする', async () => {
      // Arrange
      const error = new Error('find failed')
      characterService.findByChannelId.mockRejectedValue(error)
      const event = buildEvent()

      // Act & Assert: 再スローされる
      await expect(handler.handle(event)).rejects.toThrow('find failed')

      // Assert: 失敗イベントのみ emit（成功イベントは emit されない）
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByChannelId.failed',
        expect.objectContaining({
          channelId: '123456789012345678',
          error: 'find failed',
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })
  })

  describe('handle / typedEventService 未設定でも例外で落ちない', () => {
    it('typedEventService が未注入なら emit をスキップして正常終了する', async () => {
      // Arrange: setTypedEventService を呼ばない状態を作る
      handler.setTypedEventService(undefined as any)
      characterService.findByChannelId.mockResolvedValue(null)
      const event = buildEvent()

      // Act & Assert: オプショナルチェーンで emit を握りつぶすため例外にならない
      await expect(handler.handle(event)).resolves.toBeUndefined()
    })
  })

  describe('customValidation（直接呼び出し） / バリデーション分岐', () => {
    const callValidation = (event: CharacterFindByChannelIdRequestedEvent) => (handler as any).customValidation(event)

    it('channelId が無いと ValidationError', async () => {
      const event = buildEvent({ channelId: undefined as any })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('channelId')
      })
    })

    it('source が無いと ValidationError', async () => {
      const event = buildEvent({ source: undefined as any })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('source')
      })
    })

    it('channelId が不正な Discord ID 形式なら ValidationError', async () => {
      const event = buildEvent({ channelId: 'not-a-valid-id' })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('valid Discord ID')
      })
    })

    it('正しい形式の channelId は通過する', async () => {
      const event = buildEvent({ channelId: '123456789012345678' })
      await expect(callValidation(event)).resolves.toBeUndefined()
    })
  })

  describe('isRetryableError / getMaxRetries（オーバーライド）', () => {
    it('ValidationError はリトライ不可', () => {
      const result = (handler as any).isRetryableError(new ValidationError('x'))
      expect(result).toBe(false)
    })

    it('TimeoutError は親クラス判定でリトライ可', () => {
      const err = new Error('TimeoutError occurred')
      err.name = 'TimeoutError'
      const result = (handler as any).isRetryableError(err)
      expect(result).toBe(true)
    })

    it('最大リトライ回数は 1', () => {
      expect((handler as any).getMaxRetries()).toBe(1)
    })
  })
})
