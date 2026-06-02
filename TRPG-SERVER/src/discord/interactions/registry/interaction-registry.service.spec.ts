import { Test, TestingModule } from '@nestjs/testing'
import { ModuleRef } from '@nestjs/core'
import { InteractionRegistryService } from './interaction-registry.service'
import { PatternMatcherService } from './pattern-matcher.service'
import {
  InteractionHandler,
  ButtonInteractionHandler,
  SelectMenuInteractionHandler,
  ModalInteractionHandler
} from '../handlers/base/interaction-handler.base'
import { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js'

// テスト用のモックハンドラー
class MockButtonHandler extends ButtonInteractionHandler {
  executeCalled = false
  getCustomIdPattern(): string {
    return 'test-button'
  }
  async execute(): Promise<void> {
    this.executeCalled = true
  }
}

class MockSelectHandler extends SelectMenuInteractionHandler {
  executeCalled = false
  getCustomIdPattern(): string {
    return 'test-select'
  }
  async execute(): Promise<void> {
    this.executeCalled = true
  }
}

class MockModalHandler extends ModalInteractionHandler {
  executeCalled = false
  getCustomIdPattern(): string {
    return 'test-modal'
  }
  async execute(): Promise<void> {
    this.executeCalled = true
  }
}

// Discord.jsインタラクションのモック
const createMockButtonInteraction = (customId: string): ButtonInteraction => {
  return {
    isButton: () => true,
    isAnySelectMenu: () => false,
    isModalSubmit: () => false,
    customId,
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    user: { id: 'test-user-id' },
    channelId: 'test-channel-id'
  } as unknown as ButtonInteraction
}

const createMockSelectInteraction = (customId: string): StringSelectMenuInteraction => {
  return {
    isButton: () => false,
    isAnySelectMenu: () => true,
    isStringSelectMenu: () => true,
    isModalSubmit: () => false,
    customId,
    values: ['selected-value'],
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    user: { id: 'test-user-id' },
    channelId: 'test-channel-id'
  } as unknown as StringSelectMenuInteraction
}

const createMockModalInteraction = (customId: string): ModalSubmitInteraction => {
  return {
    isButton: () => false,
    isAnySelectMenu: () => false,
    isModalSubmit: () => true,
    customId,
    fields: {
      getTextInputValue: jest.fn().mockReturnValue('test-value')
    },
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    user: { id: 'test-user-id' },
    channelId: 'test-channel-id'
  } as unknown as ModalSubmitInteraction
}

describe('InteractionRegistryService', () => {
  let service: InteractionRegistryService
  let patternMatcher: PatternMatcherService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InteractionRegistryService,
        PatternMatcherService,
        {
          provide: ModuleRef,
          useValue: {
            get: jest.fn().mockReturnValue(undefined)
          }
        }
      ]
    }).compile()

    service = module.get<InteractionRegistryService>(InteractionRegistryService)
    patternMatcher = module.get<PatternMatcherService>(PatternMatcherService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('registerHandler', () => {
    it('ハンドラーを登録できる', () => {
      const handler = new MockButtonHandler()
      service.registerHandler(handler)

      const handlers = service.getAllHandlers()
      expect(handlers).toContain(handler)
    })

    it('複数のハンドラーを登録できる', () => {
      const buttonHandler = new MockButtonHandler()
      const selectHandler = new MockSelectHandler()
      const modalHandler = new MockModalHandler()

      service.registerHandler(buttonHandler)
      service.registerHandler(selectHandler)
      service.registerHandler(modalHandler)

      const handlers = service.getAllHandlers()
      expect(handlers).toHaveLength(3)
    })
  })

  describe('registerHandlers', () => {
    it('複数のハンドラーを一括登録できる', () => {
      const handlers = [new MockButtonHandler(), new MockSelectHandler(), new MockModalHandler()]

      service.registerHandlers(handlers)

      expect(service.getAllHandlers()).toHaveLength(3)
    })
  })

  describe('getHandlersByType', () => {
    beforeEach(() => {
      service.registerHandler(new MockButtonHandler())
      service.registerHandler(new MockSelectHandler())
      service.registerHandler(new MockModalHandler())
    })

    it('buttonタイプのハンドラーを取得できる', () => {
      const handlers = service.getHandlersByType('button')
      expect(handlers).toHaveLength(1)
      expect(handlers[0].getInteractionType()).toBe('button')
    })

    it('selectタイプのハンドラーを取得できる', () => {
      const handlers = service.getHandlersByType('select')
      expect(handlers).toHaveLength(1)
      expect(handlers[0].getInteractionType()).toBe('select')
    })

    it('modalタイプのハンドラーを取得できる', () => {
      const handlers = service.getHandlersByType('modal')
      expect(handlers).toHaveLength(1)
      expect(handlers[0].getInteractionType()).toBe('modal')
    })
  })

  describe('route', () => {
    let buttonHandler: MockButtonHandler
    let selectHandler: MockSelectHandler
    let modalHandler: MockModalHandler

    beforeEach(() => {
      buttonHandler = new MockButtonHandler()
      selectHandler = new MockSelectHandler()
      modalHandler = new MockModalHandler()

      service.registerHandler(buttonHandler)
      service.registerHandler(selectHandler)
      service.registerHandler(modalHandler)
    })

    it('ボタンインタラクションを正しくルーティングする', async () => {
      const interaction = createMockButtonInteraction('test-button')

      const handled = await service.route(interaction)

      expect(handled).toBe(true)
      expect(buttonHandler.executeCalled).toBe(true)
    })

    it('セレクトメニューインタラクションを正しくルーティングする', async () => {
      const interaction = createMockSelectInteraction('test-select')

      const handled = await service.route(interaction)

      expect(handled).toBe(true)
      expect(selectHandler.executeCalled).toBe(true)
    })

    it('モーダルインタラクションを正しくルーティングする', async () => {
      const interaction = createMockModalInteraction('test-modal')

      const handled = await service.route(interaction)

      expect(handled).toBe(true)
      expect(modalHandler.executeCalled).toBe(true)
    })

    it('未登録のcustomIdの場合、falseを返す', async () => {
      const interaction = createMockButtonInteraction('unknown-button')

      const handled = await service.route(interaction)

      expect(handled).toBe(false)
    })

    it('ハンドラー実行エラーの場合、例外をスローする', async () => {
      // 新しいRegistryServiceを使用（既存のハンドラーがない状態）
      const freshModule = await Test.createTestingModule({
        providers: [
          InteractionRegistryService,
          PatternMatcherService,
          {
            provide: ModuleRef,
            useValue: { get: jest.fn().mockReturnValue(undefined) }
          }
        ]
      }).compile()

      const freshService = freshModule.get<InteractionRegistryService>(InteractionRegistryService)
      const errorHandler = new MockButtonHandler()
      errorHandler.execute = jest.fn().mockRejectedValue(new Error('Test error'))
      freshService.registerHandler(errorHandler)

      const interaction = createMockButtonInteraction('test-button')

      await expect(freshService.route(interaction)).rejects.toThrow('Test error')
    })
  })

  describe('hasHandler', () => {
    beforeEach(() => {
      service.registerHandler(new MockButtonHandler())
    })

    it('登録済みのハンドラーが存在する場合、trueを返す', () => {
      expect(service.hasHandler('test-button', 'button')).toBe(true)
    })

    it('未登録のハンドラーの場合、falseを返す', () => {
      expect(service.hasHandler('unknown', 'button')).toBe(false)
    })

    it('タイプが異なる場合、falseを返す', () => {
      expect(service.hasHandler('test-button', 'select')).toBe(false)
    })
  })

  describe('getStatistics', () => {
    beforeEach(() => {
      service.registerHandler(new MockButtonHandler())
      service.registerHandler(new MockSelectHandler())
      service.registerHandler(new MockModalHandler())
    })

    it('統計情報を取得できる', () => {
      const stats = service.getStatistics()

      expect(stats.totalHandlers).toBe(3)
      expect(stats.buttonHandlers).toBe(1)
      expect(stats.selectHandlers).toBe(1)
      expect(stats.modalHandlers).toBe(1)
    })

    it('実行回数が記録される', async () => {
      const interaction = createMockButtonInteraction('test-button')
      await service.route(interaction)

      const stats = service.getStatistics()
      expect(stats.executionCounts.get('MockButtonHandler')).toBe(1)
    })
  })

  describe('resetStatistics', () => {
    it('統計情報をリセットできる', async () => {
      service.registerHandler(new MockButtonHandler())
      const interaction = createMockButtonInteraction('test-button')
      await service.route(interaction)

      service.resetStatistics()

      const stats = service.getStatistics()
      expect(stats.executionCounts.size).toBe(0)
    })
  })
})
