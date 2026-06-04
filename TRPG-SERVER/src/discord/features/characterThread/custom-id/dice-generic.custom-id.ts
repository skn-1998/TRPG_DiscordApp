/**
 * characterThread 汎用ダイスボタン customId 契約（純粋モジュール）
 *
 * - handler 照合 pattern（文字列・前方一致）: `dice_generic_`
 *   生成 customId は `dice_generic_{notation}_{...}` 形式。
 *   （例: `dice_generic_1d6_1234567890`）
 *
 * 照合意味論（registry base handler）: 文字列は exact または startsWith（score 50+len）。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す前方一致 pattern（不変） */
export const DICE_GENERIC_CUSTOM_ID_PATTERN = 'dice_generic_'

export const DiceGenericCustomId = {
  pattern: DICE_GENERIC_CUSTOM_ID_PATTERN
} as const
