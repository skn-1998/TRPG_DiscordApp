/**
 * Discord Test Utils
 *
 * @shoginn/discordjs-mock を拡張した、プロジェクト独自のDiscordモックライブラリ。
 *
 * ## 提供するモック
 *
 * ### インタラクション系（最重要）
 * `@shoginn/discordjs-mock` が提供していない Interaction 系モックを完全実装。
 *
 * - `createMockChatInputInteraction` - スラッシュコマンド
 * - `createMockButtonInteraction`    - ボタン
 * - `createMockSelectMenuInteraction`- セレクトメニュー
 * - `createMockModalInteraction`     - モーダル送信
 * - `createMockAutocompleteInteraction` - オートコンプリート
 *
 * ### クライアント系
 * `@shoginn/discordjs-mock` ラッパー + フォールバック実装。
 *
 * - `createMockDiscordClient` - Discord Client
 * - `createMockTextChannel`   - テキストチャンネル
 * - `createMockThread`        - スレッド
 * - `createMockGuild`         - ギルド
 * - `createMockUser`          - ユーザー
 * - `createMockMember`        - ギルドメンバー
 *
 * ### jest.mock() ヘルパー
 * discord.js モジュール全体を一括モックする設定。
 *
 * - `discordModuleMockFactory` - jest.mock('discord.js', ...) 用ファクトリ
 * - `setupDiscordModuleMock`   - spec.ts での discord.js モック設定
 *
 * ## 使い方
 *
 * ```typescript
 * // 1. スラッシュコマンドのテスト
 * import { createMockChatInputInteraction } from '@discord-test-utils'
 *
 * const interaction = createMockChatInputInteraction({
 *   commandName: 'dice',
 *   options: {
 *     getString: jest.fn().mockReturnValue('1d100'),
 *   }
 * })
 * await service.execute(interaction)
 *
 * // 2. ボタンのテスト
 * import { createMockButtonInteraction } from '@discord-test-utils'
 *
 * const interaction = createMockButtonInteraction({ customId: 'dice-page-next' })
 * await handler.execute(interaction)
 * expect(interaction.deferUpdate).toHaveBeenCalled()
 *
 * // 3. モーダルのテスト
 * import { createMockModalInteraction } from '@discord-test-utils'
 *
 * const interaction = createMockModalInteraction({
 *   customId: 'custom-dice-modal',
 *   fields: { 'dice-input': '2d6+3' },
 * })
 * await handler.execute(interaction)
 * ```
 */

// ━━━ インタラクション系 ━━━
export { createMockChatInputInteraction } from './interactions/chat-input.factory'
export type { ChatInputInteractionOptions, MockCommandOptions } from './interactions/chat-input.factory'

export { createMockButtonInteraction } from './interactions/button.factory'
export type { ButtonInteractionOptions } from './interactions/button.factory'

export { createMockSelectMenuInteraction } from './interactions/select-menu.factory'
export type { SelectMenuInteractionOptions } from './interactions/select-menu.factory'

export { createMockModalInteraction } from './interactions/modal.factory'
export type { ModalInteractionOptions, MockModalFields } from './interactions/modal.factory'

export { createMockAutocompleteInteraction } from './interactions/autocomplete.factory'
export type { AutocompleteInteractionOptions } from './interactions/autocomplete.factory'

// ━━━ ベース型・定数 ━━━
export {
  createBaseInteractionMock,
  DEFAULT_MOCK_USER,
  DEFAULT_MOCK_GUILD,
  DEFAULT_MOCK_CHANNEL,
  DEFAULT_MOCK_MEMBER
} from './interactions/base.types'
export type {
  MockBaseInteraction,
  MockDiscordUser,
  MockDiscordGuild,
  MockDiscordChannel,
  MockDiscordMember
} from './interactions/base.types'

// ━━━ クライアント系 ━━━
export {
  createMockDiscordClient,
  createMockTextChannel,
  createMockThread,
  createMockGuild,
  createMockUser,
  createMockMember
} from './client/discord-client.factory'

// ━━━ jest.mock() ヘルパー ━━━
export { discordModuleMockFactory, setupDiscordModuleMock } from './jest/discord-module.mock'
