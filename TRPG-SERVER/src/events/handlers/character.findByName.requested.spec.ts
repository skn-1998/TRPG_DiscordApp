import { Test } from '@nestjs/testing'
import { CharacterFindByNameRequestedHandler } from './character.findByName.requested'
import { CharacterRepository } from '../../domains/character/repositories/character.repository'
import { CharacterFindByNameRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * CharacterFindByNameRequestedHandler の現状挙動を固定するユニットテスト
 *
 * 依存（CharacterRepository）は { provide, useValue } でモックし、
 * typedEventService は setTypedEventService 経由でモックを注入する。
 * 「検索結果に応じてどの完了/失敗イベントを emit するか」を検証する。
 */
describe('CharacterFindByNameRequestedHandler', () => {
  let handler: CharacterFindByNameRequestedHandler
  let characterRepository: { findByName: jest.Mock }
  let typedEventService: { emit: jest.Mock }

  const buildEvent = (overrides: Partial<CharacterFindByNameRequestedEvent> = {}): CharacterFindByNameRequestedEvent =>
    ({
      type: 'character.findByName.requested',
      timestamp: new Date('2026-06-02T00:00:00Z'),
      source: 'system',
      characterName: 'テストキャラ',
      ...overrides
    }) as CharacterFindByNameRequestedEvent

  beforeEach(async () => {
    jest.clearAllMocks()

    characterRepository = {
      findByName: jest.fn().mockResolvedValue(null)
    }
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterFindByNameRequestedHandler, { provide: CharacterRepository, useValue: characterRepository }]
    }).compile()

    handler = moduleRef.get(CharacterFindByNameRequestedHandler)
    handler.setTypedEventService(typedEventService as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getEventName', () => {
    it('character.findByName.requested を返す', () => {
      expect(handler.getEventName()).toBe('character.findByName.requested')
    })
  })

  describe('handle / 正常系（発見）', () => {
    it('キャラが見つかれば repository に名前を渡し completed を emit する', async () => {
      // Arrange
      const character = { characterId: 'char_found00001', characterName: 'テストキャラ' }
      characterRepository.findByName.mockResolvedValue(character)
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert
      expect(characterRepository.findByName).toHaveBeenCalledWith('テストキャラ')
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByName.completed',
        expect.objectContaining({
          characterName: 'テストキャラ',
          character,
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })
  })

  describe('handle / 異常系（未発見）', () => {
    it('キャラが見つからなければ failed(Character not found) を emit する', async () => {
      // Arrange
      characterRepository.findByName.mockResolvedValue(null)
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByName.failed',
        expect.objectContaining({
          characterName: 'テストキャラ',
          error: 'Character not found',
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })

    it('findByName が未実装（undefined）でも failed を emit して落ちない', async () => {
      // Arrange: オプショナルチェーンで undefined になるケース
      ;(characterRepository as any).findByName = undefined
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByName.failed',
        expect.objectContaining({ error: 'Character not found' })
      )
    })
  })

  describe('handle / 異常系（例外）', () => {
    it('repository が例外を投げたら failed を emit しエラーを再スローする', async () => {
      // Arrange
      const error = new Error('db down')
      characterRepository.findByName.mockRejectedValue(error)
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event)).rejects.toThrow('db down')
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByName.failed',
        expect.objectContaining({
          characterName: 'テストキャラ',
          error: 'db down',
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })

    it('Error 以外が throw された場合は error: Unknown error を emit する', async () => {
      // Arrange
      characterRepository.findByName.mockRejectedValue('文字列エラー')
      const event = buildEvent()

      // Act & Assert
      await expect(handler.handle(event)).rejects.toBe('文字列エラー')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.findByName.failed',
        expect.objectContaining({ error: 'Unknown error' })
      )
    })
  })

  describe('isRetryableError / getMaxRetries（オーバーライド）', () => {
    it('database を含むエラーはリトライ可', () => {
      expect((handler as any).isRetryableError(new Error('database error'))).toBe(true)
    })

    it('connection を含むエラーはリトライ可', () => {
      expect((handler as any).isRetryableError(new Error('connection refused'))).toBe(true)
    })

    it('通常の Error はリトライ不可', () => {
      expect((handler as any).isRetryableError(new Error('something else'))).toBe(false)
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
