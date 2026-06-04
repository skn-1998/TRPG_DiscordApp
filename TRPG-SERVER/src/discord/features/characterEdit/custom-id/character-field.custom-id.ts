/**
 * characterEdit フィールド選択 customId 契約（純粋モジュール）
 *
 * - 生成フォーマット（2 種）:
 *   - field-edit: `character-field-edit-{sectionType}-{characterId}`
 *   - field-add : `character-field-add-{sectionType}-{characterId}`
 * - handler 照合 pattern（前方一致）: `character-field-`
 *
 * sectionType は文字列補間のみで使用するため string 型で受ける（内部型に依存しない）。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す前方一致 prefix（不変） */
export const CHARACTER_FIELD_CUSTOM_ID_PATTERN = 'character-field-'

/** field-edit / field-add から characterId を抽出する正規表現（現挙動を保存） */
export const CHARACTER_FIELD_EDIT_PARSE_PATTERN = /character-field-edit-\w+-(.+)/
export const CHARACTER_FIELD_ADD_PARSE_PATTERN = /character-field-add-\w+-(.+)/

export const CharacterFieldCustomId = {
  pattern: CHARACTER_FIELD_CUSTOM_ID_PATTERN,

  createEdit(sectionType: string, characterId: string): string {
    return `character-field-edit-${sectionType}-${characterId}`
  },

  createAdd(sectionType: string, characterId: string): string {
    return `character-field-add-${sectionType}-${characterId}`
  }
} as const
