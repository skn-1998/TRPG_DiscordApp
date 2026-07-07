// CharacterEditEventEmitterService は interaction から情報を抽出し characterEdit.* を emit する。
// util（enhanced-character-edit.util）は純ロジックなのでモックせず実物を使う。
// 副作用境界は TypedEventService.emit のみ。検証対象:
//   - customId 抽出失敗時の早期 return（emit されない）
//   - emit ペイロード（sectionType 正規化）
//   - emit 失敗時の try/catch 握り潰し（例外を投げない）
// ※ セクション選択/フィールド選択の dead emit メソッドは E-3c で撤去済み。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { createMockButtonInteraction, createMockModalInteraction } from '@discord-test-utils'
import { CharacterEditEventEmitterService } from './character-edit-event-emitter.service'

describe('CharacterEditEventEmitterService', () => {
  let service: CharacterEditEventEmitterService
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'emit'>>

  beforeEach(async () => {
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterEditEventEmitterService, { provide: TypedEventService, useValue: typedEventService }]
    }).compile()

    service = moduleRef.get(CharacterEditEventEmitterService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('emitModalOpened', () => {
    it('customId から characterId を抽出できない場合は emit しない', async () => {
      // Arrange: refresh/compact-view パターンに合致しない customId
      const interaction = createMockButtonInteraction({ customId: 'char-edit-status-hp' })

      // Act
      await service.emitModalOpened(interaction)

      // Assert
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('characterId を抽出できたら characterEdit.modal.opened を emit する', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({ customId: 'character-refresh-abc123' })

      // Act
      await service.emitModalOpened(interaction)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.modal.opened',
        expect.objectContaining({ characterId: 'abc123' })
      )
    })

    it('emit が例外を投げても握り潰して再スローしない', async () => {
      // Arrange
      typedEventService.emit.mockRejectedValue(new Error('emit boom'))
      const interaction = createMockButtonInteraction({ customId: 'character-refresh-abc123' })

      // Act & Assert: 例外が外に漏れない
      await expect(service.emitModalOpened(interaction)).resolves.toBeUndefined()
    })
  })

  describe('emitModalSubmitted', () => {
    it('customId と fields から値を取り出し modal.submitted を emit する', async () => {
      // Arrange: customId 'char-edit-status-hp-char-123' → sectionType=status, fieldKey=hp
      const interaction = createMockModalInteraction({
        customId: 'char-edit-status-hp-char-123',
        fields: { 'status-hp': '999' }
      })

      // Act
      await service.emitModalSubmitted(interaction)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.modal.submitted',
        expect.objectContaining({
          characterId: '123',
          modal: expect.objectContaining({ sectionType: 'status', fieldKey: 'hp' })
        })
      )
    })
  })

  describe('emitError', () => {
    it('error.occurred を emit し、抽出不能な customId は characterId=unknown とする', async () => {
      // Arrange
      const error = new Error('something broke')

      // Act
      await service.emitError(error, 'invalid-id', 'user-1')

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.error.occurred',
        expect.objectContaining({
          characterId: 'unknown',
          userId: 'user-1',
          error: expect.objectContaining({ message: 'something broke' })
        })
      )
    })
  })
})
