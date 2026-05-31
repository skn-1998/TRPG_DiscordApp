import type { ModalSubmitInteraction } from 'discord.js'
import { createBaseInteractionMock, type MockBaseInteraction } from './base.types'

/**
 * モーダルフィールド値のマップ型
 */
export type MockModalFields = Record<string, string>

/**
 * ModalSubmitInteraction モックの設定オプション
 */
export interface ModalInteractionOptions {
  customId?: string
  fields?: MockModalFields
  message?: Record<string, unknown> | null
  base?: Partial<MockBaseInteraction>
}

/**
 * ModalSubmitInteraction のモックを生成するファクトリ関数
 *
 * @example
 * ```typescript
 * const interaction = createMockModalInteraction({
 *   customId: 'custom-dice-modal',
 *   fields: {
 *     'dice-input': '2d6+3',
 *     'notation': 'カスタムダイス',
 *   }
 * })
 *
 * await handler.execute(interaction)
 * const diceValue = interaction.fields.getTextInputValue('dice-input') // '2d6+3'
 * ```
 */
export function createMockModalInteraction(config: ModalInteractionOptions = {}): ModalSubmitInteraction {
  const base = createBaseInteractionMock(config.base)
  const fieldValues = config.fields ?? {}

  const mockFields = {
    getTextInputValue: jest.fn().mockImplementation((customId: string) => {
      return fieldValues[customId] ?? ''
    }),
    getField: jest.fn().mockImplementation((customId: string) => {
      return fieldValues[customId] != null ? { value: fieldValues[customId], customId } : null
    }),
    fields: Object.entries(fieldValues).map(([customId, value]) => ({
      customId,
      value,
      type: 4
    }))
  }

  return {
    ...base,
    customId: config.customId ?? 'test-modal',
    type: 5, // ModalSubmit
    fields: mockFields,
    // モーダル固有メソッド
    isModalSubmit: jest.fn().mockReturnValue(true),
    isButton: jest.fn().mockReturnValue(false),
    isSelectMenu: jest.fn().mockReturnValue(false),
    isChatInputCommand: jest.fn().mockReturnValue(false),
    isAutocomplete: jest.fn().mockReturnValue(false),
    isMessageComponent: jest.fn().mockReturnValue(false),
    inGuild: jest.fn().mockReturnValue(true),
    inCachedGuild: jest.fn().mockReturnValue(true)
  } as unknown as ModalSubmitInteraction
}
