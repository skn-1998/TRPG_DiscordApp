/**
 * characterThread キャラクターダイスボタン customId 契約（純粋モジュール）
 *
 * - handler 照合 pattern（文字列・前方一致）: `character-dice`
 *   生成 customId は `character-dice*{action}*{characterId}` 形式（`*` はリテラルの区切り）。
 *   （例: `character-dice*action*char123`）
 *
 * 照合意味論（registry base handler）: 文字列は exact または startsWith。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す前方一致 pattern（不変） */
export const CHARACTER_DICE_CUSTOM_ID_PATTERN = 'character-dice'

export const CharacterDiceCustomId = {
  pattern: CHARACTER_DICE_CUSTOM_ID_PATTERN
} as const
