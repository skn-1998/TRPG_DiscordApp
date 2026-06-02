// InteractionsController は Discord.js インタラクションの薄いルーティング層。
// 検証対象は「委譲経路」と「分岐・異常系のハンドリング」のみ（ビジネスロジックは持たない）。
//   - handleInteraction: replied/deferred 早期 return / route 委譲 / 未登録応答 / 例外応答
//   - handleCommand → handleChannelCreate: ChannelCreate リスナー登録と channel.type 分岐
// jest-setup の discord.js モックには ChannelType.GuildText / Events.ChannelCreate が無いため、
// ここではローカルで実値を補完する（実値依存の分岐を正しく検証するため）。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { ChannelType, Events } from 'discord.js'
import type { ButtonInteraction, Client, TextChannel, NonThreadGuildBasedChannel } from 'discord.js'
import { ChannelCreateOrchestratorService } from '../features/characterEdit/services/channel-create-orchestrator.service'
import { InteractionsController } from './interactions.controller'
import { InteractionRegistryService } from './registry/interaction-registry.service'

/** 最小のインタラクションスタブを生成する */
function createInteractionStub(
  overrides: Partial<{
    replied: boolean
    deferred: boolean
    reply: jest.Mock
  }> = {}
): ButtonInteraction {
  return {
    id: 'interaction-id',
    type: 3,
    customId: 'test-custom-id',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as ButtonInteraction
}

describe('InteractionsController', () => {
  let controller: InteractionsController
  let interactionRegistry: jest.Mocked<Pick<InteractionRegistryService, 'route'>>
  let channelCreateOrchestratorService: jest.Mocked<Pick<ChannelCreateOrchestratorService, 'execute'>>

  beforeEach(async () => {
    interactionRegistry = { route: jest.fn() }
    channelCreateOrchestratorService = { execute: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      controllers: [InteractionsController],
      providers: [
        { provide: InteractionRegistryService, useValue: interactionRegistry },
        { provide: ChannelCreateOrchestratorService, useValue: channelCreateOrchestratorService }
      ]
    }).compile()

    controller = moduleRef.get(InteractionsController)
  })

  describe('handleInteraction', () => {
    it('応答済み(replied)のインタラクションは route せず即 return する', async () => {
      // Arrange
      const interaction = createInteractionStub({ replied: true })

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interactionRegistry.route).not.toHaveBeenCalled()
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('遅延応答中(deferred)のインタラクションは route せず即 return する', async () => {
      // Arrange
      const interaction = createInteractionStub({ deferred: true })

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interactionRegistry.route).not.toHaveBeenCalled()
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('未応答のインタラクションは interactionRegistry.route に委譲する', async () => {
      // Arrange
      const interaction = createInteractionStub()
      interactionRegistry.route.mockResolvedValue(true)

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interactionRegistry.route).toHaveBeenCalledWith(interaction)
    })

    it('route が true を返したら reply しない（ハンドラ処理済み）', async () => {
      // Arrange
      const interaction = createInteractionStub()
      interactionRegistry.route.mockResolvedValue(true)

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('route が false かつ未応答なら未登録エフェメラル応答を返す', async () => {
      // Arrange
      const interaction = createInteractionStub()
      interactionRegistry.route.mockResolvedValue(false)

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: '⚠️ このインタラクションは現在処理できません。',
        ephemeral: true
      })
    })

    it('route が false でも既に応答済みなら reply しない', async () => {
      // Arrange: route 中に応答済みになったケースを模す（reply 済みフラグを true に）
      const interaction = createInteractionStub()
      interactionRegistry.route.mockImplementation(async () => {
        ;(interaction as unknown as { replied: boolean }).replied = true
        return false
      })

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('route が throw した場合、未応答ならエラーエフェメラル応答を返す', async () => {
      // Arrange
      const interaction = createInteractionStub()
      interactionRegistry.route.mockRejectedValue(new Error('boom'))

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith({
        content: '❌ 処理中にエラーが発生しました。',
        ephemeral: true
      })
    })

    it('route が throw し既に応答済みならエラー応答を送らない', async () => {
      // Arrange
      const interaction = createInteractionStub({ deferred: true, replied: false })
      // deferred=true なので catch 内の応答条件を満たさない
      interactionRegistry.route.mockRejectedValue(new Error('boom'))

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('route が throw しエラー応答の reply 自体も throw しても例外を握りつぶす', async () => {
      // Arrange
      const replyMock = jest.fn().mockRejectedValue(new Error('reply failed'))
      const interaction = createInteractionStub({ reply: replyMock })
      interactionRegistry.route.mockRejectedValue(new Error('boom'))

      // Act & Assert: 例外が外に漏れないこと
      await expect(controller.handleInteraction(interaction)).resolves.toBeUndefined()
      expect(replyMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('handleCommand / handleChannelCreate', () => {
    /** client.on に登録された ChannelCreate コールバックを取り出すヘルパー */
    function setupClientAndGetCallback(): {
      client: Client
      callback: (channel: NonThreadGuildBasedChannel) => Promise<void>
    } {
      const on = jest.fn()
      const client = { on } as unknown as Client

      controller.handleCommand(client)

      const call = on.mock.calls.find((c) => c[0] === Events.ChannelCreate)
      expect(call).toBeDefined()
      return { client, callback: call![1] as (channel: NonThreadGuildBasedChannel) => Promise<void> }
    }

    it('handleCommand は client に ChannelCreate リスナーを登録する', () => {
      // Arrange
      const on = jest.fn()
      const client = { on } as unknown as Client

      // Act
      controller.handleCommand(client)

      // Assert
      expect(on).toHaveBeenCalledWith(Events.ChannelCreate, expect.any(Function))
    })

    it('GuildText 以外のチャンネルでは orchestrator を呼ばない', async () => {
      // Arrange
      const { callback } = setupClientAndGetCallback()
      const nonTextChannel = {
        type: ChannelType.GuildVoice,
        id: 'ch-1',
        name: 'voice'
      } as unknown as NonThreadGuildBasedChannel

      // Act
      await callback(nonTextChannel)

      // Assert
      expect(channelCreateOrchestratorService.execute).not.toHaveBeenCalled()
    })

    it('GuildText チャンネルでは orchestrator.execute に委譲する', async () => {
      // Arrange
      const { callback } = setupClientAndGetCallback()
      const textChannel = {
        type: ChannelType.GuildText,
        id: 'ch-2',
        name: 'general'
      } as unknown as NonThreadGuildBasedChannel
      channelCreateOrchestratorService.execute.mockResolvedValue(undefined)

      // Act
      await callback(textChannel)

      // Assert
      expect(channelCreateOrchestratorService.execute).toHaveBeenCalledWith(textChannel as unknown as TextChannel)
    })

    it('orchestrator.execute が throw しても例外を握りつぶす', async () => {
      // Arrange
      const { callback } = setupClientAndGetCallback()
      const textChannel = {
        type: ChannelType.GuildText,
        id: 'ch-3',
        name: 'general'
      } as unknown as NonThreadGuildBasedChannel
      channelCreateOrchestratorService.execute.mockRejectedValue(new Error('orchestrator boom'))

      // Act & Assert: 例外が外に漏れないこと
      await expect(callback(textChannel)).resolves.toBeUndefined()
      expect(channelCreateOrchestratorService.execute).toHaveBeenCalledTimes(1)
    })
  })
})
