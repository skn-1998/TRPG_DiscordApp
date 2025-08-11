import { Test, TestingModule } from '@nestjs/testing'
import { AddCharaInfoService } from './add-chara-info.service'
import { DiscordIntegrationService } from '../../application/discord-integration.service'
import { ConfigService } from '@nestjs/config'
import { ModalSubmitInteraction, ChannelType } from 'discord.js'

describe('AddCharaInfoService - Phase 3 Event-Driven', () => {
  let service: AddCharaInfoService
  let discordIntegration: jest.Mocked<DiscordIntegrationService>
  let configService: jest.Mocked<ConfigService>

  // シンプルなチャンネルモック
  const mockChannel = {
    id: 'test-channel-id',
    name: 'test-character',
    type: ChannelType.GuildText,
    send: jest.fn().mockResolvedValue({ delete: jest.fn() })
  }

  const mockInteraction = {
    channel: mockChannel,
    channelId: 'test-channel-id',
    user: { id: 'test-user-id' },
    deferUpdate: jest.fn(),
    reply: jest.fn(),
    fields: {
      components: [
        {
          components: [
            {
              value: 'characterName: TestCharacter\nHP: 100',
              customId: 'status'
            }
          ]
        }
      ]
    }
  } as unknown as ModalSubmitInteraction

  beforeEach(async () => {
    const mockDiscordIntegration = {
      requestCharacterUpdate: jest.fn()
    }

    const mockConfigService = {
      get: jest.fn()
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddCharaInfoService,
        {
          provide: DiscordIntegrationService,
          useValue: mockDiscordIntegration
        },
        {
          provide: ConfigService,
          useValue: mockConfigService
        }
      ]
    }).compile()

    service = module.get<AddCharaInfoService>(AddCharaInfoService)
    discordIntegration = module.get(DiscordIntegrationService)
    configService = module.get(ConfigService)
  })

  describe('execute', () => {
    it('should successfully request character update via DiscordIntegration', async () => {
      // Execute
      await service.execute(mockInteraction)

      // Verify
      expect(mockInteraction.deferUpdate).toHaveBeenCalled()
      expect(discordIntegration.requestCharacterUpdate).toHaveBeenCalledWith(
        'test-channel-id',
        {
          status: expect.any(Object)
        },
        'test-user-id'
      )
    })

    it('should handle invalid channel gracefully', async () => {
      // Setup
      const invalidInteraction = {
        ...mockInteraction,
        channel: null,
        deferUpdate: jest.fn()
      } as unknown as ModalSubmitInteraction

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Execute
      await service.execute(invalidInteraction)

      // Verify
      expect(consoleSpy).toHaveBeenCalledWith('Invalid channel')
      expect(discordIntegration.requestCharacterUpdate).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle invalid update field gracefully', async () => {
      // Setup
      const invalidFieldInteraction = {
        ...mockInteraction,
        fields: {
          components: [
            {
              components: [
                {
                  value: 'test data',
                  customId: 'invalid-field'
                }
              ]
            }
          ]
        }
      } as unknown as ModalSubmitInteraction

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Execute
      await service.execute(invalidFieldInteraction)

      // Verify
      expect(consoleSpy).toHaveBeenCalledWith('Invalid update field')
      expect(discordIntegration.requestCharacterUpdate).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle empty input gracefully', async () => {
      // Setup
      const emptyInputInteraction = {
        ...mockInteraction,
        channel: mockChannel,
        fields: {
          components: [
            {
              components: [
                {
                  value: '',
                  customId: 'status'
                }
              ]
            }
          ]
        }
      } as unknown as ModalSubmitInteraction

      // Execute
      await service.execute(emptyInputInteraction)

      // Verify
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: '送信した値のフォーマットが不適切です'
      })
      expect(discordIntegration.requestCharacterUpdate).not.toHaveBeenCalled()
    })

    it('should handle errors gracefully', async () => {
      // Setup
      discordIntegration.requestCharacterUpdate.mockRejectedValue(new Error('Integration error'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      // Execute
      await service.execute(mockInteraction)

      // Verify
      expect(consoleSpy).toHaveBeenCalledWith('Error in AddCharaInfoService:', expect.any(Error))
      expect(mockChannel.send).toHaveBeenCalledWith({
        content: 'キャラクター情報の更新中にエラーが発生しました'
      })

      consoleSpy.mockRestore()
    })
  })

  describe('initialSetting', () => {
    it('should set character info config', () => {
      // Setup
      const config = { customId: 'test-custom-id' } as any

      // Execute
      const result = service.initialSetting(config)

      // Verify
      expect(result).toBe(service)
    })
  })

  describe('data getter', () => {
    it('should return modal builder with correct configuration', () => {
      // Setup - 重要: initialSettingを呼び出してから_characterInfoConfigを設定
      const config = { customId: 'test-modal' } as any
      service.initialSetting(config)

      // Execute
      const modalBuilder = service.data

      // Verify
      expect(modalBuilder.toJSON().custom_id).toBe('test-modal')
      expect(modalBuilder.toJSON().title).toBe('キャラクター情報追加')
    })
  })
})
