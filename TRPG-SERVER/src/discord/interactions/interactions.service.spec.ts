// InteractionsService は Discord.js インタラクション処理を registry に委譲する仲介役。
// 副作用境界は InteractionRegistryService のみ。
// （素の EventEmitter2 注入と interaction 開始/処理済みメトリクスの emit は
//   購読者ゼロの dead メトリクスだったため E-3e で撤去済み）
// （ChannelCreate リスナーは characterEdit feature の
//   CharacterEditChannelCreateListenerService へ移管済み・§8）

import { Test } from '@nestjs/testing'
import { ButtonInteraction, StringSelectMenuInteraction, MessageFlags } from 'discord.js'
import { InteractionsService } from './interactions.service'
import { InteractionRegistryService } from './registry/interaction-registry.service'

type InteractionStub = {
  isButton: jest.Mock
  isAnySelectMenu: jest.Mock
  isStringSelectMenu: jest.Mock
  replied: boolean
  deferred: boolean
  id: string
  user: { id: string }
  guildId: string | null
  customId: string
  reply: jest.Mock
  editReply: jest.Mock
  followUp: jest.Mock
}

/**
 * Discord インタラクションのスタブを生成する。
 * デフォルトは button・未応答。必要な分岐に応じて上書きする。
 */
function createInteractionStub(overrides: Partial<InteractionStub> = {}): InteractionStub {
  return {
    isButton: jest.fn().mockReturnValue(true),
    isAnySelectMenu: jest.fn().mockReturnValue(false),
    isStringSelectMenu: jest.fn().mockReturnValue(false),
    replied: false,
    deferred: false,
    id: 'interaction-1',
    user: { id: 'user-1' },
    guildId: 'guild-1',
    customId: 'some-custom-id',
    reply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    followUp: jest.fn().mockResolvedValue(undefined),
    ...overrides
  }
}

describe('InteractionsService', () => {
  let registry: jest.Mocked<Pick<InteractionRegistryService, 'route'>>

  async function createService(): Promise<InteractionsService> {
    const m = await Test.createTestingModule({
      providers: [InteractionsService, { provide: InteractionRegistryService, useValue: registry }]
    }).compile()

    return m.get(InteractionsService)
  }

  beforeEach(() => {
    registry = { route: jest.fn().mockResolvedValue(true) }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handleInteraction', () => {
    it('応答済み(replied)なら委譲せず true を返す', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({ replied: true })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(registry.route).not.toHaveBeenCalled()
    })

    it('deferred でも already-replied 扱いで true を返す', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({ deferred: true })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(registry.route).not.toHaveBeenCalled()
    })

    it('registry に委譲し true を返す', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({ id: 'i-1' })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(registry.route).toHaveBeenCalledWith(interaction)
    })

    it('registry が false を返したら ephemeral fallback を返し true を返す', async () => {
      // Arrange
      const service = await createService()
      registry.route.mockResolvedValue(false)
      const interaction = createInteractionStub()

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }))
    })

    it('registry が throw したら ephemeral error を返し true を返す', async () => {
      // Arrange
      const service = await createService()
      registry.route.mockRejectedValue(new Error('boom'))
      const interaction = createInteractionStub()

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ flags: MessageFlags.Ephemeral }))
    })

    it('registry が defer 後に throw したら ephemeral followUp を送り editReply しない', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub()
      registry.route.mockImplementation(async () => {
        interaction.deferred = true
        throw new Error('boom after defer')
      })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: '❌ 処理中にエラーが発生しました。',
        flags: MessageFlags.Ephemeral
      })
      expect(interaction.editReply).not.toHaveBeenCalled()
      expect(interaction.reply).not.toHaveBeenCalled()
    })
  })

  describe('execute', () => {
    it('応答済み(replied)なら何も委譲せず return する', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({ replied: true })

      // Act
      await service.execute(interaction as unknown as ButtonInteraction)

      // Assert
      expect(registry.route).not.toHaveBeenCalled()
    })

    // 旧 characterEdit 特例分岐は撤去済み。これらの customId は handleInteraction 経由で Registry
    // （CharacterEditSection/FieldHandler）へ委譲される（registry 登録は handlers.integration.spec で担保）。
    it('character-section-select- の StringSelect は Registry へ委譲する', async () => {
      const service = await createService()
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        isAnySelectMenu: jest.fn().mockReturnValue(true),
        isButton: jest.fn().mockReturnValue(false),
        customId: 'character-section-select-abilities'
      })

      await service.execute(interaction as unknown as StringSelectMenuInteraction)

      expect(registry.route).toHaveBeenCalledWith(interaction)
    })

    it('character-edit- を含む StringSelect は Registry へ委譲する', async () => {
      const service = await createService()
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        isAnySelectMenu: jest.fn().mockReturnValue(true),
        isButton: jest.fn().mockReturnValue(false),
        customId: 'foo-character-edit-bar'
      })

      await service.execute(interaction as unknown as StringSelectMenuInteraction)

      expect(registry.route).toHaveBeenCalledWith(interaction)
    })

    it('character-field- を含む StringSelect は Registry へ委譲する', async () => {
      const service = await createService()
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        isAnySelectMenu: jest.fn().mockReturnValue(true),
        isButton: jest.fn().mockReturnValue(false),
        customId: 'foo-character-field-hp'
      })

      await service.execute(interaction as unknown as StringSelectMenuInteraction)

      expect(registry.route).toHaveBeenCalledWith(interaction)
    })

    it('対象外の customId をもつ StringSelect は handleInteraction に委譲する', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        isAnySelectMenu: jest.fn().mockReturnValue(true),
        isButton: jest.fn().mockReturnValue(false),
        customId: 'unrelated-select'
      })

      // Act
      await service.execute(interaction as unknown as StringSelectMenuInteraction)

      // Assert
      expect(registry.route).toHaveBeenCalledWith(interaction)
    })

    it('StringSelect でない通常インタラクションは handleInteraction に委譲する', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub()

      // Act
      await service.execute(interaction as unknown as ButtonInteraction)

      // Assert
      expect(registry.route).toHaveBeenCalledWith(interaction)
    })
  })
})
