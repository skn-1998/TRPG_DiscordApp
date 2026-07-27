// InteractionsController は Discord.js インタラクションの薄いルーティング層。
// 検証対象は「委譲経路」と「分岐・異常系のハンドリング」のみ（ビジネスロジックは持たない）。
//   - handleInteraction: replied/deferred 早期 return / route 委譲 / 未登録応答 / 例外応答
// ※ ChannelCreate リスナー（旧 handleCommand/handleChannelCreate）は characterEdit feature の
//   CharacterEditChannelCreateListenerService へ移管済み（§8）。controller からは撤去された。

import { Test } from '@nestjs/testing'
import type { ButtonInteraction } from 'discord.js'
import { MessageFlags } from 'discord.js'
import { InteractionsController } from './interactions.controller'
import { InteractionRegistryService } from './registry/interaction-registry.service'

/** 最小のインタラクションスタブを生成する */
function createInteractionStub(
  overrides: Partial<{
    replied: boolean
    deferred: boolean
    reply: jest.Mock
    editReply: jest.Mock
    followUp: jest.Mock
  }> = {}
): ButtonInteraction {
  return {
    id: 'interaction-id',
    type: 3,
    customId: 'test-custom-id',
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    ...overrides
  } as unknown as ButtonInteraction
}

describe('InteractionsController', () => {
  let controller: InteractionsController
  let interactionRegistry: jest.Mocked<Pick<InteractionRegistryService, 'route'>>

  beforeEach(async () => {
    interactionRegistry = { route: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      controllers: [InteractionsController],
      providers: [{ provide: InteractionRegistryService, useValue: interactionRegistry }]
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
        flags: MessageFlags.Ephemeral
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
        flags: MessageFlags.Ephemeral
      })
    })

    it('route が defer 後に throw した場合、ephemeral followUp を送り editReply しない', async () => {
      // Arrange
      const interaction = createInteractionStub()
      interactionRegistry.route.mockImplementation(async () => {
        ;(interaction as unknown as { deferred: boolean }).deferred = true
        throw new Error('boom after defer')
      })

      // Act
      await controller.handleInteraction(interaction)

      // Assert
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: '❌ 処理中にエラーが発生しました。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
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
})
