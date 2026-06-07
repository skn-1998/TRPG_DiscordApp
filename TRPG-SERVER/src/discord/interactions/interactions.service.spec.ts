// InteractionsService は Discord.js インタラクション処理を registry に委譲する仲介役。
// 副作用境界は EventEmitter2(emit)・InteractionRegistryService。
// （ChannelCreate リスナーは characterEdit feature の
//   CharacterEditChannelCreateListenerService へ移管済み・§8）

import { Test } from '@nestjs/testing'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  ButtonInteraction,
  AnySelectMenuInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction
} from 'discord.js'
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
    ...overrides
  }
}

describe('InteractionsService', () => {
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>
  let registry: jest.Mocked<Pick<InteractionRegistryService, 'route'>>

  async function createService(): Promise<InteractionsService> {
    const m = await Test.createTestingModule({
      providers: [
        InteractionsService,
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: InteractionRegistryService, useValue: registry }
      ]
    }).compile()

    return m.get(InteractionsService)
  }

  beforeEach(() => {
    eventEmitter = { emit: jest.fn().mockReturnValue(true) }
    registry = { route: jest.fn().mockResolvedValue(true) }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('handleInteraction', () => {
    it('開始メトリクス discord.interaction.start を必ず emit する', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({ id: 'i-99', guildId: 'g-99', user: { id: 'u-99' } })

      // Act
      await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith('discord.interaction.start', {
        eventType: 'button-interaction',
        interactionId: 'i-99',
        userId: 'u-99',
        guildId: 'g-99'
      })
    })

    it('応答済み(replied)なら委譲せず already-replied で processed を emit し true を返す', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({ replied: true })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(registry.route).not.toHaveBeenCalled()
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.processed',
        expect.objectContaining({ success: true, reason: 'already-replied' })
      )
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

    it('registry に委譲し success の processed を emit して true を返す', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({ id: 'i-1' })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(registry.route).toHaveBeenCalledWith(interaction)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.processed',
        expect.objectContaining({ success: true, interactionId: 'i-1' })
      )
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
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }))
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.processed',
        expect.objectContaining({ success: true })
      )
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
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }))
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.processed',
        expect.objectContaining({ success: true })
      )
    })

    it('select メニューのときは eventType を select-interaction とする', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({
        isButton: jest.fn().mockReturnValue(false),
        isAnySelectMenu: jest.fn().mockReturnValue(true)
      })

      // Act
      await service.handleInteraction(interaction as unknown as AnySelectMenuInteraction)

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.start',
        expect.objectContaining({ eventType: 'select-interaction' })
      )
    })

    it('button でも select でもないときは eventType を modal-interaction とする', async () => {
      // Arrange
      const service = await createService()
      const interaction = createInteractionStub({
        isButton: jest.fn().mockReturnValue(false),
        isAnySelectMenu: jest.fn().mockReturnValue(false)
      })

      // Act
      await service.handleInteraction(interaction as unknown as ModalSubmitInteraction)

      // Assert
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.start',
        expect.objectContaining({ eventType: 'modal-interaction' })
      )
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
