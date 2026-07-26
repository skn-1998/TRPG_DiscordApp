// CharacterEditChannelCreateListenerService は ChannelCreate を検出し
// ChannelCreateOrchestratorService へ委譲する薄い listener。
// 副作用境界は DiscordClientService.on（リスナー登録）と ChannelCreateOrchestratorService.execute。
//   - onModuleInit: DiscordClientService.on(ChannelCreate) にハンドラを登録
//   - handler: GuildText のみ orchestrator.execute へ委譲 / それ以外は skip / error は握りつぶす
// jest-setup の discord.js モックには ChannelType.GuildText / Events.ChannelCreate が無いため、
// ここではローカルで実値を補完する（実値依存の分岐を正しく検証するため）。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { ChannelType, Events } from 'discord.js'
import type { NonThreadGuildBasedChannel, TextChannel } from 'discord.js'
import { DiscordClientService } from '../../../services/discord-client.service'
import { DiscordController } from '../../../discord.controller'
import type { DiscordFacadeService } from '../../../discord-facade.service'
import type { CharacterService } from '../../../../domains/character/character.service'
import type { AppConfigService } from '../../../../config/config.service'
import type { TypedEventService } from '../../../../core/events/typed-event.service'
import type { CharacterEmbedManagerService } from './character-embed-manager.service'
import type { CharacterNotificationService } from './character-notification.service'
import { ChannelDetectionService } from './channel-detection.service'
import { ChannelCreateOrchestratorService } from './channel-create-orchestrator.service'
import { CharacterEditChannelCreateListenerService } from './character-edit-channel-create-listener.service'

describe('CharacterEditChannelCreateListenerService', () => {
  let service: CharacterEditChannelCreateListenerService
  let discordClientService: jest.Mocked<Pick<DiscordClientService, 'on'>>
  let channelCreateOrchestratorService: jest.Mocked<Pick<ChannelCreateOrchestratorService, 'execute'>>

  async function createService(): Promise<CharacterEditChannelCreateListenerService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterEditChannelCreateListenerService,
        { provide: DiscordClientService, useValue: discordClientService },
        { provide: ChannelCreateOrchestratorService, useValue: channelCreateOrchestratorService }
      ]
    }).compile()

    return moduleRef.get(CharacterEditChannelCreateListenerService)
  }

  /** discordClientService.on に登録された ChannelCreate コールバックを取り出すヘルパー */
  function getChannelCreateHandler(): (channel: NonThreadGuildBasedChannel) => Promise<void> {
    const call = discordClientService.on.mock.calls.find((c) => c[0] === String(Events.ChannelCreate))
    expect(call).toBeDefined()
    return call![1] as (channel: NonThreadGuildBasedChannel) => Promise<void>
  }

  beforeEach(() => {
    discordClientService = { on: jest.fn() }
    channelCreateOrchestratorService = { execute: jest.fn().mockResolvedValue(undefined) }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('onModuleInit', () => {
    it('DiscordClientService に ChannelCreate リスナーを登録する', async () => {
      // Arrange
      service = await createService()

      // Act
      service.onModuleInit()

      // Assert
      expect(discordClientService.on).toHaveBeenCalledWith(Events.ChannelCreate, expect.any(Function))
    })
  })

  describe('ChannelCreate handler', () => {
    it('GuildText チャンネルでは orchestrator.execute に委譲する', async () => {
      // Arrange
      service = await createService()
      service.onModuleInit()
      const handler = getChannelCreateHandler()
      const textChannel = {
        type: ChannelType.GuildText,
        id: 'ch-1',
        name: 'general'
      } as unknown as NonThreadGuildBasedChannel

      // Act
      await handler(textChannel)

      // Assert
      expect(channelCreateOrchestratorService.execute).toHaveBeenCalledWith(textChannel as unknown as TextChannel)
    })

    it('GuildText 以外のチャンネルでは orchestrator.execute を呼ばない', async () => {
      // Arrange
      service = await createService()
      service.onModuleInit()
      const handler = getChannelCreateHandler()
      const voiceChannel = {
        type: ChannelType.GuildVoice,
        id: 'ch-2',
        name: 'voice'
      } as unknown as NonThreadGuildBasedChannel

      // Act
      await handler(voiceChannel)

      // Assert
      expect(channelCreateOrchestratorService.execute).not.toHaveBeenCalled()
    })

    it('orchestrator.execute が throw しても handler から例外を外へ伝播しない', async () => {
      // Arrange
      service = await createService()
      channelCreateOrchestratorService.execute.mockRejectedValue(new Error('orchestrator boom'))
      service.onModuleInit()
      const handler = getChannelCreateHandler()
      const textChannel = {
        type: ChannelType.GuildText,
        id: 'ch-3',
        name: 'general'
      } as unknown as NonThreadGuildBasedChannel

      // Act & Assert: 例外が外に漏れないこと
      await expect(handler(textChannel)).resolves.toBeUndefined()
      expect(channelCreateOrchestratorService.execute).toHaveBeenCalledTimes(1)
    })
  })

  describe('postCharacterとの順序制御結合', () => {
    it('createChannelのresolve前にlistenerが開始してもsuppressionによりキャラクターと副作用を重複させない', async () => {
      const channelId = 'bot-managed-channel'
      const storedCharacters = [
        {
          characterId: 'char-1',
          characterName: 'Hero',
          discordChannelId: undefined as string | undefined
        }
      ]
      const completionEvent = jest.fn()
      const secondEmbed = jest.fn()
      const threadCreationRequest = jest.fn()
      const typedEventService = {
        emit: jest.fn(async () => {
          storedCharacters.push({
            characterId: 'auto-created-character',
            characterName: 'hero',
            discordChannelId: channelId
          })
          completionEvent()
          secondEmbed()
          threadCreationRequest()
        })
      }
      const characterCategory = {
        id: 'character-category',
        name: 'character-category-name'
      }
      const fetchAuditLogs = jest.fn().mockRejectedValue(new Error('Audit log unavailable'))
      const createdChannel = {
        type: ChannelType.GuildText,
        id: channelId,
        name: 'hero',
        parentId: characterCategory.id,
        guild: {
          channels: {
            cache: {
              find: (predicate: (channel: typeof characterCategory) => boolean) => [characterCategory].find(predicate)
            }
          },
          fetchAuditLogs
        }
      } as unknown as NonThreadGuildBasedChannel
      const channelDetectionService = new ChannelDetectionService({
        get: jest.fn().mockReturnValue(characterCategory.name)
      } as unknown as AppConfigService)

      const orchestrator = new ChannelCreateOrchestratorService(
        channelDetectionService,
        { notifyCharacterCreation: jest.fn() } as unknown as CharacterNotificationService,
        typedEventService as unknown as TypedEventService,
        { getClient: jest.fn() } as unknown as DiscordClientService
      )
      let registeredHandler: ((channel: NonThreadGuildBasedChannel) => Promise<void>) | undefined
      const listener = new CharacterEditChannelCreateListenerService(
        {
          on: jest.fn((_eventName: string, handler: unknown) => {
            registeredHandler = handler as (channel: NonThreadGuildBasedChannel) => Promise<void>
          })
        } as unknown as DiscordClientService,
        orchestrator
      )
      listener.onModuleInit()

      let listenerPromise: Promise<void> | undefined
      const discordFacade = {
        verifyGuildManagePermission: jest.fn().mockResolvedValue(true),
        getGuildInfo: jest.fn().mockResolvedValue({
          channels: [{ id: 'character-category', name: 'character', type: 'GuildCategory' }]
        }),
        createChannel: jest.fn(
          () =>
            new Promise<{ success: true; channelId: string }>((resolve) => {
              if (!registeredHandler) {
                throw new Error('ChannelCreate listener is not registered')
              }

              listenerPromise = registeredHandler(createdChannel)
              expect(fetchAuditLogs).toHaveBeenCalledTimes(1)
              resolve({ success: true, channelId })
            })
        ),
        sendMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'message-1' })
      }
      const characterService = {
        findOneForOwner: jest.fn().mockImplementation(async () => storedCharacters[0]),
        updateForOwner: jest
          .fn()
          .mockImplementation(async (_characterId: string, _ownerId: string, update: { discordChannelId: string }) => {
            Object.assign(storedCharacters[0], update)
            return { ...storedCharacters[0] }
          })
      }
      const characterEmbedManager = {
        createSectionedEmbeds: jest.fn().mockResolvedValue({
          embeds: [{ title: 'Hero' }],
          components: []
        })
      }
      const controller = new DiscordController(
        discordFacade as unknown as DiscordFacadeService,
        characterService as unknown as CharacterService,
        characterEmbedManager as unknown as CharacterEmbedManagerService,
        channelDetectionService
      )

      const result = await controller.postCharacter({ characterId: 'char-1', guildId: 'guild-1' }, {
        user: { discordUserId: 'owner-1', id: 'user-1', username: 'owner' }
      } as any)
      await listenerPromise

      expect(result).toEqual({ success: true, messageId: 'message-1' })
      expect(storedCharacters.filter((character) => character.discordChannelId === channelId)).toHaveLength(1)
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(completionEvent).not.toHaveBeenCalled()
      expect(characterEmbedManager.createSectionedEmbeds).toHaveBeenCalledTimes(1)
      expect(secondEmbed).not.toHaveBeenCalled()
      expect(threadCreationRequest).not.toHaveBeenCalled()
    })

    it('suppression未登録の手動作成チャンネルは従来どおり自動作成する', async () => {
      const manualChannel = {
        type: ChannelType.GuildText,
        id: 'manual-channel',
        name: 'manual-character'
      } as unknown as NonThreadGuildBasedChannel
      const storedCharacters: Array<{ discordChannelId: string }> = []
      const typedEventService = {
        emit: jest.fn(async (_eventName: string, payload: { createData: { discordChannelId: string } }) => {
          storedCharacters.push({ discordChannelId: payload.createData.discordChannelId })
        })
      }
      const channelDetectionService = new ChannelDetectionService({
        get: jest.fn()
      } as unknown as AppConfigService)
      jest.spyOn(channelDetectionService, 'detectCharacterChannel').mockImplementation(async (channel) => {
        await Promise.resolve()
        return {
          success: true,
          shouldCreateCharacter: true,
          context: {
            channel,
            categoryId: 'character-category',
            creatorId: 'manual-user'
          }
        }
      })
      const orchestrator = new ChannelCreateOrchestratorService(
        channelDetectionService,
        { notifyCharacterCreation: jest.fn() } as unknown as CharacterNotificationService,
        typedEventService as unknown as TypedEventService,
        { getClient: jest.fn() } as unknown as DiscordClientService
      )
      let registeredHandler: ((channel: NonThreadGuildBasedChannel) => Promise<void>) | undefined
      const listener = new CharacterEditChannelCreateListenerService(
        {
          on: jest.fn((_eventName: string, handler: unknown) => {
            registeredHandler = handler as (channel: NonThreadGuildBasedChannel) => Promise<void>
          })
        } as unknown as DiscordClientService,
        orchestrator
      )
      listener.onModuleInit()

      await registeredHandler!(manualChannel)

      expect(channelDetectionService.isBotManagedChannel('manual-channel')).toBe(false)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.creation.requested',
        expect.objectContaining({
          createData: expect.objectContaining({ discordChannelId: 'manual-channel' })
        })
      )
      expect(storedCharacters).toEqual([{ discordChannelId: 'manual-channel' }])
    })
  })
})
