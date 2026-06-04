/**
 * characterThread スキルロールボタン customId 契約（純粋モジュール）
 *
 * - 生成フォーマット: `skill_{channelId}_{skillKey}`
 *   channelId は Discord snowflake（`_` を含まない）前提のため、prefix 除去後の最初の `_` で分割する。
 *   skillKey は `_` を含み得る（残り全体を skillKey とする）。
 * - handler 照合 pattern（文字列・前方一致）: `skill_`
 *
 * 照合意味論（registry base handler）: 文字列は exact または startsWith（score 50+len）。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す前方一致 pattern（不変） */
export const SKILL_ROLL_CUSTOM_ID_PATTERN = 'skill_'

export interface ParsedSkillRollCustomId {
  channelId: string
  skillKey: string
}

export const SkillRollCustomId = {
  pattern: SKILL_ROLL_CUSTOM_ID_PATTERN,

  /**
   * スキルロールボタンの customId を生成する（純粋）。
   * 形式: `skill_{channelId}_{skillKey}`。
   */
  create(channelId: string, skillKey: string): string {
    return `${SKILL_ROLL_CUSTOM_ID_PATTERN}${channelId}_${skillKey}`
  },

  /**
   * `skill_{channelId}_{skillKey}` を分解する（純粋）。
   * prefix 除去後、最初の `_` までを channelId、残りを skillKey とする（skillKey は `_` を含み得る）。
   * prefix 不一致 / 分割不能（`_` が無い）の場合は null。
   */
  parse(customId: string): ParsedSkillRollCustomId | null {
    if (!customId.startsWith(SKILL_ROLL_CUSTOM_ID_PATTERN)) {
      return null
    }
    const rest = customId.slice(SKILL_ROLL_CUSTOM_ID_PATTERN.length)
    const separatorIndex = rest.indexOf('_')
    if (separatorIndex < 0) {
      return null
    }
    return {
      channelId: rest.slice(0, separatorIndex),
      skillKey: rest.slice(separatorIndex + 1)
    }
  }
} as const
