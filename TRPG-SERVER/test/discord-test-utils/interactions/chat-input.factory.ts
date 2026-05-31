import type { ChatInputCommandInteraction } from 'discord.js'
import { createBaseInteractionMock, type MockBaseInteraction } from './base.types'

/**
 * ChatInputCommandInteraction (スラッシュコマンド) のオプションモック
 */
export interface MockCommandOptions {
  getString?: jest.Mock
  getNumber?: jest.Mock
  getInteger?: jest.Mock
  getBoolean?: jest.Mock
  getUser?: jest.Mock
  getChannel?: jest.Mock
  getRole?: jest.Mock
  getMentionable?: jest.Mock
  getAttachment?: jest.Mock
  getSubcommand?: jest.Mock
  getSubcommandGroup?: jest.Mock
  data?: Record<string, unknown>
}

/**
 * ChatInputCommandInteraction モックの設定オプション
 */
export interface ChatInputInteractionOptions {
  commandName?: string
  options?: Partial<MockCommandOptions>
  base?: Partial<MockBaseInteraction>
}

/**
 * ChatInputCommandInteraction のモックを生成するファクトリ関数
 *
 * @example
 * ```typescript
 * const interaction = createMockChatInputInteraction({
 *   commandName: 'dice',
 *   options: {
 *     getString: jest.fn().mockReturnValue('1d100'),
 *   }
 * })
 * ```
 */
export function createMockChatInputInteraction(config: ChatInputInteractionOptions = {}): ChatInputCommandInteraction {
  const base = createBaseInteractionMock(config.base)

  const defaultOptions: MockCommandOptions = {
    getString: jest.fn().mockReturnValue(null),
    getNumber: jest.fn().mockReturnValue(null),
    getInteger: jest.fn().mockReturnValue(null),
    getBoolean: jest.fn().mockReturnValue(null),
    getUser: jest.fn().mockReturnValue(null),
    getChannel: jest.fn().mockReturnValue(null),
    getRole: jest.fn().mockReturnValue(null),
    getMentionable: jest.fn().mockReturnValue(null),
    getAttachment: jest.fn().mockReturnValue(null),
    getSubcommand: jest.fn().mockReturnValue(null),
    getSubcommandGroup: jest.fn().mockReturnValue(null)
  }

  const mergedOptions = {
    ...defaultOptions,
    ...config.options
  }

  return {
    ...base,
    commandName: config.commandName ?? 'test-command',
    commandId: 'test-command-id',
    commandGuildId: base.guildId,
    commandType: 1,
    type: 2, // ApplicationCommand
    options: mergedOptions,
    // スラッシュコマンド固有メソッド
    isCommand: jest.fn().mockReturnValue(true),
    isChatInputCommand: jest.fn().mockReturnValue(true),
    isContextMenuCommand: jest.fn().mockReturnValue(false),
    isButton: jest.fn().mockReturnValue(false),
    isSelectMenu: jest.fn().mockReturnValue(false),
    isModalSubmit: jest.fn().mockReturnValue(false),
    isAutocomplete: jest.fn().mockReturnValue(false),
    inGuild: jest.fn().mockReturnValue(true),
    inCachedGuild: jest.fn().mockReturnValue(true)
  } as unknown as ChatInputCommandInteraction
}
