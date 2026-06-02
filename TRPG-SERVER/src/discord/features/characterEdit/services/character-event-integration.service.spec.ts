// CharacterEventIntegrationService は registerEventHandlers が無効化済みで、
// onModuleInit は実質 no-op（リスナー登録もイベント発行もしない）。
// 将来削除予定のため private handler は深追いせず、no-op 挙動の固定に留める。
// 副作用境界は TypedEventService（on / emit が呼ばれないことを保証）。

import { Test } from '@nestjs/testing'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { CharacterService } from 'src/domains/character/character.service'
import { CharacterCreationService } from './character-creation.service'
import { CharacterNotificationService } from './character-notification.service'
import { CharacterEventIntegrationService } from './character-event-integration.service'

describe('CharacterEventIntegrationService', () => {
  let service: CharacterEventIntegrationService
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'on' | 'emit'>>

  beforeEach(async () => {
    typedEventService = {
      on: jest.fn(),
      emit: jest.fn().mockResolvedValue(undefined)
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterEventIntegrationService,
        { provide: TypedEventService, useValue: typedEventService },
        { provide: CharacterService, useValue: {} },
        { provide: CharacterCreationService, useValue: {} },
        { provide: CharacterNotificationService, useValue: {} }
      ]
    }).compile()

    service = moduleRef.get(CharacterEventIntegrationService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onModuleInit', () => {
    it('リスナー登録が無効化されているため on を呼ばない', async () => {
      // Act
      await service.onModuleInit()

      // Assert
      expect(typedEventService.on).not.toHaveBeenCalled()
    })

    it('初期化時にイベントを emit しない', async () => {
      // Act
      await service.onModuleInit()

      // Assert
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('例外を投げずに完了する', async () => {
      // Act & Assert
      await expect(service.onModuleInit()).resolves.toBeUndefined()
    })
  })
})
