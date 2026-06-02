// CharacterEditCreationHandler は characterEdit.creation.requested を処理し、
// 成功時 creation.completed / 失敗時 creation.failed を emit する。discord.js I/O は無い。
// 検証対象:
//   - onModuleInit でリスナー登録
//   - 成功時の emit ペイロード（characterId 生成・originalRequester 保持）
//   - 失敗時の emit ペイロード（error 整形・originalRequester 保持）
// 副作用境界は TypedEventService / CharacterService / 通知系。時刻・乱数は固定して決定的にする。

import { Test } from '@nestjs/testing'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { CharacterService } from 'src/domains/character/character.service'
import { CharacterCreationService } from '../../services/character-creation.service'
import { CharacterNotificationService } from '../../services/character-notification.service'
import { CharacterEditCreationHandler } from './character-edit-creation.handler'

describe('CharacterEditCreationHandler', () => {
  let handler: CharacterEditCreationHandler
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'on' | 'emit'>>
  let characterService: jest.Mocked<Pick<CharacterService, 'create'>>
  let characterNotificationService: jest.Mocked<Pick<CharacterNotificationService, 'notifyCharacterCreated'>>

  const FIXED_NOW = 1_700_000_000_000

  function buildRequestedEvent(overrides: Record<string, unknown> = {}) {
    return {
      type: 'characterEdit.creation.requested',
      createData: { characterName: 'アリス', discordUserId: 'user-1' },
      editContext: { channelId: 'ch-1', sectionType: 'basic', triggeredBy: 'manual' },
      originalRequester: { userId: 'requester-1', interactionId: 'int-1' },
      userId: 'user-1',
      sessionId: 'sess-1',
      ...overrides
    }
  }

  beforeEach(async () => {
    typedEventService = {
      on: jest.fn(),
      emit: jest.fn().mockResolvedValue(undefined)
    }
    characterService = { create: jest.fn() }
    characterNotificationService = { notifyCharacterCreated: jest.fn().mockResolvedValue(undefined) }
    const characterCreationService = {} as CharacterCreationService

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterEditCreationHandler,
        { provide: TypedEventService, useValue: typedEventService },
        { provide: CharacterService, useValue: characterService },
        { provide: CharacterCreationService, useValue: characterCreationService },
        { provide: CharacterNotificationService, useValue: characterNotificationService }
      ]
    }).compile()

    handler = moduleRef.get(CharacterEditCreationHandler)

    jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW)
    jest.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onModuleInit', () => {
    it('characterEdit.creation.requested のリスナーを登録する', async () => {
      // Act
      await handler.onModuleInit()

      // Assert
      expect(typedEventService.on).toHaveBeenCalledWith('characterEdit.creation.requested', expect.any(Function))
    })
  })

  describe('handleCreationRequest', () => {
    it('作成成功時に creation.completed を originalRequester 保持で emit する', async () => {
      // Arrange
      characterService.create.mockResolvedValue({
        characterId: 'char-xyz',
        characterName: 'アリス'
      } as never)
      const event = buildRequestedEvent()

      // Act
      await handler.handleCreationRequest(event as never)

      // Assert
      expect(characterService.create).toHaveBeenCalledTimes(1)
      expect(characterNotificationService.notifyCharacterCreated).toHaveBeenCalledWith('char-xyz', 'ch-1', 'user-1')
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.creation.completed',
        expect.objectContaining({
          type: 'characterEdit.creation.completed',
          characterId: 'char-xyz',
          editContext: event.editContext,
          originalRequester: event.originalRequester,
          userId: 'user-1',
          sessionId: 'sess-1'
        })
      )
    })

    it('characterId 未設定なら時刻と乱数から characterId を生成して create に渡す', async () => {
      // Arrange
      characterService.create.mockResolvedValue({ characterId: 'char-xyz' } as never)
      const event = buildRequestedEvent()

      // Act
      await handler.handleCreationRequest(event as never)

      // Assert: ch_{Date.now()}_{random base36} 形式
      const createdArg = characterService.create.mock.calls[0][0] as { characterId: string }
      expect(createdArg.characterId).toMatch(/^ch_1700000000000_[a-z0-9]+$/)
    })

    it('作成失敗時に creation.failed を error 整形・originalRequester 保持で emit する', async () => {
      // Arrange
      const error = new TypeError('create boom')
      characterService.create.mockRejectedValue(error)
      const event = buildRequestedEvent()

      // Act
      await handler.handleCreationRequest(event as never)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.creation.failed',
        expect.objectContaining({
          type: 'characterEdit.creation.failed',
          characterId: 'アリス', // 失敗時は characterName を入れる現挙動
          originalRequester: event.originalRequester,
          error: expect.objectContaining({
            code: 'TypeError',
            message: 'create boom'
          })
        })
      )
      // 失敗時は completed を emit しない
      expect(typedEventService.emit).not.toHaveBeenCalledWith('characterEdit.creation.completed', expect.anything())
    })
  })
})
