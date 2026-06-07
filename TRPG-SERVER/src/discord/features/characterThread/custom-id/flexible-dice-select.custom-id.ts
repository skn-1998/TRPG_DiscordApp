/**
 * characterThread フレキシブルダイス セレクト customId 契約（純粋モジュール）
 *
 * - handler 照合 pattern（文字列・前方一致）: `flexible_dice_`
 *   生成 customId は `flexible_dice_{...}` 形式。
 *
 * 照合意味論（registry base handler）: 文字列は exact または startsWith（score 50+len）。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す前方一致 pattern（不変） */
export const FLEXIBLE_DICE_SELECT_CUSTOM_ID_PATTERN = 'flexible_dice_'

export const FlexibleDiceSelectCustomId = {
  pattern: FLEXIBLE_DICE_SELECT_CUSTOM_ID_PATTERN,

  /**
   * フレキシブルダイス セレクトの customId を生成する（純粋）。
   * 形式: `flexible_dice_{channelId}`（pattern と prefix が同一＝startsWith でマッチ）。
   */
  create(channelId: string): string {
    return `${FLEXIBLE_DICE_SELECT_CUSTOM_ID_PATTERN}${channelId}`
  }
} as const
