/**
 * characterThread タブボタン customId 契約（純粋モジュール）
 *
 * - handler 照合 pattern（文字列・前方一致）: `character-tab*`
 *   生成 customId は `character-tab*{channelId}*{tab}` 形式で、`*` はリテラルの区切り文字。
 *   （例: `character-tab*channel123*basic`）
 *
 * 照合意味論（registry base handler）: 文字列は exact または startsWith。`*` は glob ではなくリテラル。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す前方一致 pattern（`*` はリテラル・不変） */
export const CHARACTER_TAB_CUSTOM_ID_PATTERN = 'character-tab*'

export const CharacterTabCustomId = {
  pattern: CHARACTER_TAB_CUSTOM_ID_PATTERN
} as const
