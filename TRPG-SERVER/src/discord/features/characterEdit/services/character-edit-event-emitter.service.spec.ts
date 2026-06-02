// CharacterEditEventEmitterService は interaction から情報を抽出し characterEdit.* を emit する。
// util（enhanced-character-edit.util）は純ロジックなのでモックせず実物を使う。
// 副作用境界は TypedEventService.emit のみ。検証対象:
//   - customId 抽出失敗時の早期 return（emit されない）
//   - emit ペイロード（sectionType 正規化・section と field の同時発火）
//   - emit 失敗時の try/catch 握り潰し（例外を投げない）
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { TypedEventService } from 'src/core/events/typed-event.service'
import {
  createMockButtonInteraction,
  createMockSelectMenuInteraction,
  createMockModalInteraction
} from '@discord-test-utils'
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
  })

  describe('emitSectionSelected', () => {
    it('characterId 抽出失敗時は section も field も emit しない', async () => {
      // Arrange
      const interaction = createMockSelectMenuInteraction({
        customId: 'invalid-id',
        values: ['status-hp']
      })

      // Act
      await service.emitSectionSelected(interaction)

      // Assert
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('section.selected と field.selected を同時に emit し sectionType を正規化する', async () => {
      // Arrange: value 'status-hp' → sectionType=status, fieldKey=hp
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-refresh-abc123',
        values: ['status-hp']
      })

      // Act
      await service.emitSectionSelected(interaction)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.section.selected',
        expect.objectContaining({
          characterId: 'abc123',
          section: expect.objectContaining({ sectionType: 'status' })
        })
      )
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.field.selected',
        expect.objectContaining({
          characterId: 'abc123',
          field: expect.objectContaining({ sectionType: 'status', fieldKey: 'hp' })
        })
      )
    })

    it('未知の sectionType は basic に正規化される', async () => {
      // Arrange: value 'unknownsection-foo'
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-refresh-abc123',
        values: ['unknownsection-foo']
      })

      // Act
      await service.emitSectionSelected(interaction)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'characterEdit.section.selected',
        expect.objectContaining({
          section: expect.objectContaining({ sectionType: 'basic' })
        })
      )
    })

    it('fieldKey が unknown のときは field.selected を発火しない', async () => {
      // Arrange: value 'status'（fieldKey なし → 'unknown'）
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-refresh-abc123',
        values: ['status']
      })

      // Act
      await service.emitSectionSelected(interaction)

      // Assert: section は発火するが field は発火しない
      expect(typedEventService.emit).toHaveBeenCalledWith('characterEdit.section.selected', expect.anything())
      expect(typedEventService.emit).not.toHaveBeenCalledWith('characterEdit.field.selected', expect.anything())
    })

    it('emit が例外を投げても握り潰して再スローしない', async () => {
      // Arrange
      typedEventService.emit.mockRejectedValue(new Error('emit boom'))
      const interaction = createMockSelectMenuInteraction({
        customId: 'character-refresh-abc123',
        values: ['status-hp']
      })

      // Act & Assert: 例外が外に漏れない
      await expect(service.emitSectionSelected(interaction)).resolves.toBeUndefined()
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
