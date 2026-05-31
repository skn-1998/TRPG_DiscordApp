import type { ButtonInteraction } from 'discord.js'
import { createBaseInteractionMock, type MockBaseInteraction } from './base.types'

/**
 * ButtonInteraction モックの設定オプション
 */
export interface ButtonInteractionOptions {
  customId?: string
  message?: Record<string, unknown>
  base?: Partial<MockBaseInteraction>
}

/**
 * ButtonInteraction のモックを生成するファクトリ関数
 *
 * @example
 * ```typescript
 * const interaction = createMockButtonInteraction({
 *   customId: 'dice-page-next',
 * })
 *
 * // ページネーションハンドラのテスト
 * await handler.execute(interaction)
 * expect(interaction.deferUpdate).toHaveBeenCalled()
 * ```
 */
export function createMockButtonInteraction(config: ButtonInteractionOptions = {}): ButtonInteraction {
  const base = createBaseInteractionMock(config.base)

  const mockMessage = config.message ?? {
    id: 'test-message-id',
    content: '',
    embeds: [],
    components: [],
    edit: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined)
  }

  return {
    ...base,
    customId: config.customId ?? 'test-button',
    componentType: 2, // Button
    type: 3, // MessageComponent
    message: mockMessage,
    // ボタン固有メソッド
    update: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    isButton: jest.fn().mockReturnValue(true),
    isSelectMenu: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    isChatInputCommand: jest.fn().mockReturnValue(false),
    isAutocomplete: jest.fn().mockReturnValue(false),
    isMessageComponent: jest.fn().mockReturnValue(true),
    inGuild: jest.fn().mockReturnValue(true),
    inCachedGuild: jest.fn().mockReturnValue(true)
  } as unknown as ButtonInteraction
}
