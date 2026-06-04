/**
 * characterThread フレキシブルダイス パラメータ選択 customId 契約（純粋モジュール）
 *
 * - handler 照合 pattern（文字列・前方一致）: `flexible-dice-param*`
 *   生成 customId は `flexible-dice-param*{...}` 形式で、`*` はリテラルの区切り文字。
 *   （例: `flexible-dice-param*char123`）
 *
 * 照合意味論（registry base handler）: 文字列は exact または startsWith。`*` は glob ではなくリテラル。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す前方一致 pattern（`*` はリテラル・不変） */
export const FLEXIBLE_DICE_PARAM_CUSTOM_ID_PATTERN = 'flexible-dice-param*'

export const FlexibleDiceParamCustomId = {
  pattern: FLEXIBLE_DICE_PARAM_CUSTOM_ID_PATTERN
} as const
