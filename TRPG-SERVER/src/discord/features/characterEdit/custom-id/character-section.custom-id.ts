/**
 * characterEdit セクション選択 customId 契約（純粋モジュール）
 *
 * - customId 形式（2 種）:
 *   - edit-section  : `character-edit-section-{characterId}`
 *   - section-select: `character-section-select-{characterId}`
 * - handler 照合 pattern（正規表現）: `/^character-(edit-section|section-select)-/`
 * - section-select 形式は現在 production に生成元がなく、pattern による受理のみを後方互換として残す。
 *
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** edit-section 用 prefix（不変） */
export const CHARACTER_EDIT_SECTION_CUSTOM_ID_PREFIX = 'character-edit-section-'

/** handler の getCustomIdPattern() が返す正規表現（不変） */
export const CHARACTER_SECTION_CUSTOM_ID_PATTERN = /^character-(edit-section|section-select)-/

/**
 * characterId 抽出用のアンカー付き解析パターン（I3・俯瞰#20 F-1）。
 * 到達 customId は registry pattern により family prefix が位置 0 にあることが保証される。
 * `(.+)` は greedy のため `character-edit-section-a-b-c` → `a-b-c`。
 */
export const CHARACTER_EDIT_SECTION_PARSE_PATTERN = /^character-edit-section-(.+)/
export const CHARACTER_SECTION_SELECT_PARSE_PATTERN = /^character-section-select-(.+)/

export const CharacterSectionCustomId = {
  pattern: CHARACTER_SECTION_CUSTOM_ID_PATTERN,

  createEditSection(characterId: string): string {
    return `${CHARACTER_EDIT_SECTION_CUSTOM_ID_PREFIX}${characterId}`
  }
} as const
