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
})
