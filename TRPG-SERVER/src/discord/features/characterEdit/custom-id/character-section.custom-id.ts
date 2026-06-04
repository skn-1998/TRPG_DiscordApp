/**
 * characterEdit セクション選択 customId 契約（純粋モジュール）
 *
 * - 生成フォーマット（2 種）:
 *   - edit-section  : `character-edit-section-{characterId}`
 *   - section-select: `character-section-select-{characterId}`
 * - handler 照合 pattern（正規表現）: `/^character-(edit-section|section-select)-/`
 *
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** edit-section 用 prefix（不変） */
export const CHARACTER_EDIT_SECTION_CUSTOM_ID_PREFIX = 'character-edit-section-'

/** section-select 用 prefix（不変） */
export const CHARACTER_SECTION_SELECT_CUSTOM_ID_PREFIX = 'character-section-select-'

/** handler の getCustomIdPattern() が返す正規表現（不変） */
export const CHARACTER_SECTION_CUSTOM_ID_PATTERN = /^character-(edit-section|section-select)-/

/**
 * characterId 抽出用の解析パターン（**非アンカー・現挙動を保存**）。
 * `(.+)` は greedy のため `character-edit-section-a-b-c` → `a-b-c`。
 * strict（startsWith ベース）ではないため、prefix が途中にあっても match する現挙動を保つ。
 */
export const CHARACTER_EDIT_SECTION_PARSE_PATTERN = /character-edit-section-(.+)/
export const CHARACTER_SECTION_SELECT_PARSE_PATTERN = /character-section-select-(.+)/

export const CharacterSectionCustomId = {
  pattern: CHARACTER_SECTION_CUSTOM_ID_PATTERN,
  editSectionPrefix: CHARACTER_EDIT_SECTION_CUSTOM_ID_PREFIX,
  sectionSelectPrefix: CHARACTER_SECTION_SELECT_CUSTOM_ID_PREFIX,

  createEditSection(characterId: string): string {
    return `${CHARACTER_EDIT_SECTION_CUSTOM_ID_PREFIX}${characterId}`
  },

  createSectionSelect(characterId: string): string {
    return `${CHARACTER_SECTION_SELECT_CUSTOM_ID_PREFIX}${characterId}`
  },

  /** customId が section-select のものか判定する（純粋）。 */
  isSectionSelect(customId: string): boolean {
    return customId.startsWith(CHARACTER_SECTION_SELECT_CUSTOM_ID_PREFIX)
  },

  /**
   * section-select customId から characterId を抽出する（純粋）。
   * 現挙動を保存: prefix を replace で除去する（prefix を含まない場合は元の文字列を返す）。
   */
  parseSectionSelect(customId: string): string {
    return customId.replace(CHARACTER_SECTION_SELECT_CUSTOM_ID_PREFIX, '')
  }
} as const
