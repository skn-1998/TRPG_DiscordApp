import type { AutocompleteInteraction } from 'discord.js'
import { createBaseInteractionMock, type MockBaseInteraction } from './base.types'

/**
 * AutocompleteInteraction モックの設定オプション
 */
export interface AutocompleteInteractionOptions {
  commandName?: string
  focusedOption?: {
    name: string
    value: string
    type?: number
  }
  options?: Record<string, string | number | boolean | null>
  base?: Partial<MockBaseInteraction>
}

/**
 * AutocompleteInteraction のモックを生成するファクトリ関数
 *
 * @example
 * ```typescript
 * const interaction = createMockAutocompleteInteraction({
 *   commandName: 'dice',
 *   focusedOption: { name: 'game-system', value: 'coc' },
 * })
 *
 * await handler.handleAutocomplete(interaction)
 * expect(interaction.respond).toHaveBeenCalledWith(
 *   expect.arrayContaining([{ name: 'CoC7th', value: 'coc' }])
 * )
 * ```
 */
export function createMockAutocompleteInteraction(
  config: AutocompleteInteractionOptions = {}
): AutocompleteInteraction {
  const base = createBaseInteractionMock(config.base)
  const focused = config.focusedOption ?? { name: 'test-option', value: '', type: 3 }
  const optionValues = config.options ?? {}

  return {
    ...base,
    commandName: config.commandName ?? 'test-command',
    commandId: 'test-command-id',
    type: 4, // ApplicationCommandAutocomplete
    // オートコンプリート固有メソッド
    options: {
      getFocused: jest.fn().mockImplementation((full?: boolean) => {
        if (full) return focused
        return focused.value
      }),
      getString: jest.fn().mockImplementation((name: string) => (optionValues[name] as string) ?? null),
      getNumber: jest.fn().mockImplementation((name: string) => (optionValues[name] as number) ?? null),
      getInteger: jest.fn().mockImplementation((name: string) => (optionValues[name] as number) ?? null),
      getBoolean: jest.fn().mockImplementation((name: string) => (optionValues[name] as boolean) ?? null)
    },
    respond: jest.fn().mockResolvedValue(undefined),
    isAutocomplete: jest.fn().mockReturnValue(true),
    isCommand: jest.fn().mockReturnValue(false),
    isChatInputCommand: jest.fn().mockReturnValue(false),
    isButton: jest.fn().mockReturnValue(false),
    isSelectMenu: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    inGuild: jest.fn().mockReturnValue(true),
    inCachedGuild: jest.fn().mockReturnValue(true)
  } as unknown as AutocompleteInteraction
}
