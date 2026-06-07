/**
 * characterThread 能力(ability)ロールボタン customId 契約（純粋モジュール）
 *
 * - 生成フォーマット: `ability_{channelId}_{abilityKey}`
 *   channelId は Discord snowflake（`_` を含まない）前提のため、prefix 除去後の最初の `_` で分割する。
 *   abilityKey は `_` を含み得る（残り全体を abilityKey とする）。
 * - handler 照合 pattern（文字列・前方一致）: `ability_`
 *
 * 照合意味論（registry base handler）: 文字列は exact または startsWith（score 50+len）。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 * （skill-roll.custom-id.ts と同型のミラー）
 */

/** handler の getCustomIdPattern() が返す前方一致 pattern（不変） */
export const ABILITY_ROLL_CUSTOM_ID_PATTERN = 'ability_'

export interface ParsedAbilityRollCustomId {
  channelId: string
  abilityKey: string
}

export const AbilityRollCustomId = {
  pattern: ABILITY_ROLL_CUSTOM_ID_PATTERN,

  /**
   * 能力ロールボタンの customId を生成する（純粋）。
   * 形式: `ability_{channelId}_{abilityKey}`。
   */
  create(channelId: string, abilityKey: string): string {
    return `${ABILITY_ROLL_CUSTOM_ID_PATTERN}${channelId}_${abilityKey}`
  },

  /**
   * `ability_{channelId}_{abilityKey}` を分解する（純粋）。
   * prefix 除去後、最初の `_` までを channelId、残りを abilityKey とする（abilityKey は `_` を含み得る）。
   * 次の場合は null: prefix 不一致 / `_` が無い / channelId が空（先頭が `_`） / abilityKey が空（末尾が `_`）。
   */
  parse(customId: string): ParsedAbilityRollCustomId | null {
    if (!customId.startsWith(ABILITY_ROLL_CUSTOM_ID_PATTERN)) {
      return null
    }
    const rest = customId.slice(ABILITY_ROLL_CUSTOM_ID_PATTERN.length)
    const separatorIndex = rest.indexOf('_')
    // separatorIndex <= 0 は「`_` 無し」または「channelId 空（先頭が `_`）」を弾く
    if (separatorIndex <= 0) {
      return null
    }
    const channelId = rest.slice(0, separatorIndex)
    const abilityKey = rest.slice(separatorIndex + 1)
    if (!abilityKey) {
      return null
    }
    return { channelId, abilityKey }
  }
} as const
