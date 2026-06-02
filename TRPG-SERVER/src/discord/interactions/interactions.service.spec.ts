// InteractionsService は Discord.js インタラクション処理を InteractionsController に委譲する仲介役。
// 副作用境界は EventEmitter2(emit)・InteractionsController・CharacterSectionEditorService・ModuleRef。
// constructor に mock controller を渡すと this.interactionsController がセットされるため、
// onModuleInit/ModuleRef を介さずに「controller あり」状態を作れる（手本の Service パターン）。

import { Test } from '@nestjs/testing'
import { ModuleRef } from '@nestjs/core'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  Client,
  ButtonInteraction,
  AnySelectMenuInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction
} from 'discord.js'
import { InteractionsService } from './interactions.service'
import { InteractionsController } from './interactions.controller'
import { CharacterUIService } from '../features/characterEdit/services/character-ui.service'
import { CharacterSectionEditorService } from '../features/characterEdit/services/character-section-editor.service'

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
  let moduleRef: jest.Mocked<Pick<ModuleRef, 'get'>>
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>
  let controller: jest.Mocked<Pick<InteractionsController, 'handleCommand' | 'handleInteraction'>>
  let sectionEditor: jest.Mocked<Pick<CharacterSectionEditorService, 'execute'>>

  /**
   * controller を constructor 注入するか否かを切り替えて service を生成するヘルパー。
   * withController=false の場合は injectedInteractionsController を渡さない（onModuleInit 経路のテスト用）。
   */
  async function createService(withController: boolean): Promise<InteractionsService> {
    const m = await Test.createTestingModule({
      providers: [
        InteractionsService,
        { provide: ModuleRef, useValue: moduleRef },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: CharacterUIService, useValue: {} },
        { provide: CharacterSectionEditorService, useValue: sectionEditor },
        { provide: InteractionsController, useValue: withController ? controller : undefined }
      ]
    }).compile()

    return m.get(InteractionsService)
  }

  beforeEach(() => {
    moduleRef = { get: jest.fn() }
    eventEmitter = { emit: jest.fn().mockReturnValue(true) }
    controller = {
      handleCommand: jest.fn(),
      handleInteraction: jest.fn().mockResolvedValue(undefined)
    }
    sectionEditor = { execute: jest.fn().mockResolvedValue(undefined) }
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('injectedInteractionsController を渡すと controller 経由で動作する', async () => {
      // Arrange & Act
      const service = await createService(true)
      const interaction = createInteractionStub()

      // Assert: controller がセットされていれば委譲され、true が返る
      await expect(service.handleInteraction(interaction as unknown as ButtonInteraction)).resolves.toBe(true)
      expect(controller.handleInteraction).toHaveBeenCalledWith(interaction)
    })
  })

  describe('onModuleInit', () => {
    it('既に controller が注入済みなら ModuleRef.get を呼ばない', async () => {
      // Arrange
      const service = await createService(true)

      // Act
      await service.onModuleInit()

      // Assert
      expect(moduleRef.get).not.toHaveBeenCalled()
    })

    it('controller 未注入なら ModuleRef.get で strict:false 取得する', async () => {
      // Arrange
      const service = await createService(false)
      moduleRef.get.mockReturnValue(controller)

      // Act
      await service.onModuleInit()

      // Assert
      expect(moduleRef.get).toHaveBeenCalledWith(InteractionsController, { strict: false })
    })

    it('ModuleRef.get で取得できれば controller として利用される', async () => {
      // Arrange
      const service = await createService(false)
      moduleRef.get.mockReturnValue(controller)
      await service.onModuleInit()

      // Act: 取得した controller に委譲されることで間接的に確認（loadClient は同期）
      service.loadClient({} as Client)

      // Assert
      expect(controller.handleCommand).toHaveBeenCalled()
    })

    it('ModuleRef.get が null を返しても例外を投げない', async () => {
      // Arrange
      const service = await createService(false)
      moduleRef.get.mockReturnValue(null)

      // Act & Assert
      await expect(service.onModuleInit()).resolves.toBeUndefined()
    })

    it('ModuleRef.get が throw しても握りつぶして完了する', async () => {
      // Arrange
      const service = await createService(false)
      moduleRef.get.mockImplementation(() => {
        throw new Error('get failed')
      })

      // Act & Assert
      await expect(service.onModuleInit()).resolves.toBeUndefined()
    })
  })

  describe('loadClient', () => {
    it('controller があれば handleCommand に client を渡す', async () => {
      // Arrange
      const service = await createService(true)
      const client = {} as Client

      // Act
      service.loadClient(client)

      // Assert
      expect(controller.handleCommand).toHaveBeenCalledWith(client)
    })

    it('handleCommand が throw しても例外を外へ伝播しない', async () => {
      // Arrange
      const service = await createService(true)
      controller.handleCommand.mockImplementation(() => {
        throw new Error('command failed')
      })

      // Act & Assert
      expect(() => service.loadClient({} as Client)).not.toThrow()
    })

    it('controller が無ければ handleCommand を呼ばない', async () => {
      // Arrange
      const service = await createService(false)

      // Act
      service.loadClient({} as Client)

      // Assert
      expect(controller.handleCommand).not.toHaveBeenCalled()
    })
  })

  describe('handleInteraction', () => {
    it('開始メトリクス discord.interaction.start を必ず emit する', async () => {
      // Arrange
      const service = await createService(true)
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
      const service = await createService(true)
      const interaction = createInteractionStub({ replied: true })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(controller.handleInteraction).not.toHaveBeenCalled()
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.processed',
        expect.objectContaining({ success: true, reason: 'already-replied' })
      )
    })

    it('deferred でも already-replied 扱いで true を返す', async () => {
      // Arrange
      const service = await createService(true)
      const interaction = createInteractionStub({ deferred: true })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(controller.handleInteraction).not.toHaveBeenCalled()
    })

    it('controller があれば委譲し success の processed を emit して true を返す', async () => {
      // Arrange
      const service = await createService(true)
      const interaction = createInteractionStub({ id: 'i-1' })

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(true)
      expect(controller.handleInteraction).toHaveBeenCalledWith(interaction)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.processed',
        expect.objectContaining({ success: true, interactionId: 'i-1' })
      )
    })

    it('controller が無ければ controller-unavailable で processed を emit し false を返す', async () => {
      // Arrange
      const service = await createService(false)
      const interaction = createInteractionStub()

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(false)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.processed',
        expect.objectContaining({ success: false, error: 'controller-unavailable' })
      )
    })

    it('委譲中に例外が起きたら error メッセージ付きで processed を emit し false を返す', async () => {
      // Arrange
      const service = await createService(true)
      controller.handleInteraction.mockRejectedValue(new Error('boom'))
      const interaction = createInteractionStub()

      // Act
      const result = await service.handleInteraction(interaction as unknown as ButtonInteraction)

      // Assert
      expect(result).toBe(false)
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'discord.interaction.processed',
        expect.objectContaining({ success: false, error: 'boom' })
      )
    })

    it('select メニューのときは eventType を select-interaction とする', async () => {
      // Arrange
      const service = await createService(true)
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
      const service = await createService(true)
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
      const service = await createService(true)
      const interaction = createInteractionStub({ replied: true })

      // Act
      await service.execute(interaction as unknown as ButtonInteraction)

      // Assert
      expect(sectionEditor.execute).not.toHaveBeenCalled()
      expect(controller.handleInteraction).not.toHaveBeenCalled()
    })

    it('character-section-select- で始まる StringSelect は sectionEditor に委譲する', async () => {
      // Arrange
      const service = await createService(true)
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        customId: 'character-section-select-abilities'
      })

      // Act
      await service.execute(interaction as unknown as StringSelectMenuInteraction)

      // Assert
      expect(sectionEditor.execute).toHaveBeenCalledWith(interaction)
      expect(controller.handleInteraction).not.toHaveBeenCalled()
    })

    it('character-edit- を含む StringSelect も sectionEditor に委譲する', async () => {
      // Arrange
      const service = await createService(true)
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        customId: 'foo-character-edit-bar'
      })

      // Act
      await service.execute(interaction as unknown as StringSelectMenuInteraction)

      // Assert
      expect(sectionEditor.execute).toHaveBeenCalledWith(interaction)
    })

    it('character-field- を含む StringSelect も sectionEditor に委譲する', async () => {
      // Arrange
      const service = await createService(true)
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        customId: 'foo-character-field-hp'
      })

      // Act
      await service.execute(interaction as unknown as StringSelectMenuInteraction)

      // Assert
      expect(sectionEditor.execute).toHaveBeenCalledWith(interaction)
    })

    it('sectionEditor が throw し未応答なら ephemeral reply して rethrow する', async () => {
      // Arrange
      const service = await createService(true)
      const error = new Error('editor failed')
      sectionEditor.execute.mockRejectedValue(error)
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        customId: 'character-section-select-abilities'
      })

      // Act & Assert
      await expect(service.execute(interaction as unknown as StringSelectMenuInteraction)).rejects.toBe(error)
      expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }))
    })

    it('sectionEditor が throw し既に応答済みなら reply せず rethrow する', async () => {
      // Arrange
      const service = await createService(true)
      const error = new Error('editor failed')
      sectionEditor.execute.mockRejectedValue(error)
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        customId: 'character-section-select-abilities'
      })
      // execute 冒頭ガードは未応答で通過し、editor 実行中に応答済みになるケースを再現する
      sectionEditor.execute.mockImplementation(async () => {
        interaction.replied = true
        throw error
      })

      // Act & Assert
      await expect(service.execute(interaction as unknown as StringSelectMenuInteraction)).rejects.toBe(error)
      expect(interaction.reply).not.toHaveBeenCalled()
    })

    it('対象外の customId をもつ StringSelect は handleInteraction に委譲する', async () => {
      // Arrange
      const service = await createService(true)
      const interaction = createInteractionStub({
        isStringSelectMenu: jest.fn().mockReturnValue(true),
        isAnySelectMenu: jest.fn().mockReturnValue(true),
        isButton: jest.fn().mockReturnValue(false),
        customId: 'unrelated-select'
      })

      // Act
      await service.execute(interaction as unknown as StringSelectMenuInteraction)

      // Assert
      expect(sectionEditor.execute).not.toHaveBeenCalled()
      expect(controller.handleInteraction).toHaveBeenCalledWith(interaction)
    })

    it('StringSelect でない通常インタラクションは handleInteraction に委譲する', async () => {
      // Arrange
      const service = await createService(true)
      const interaction = createInteractionStub()

      // Act
      await service.execute(interaction as unknown as ButtonInteraction)

      // Assert
      expect(sectionEditor.execute).not.toHaveBeenCalled()
      expect(controller.handleInteraction).toHaveBeenCalledWith(interaction)
    })
  })
})
