import type { StringSelectMenuInteraction } from 'discord.js'
import { createBaseInteractionMock, type MockBaseInteraction } from './base.types'

/**
 * StringSelectMenuInteraction モックの設定オプション
 */
export interface SelectMenuInteractionOptions {
  customId?: string
  values?: string[]
  message?: Record<string, unknown>
  base?: Partial<MockBaseInteraction>
}

/**
 * StringSelectMenuInteraction のモックを生成するファクトリ関数
 *
 * @example
 * ```typescript
 * const interaction = createMockSelectMenuInteraction({
 *   customId: 'character-thread-create-select',
 *   values: ['char-id-123'],
 * })
 *
 * await handler.execute(interaction)
 * expect(interaction.deferUpdate).toHaveBeenCalled()
 * ```
 */
export function createMockSelectMenuInteraction(
  config: SelectMenuInteractionOptions = {}
): StringSelectMenuInteraction {
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
    customId: config.customId ?? 'test-select-menu',
    values: config.values ?? [],
    componentType: 3, // StringSelect
    type: 3, // MessageComponent
    message: mockMessage,
    // セレクトメニュー固有メソッド
    update: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    isStringSelectMenu: jest.fn().mockReturnValue(true),
    isSelectMenu: jest.fn().mockReturnValue(true),
    isButton: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    isChatInputCommand: jest.fn().mockReturnValue(false),
    isAutocomplete: jest.fn().mockReturnValue(false),
    isMessageComponent: jest.fn().mockReturnValue(true),
    inGuild: jest.fn().mockReturnValue(true),
    inCachedGuild: jest.fn().mockReturnValue(true)
  } as unknown as StringSelectMenuInteraction
}
