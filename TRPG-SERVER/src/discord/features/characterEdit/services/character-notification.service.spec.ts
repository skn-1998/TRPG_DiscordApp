import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { CharacterNotificationService } from './character-notification.service'

// Mock dependencies
jest.mock('src/config/configuration')
jest.mock('../../events/events.list', () => ({
  changeCharacterInfoConfig: {
    customId: 'change-character-info',
    placeholder: 'キャラクター情報を選択してください'
  }
}))

describe('CharacterNotificationService', () => {
  let service: CharacterNotificationService
  let module: TestingModule

  const mockTextChannel = {
    id: 'test-channel-id',
    name: 'test-character',
    send: jest.fn()
  } as unknown as TextChannel

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CharacterNotificationService]
    }).compile()

    service = moduleRef.get<CharacterNotificationService>(CharacterNotificationService)
    module = moduleRef

    // Reset mocks
    jest.clearAllMocks()

    // Mock generateAppConfig
    const { generateAppConfig } = require('src/config/configuration')
    generateAppConfig.mockReturnValue({
      app: { frontendUrl: 'http://localhost:3000' }
    })
  })

  afterEach(async () => {
    await module.close()
  })

  describe('notifyCharacterCreation', () => {
    it('should send notification successfully', async () => {
      await service.notifyCharacterCreation(mockTextChannel, 'test-character-id', 'test-character')

      expect(mockTextChannel.send).toHaveBeenCalledWith({
        content: 'http://localhost:3000/characters/test-character-id',
        components: expect.any(Array)
      })
    })

    it('should handle notification errors', async () => {
      mockTextChannel.send = jest.fn().mockRejectedValue(new Error('Send failed'))

      await expect(
        service.notifyCharacterCreation(mockTextChannel, 'test-character-id', 'test-character')
      ).rejects.toThrow('Send failed')
    })

    it('should log success message', async () => {
      const loggerSpy = jest.spyOn(Logger.prototype, 'log')

      await service.notifyCharacterCreation(mockTextChannel, 'test-character-id', 'test-character')

      expect(loggerSpy).toHaveBeenCalledWith('キャラクター「test-character」の通知を送信しました')
    })

    it('should log error message on failure', async () => {
      mockTextChannel.send = jest.fn().mockRejectedValue(new Error('Send failed'))
      const loggerSpy = jest.spyOn(Logger.prototype, 'error')

      try {
        await service.notifyCharacterCreation(mockTextChannel, 'test-character-id', 'test-character')
      } catch (error) {
        // Expected error
      }

      expect(loggerSpy).toHaveBeenCalledWith('キャラクター通知エラー:', expect.any(Error))
    })
  })
})
