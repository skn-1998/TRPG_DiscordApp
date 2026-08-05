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

/** field-edit / field-add の操作 prefix（生成 createEdit/createAdd と探索側 includes 判定の正本） */
export const CHARACTER_FIELD_EDIT_CUSTOM_ID_PREFIX = 'character-field-edit-'
export const CHARACTER_FIELD_ADD_CUSTOM_ID_PREFIX = 'character-field-add-'

/**
 * field-edit / field-add から characterId を抽出するアンカー付き解析パターン
 * （I3・俯瞰#20 F-1）。到達 customId は registry pattern により family prefix が位置 0 にある。
 */
export const CHARACTER_FIELD_EDIT_PARSE_PATTERN = /^character-field-edit-\w+-(.+)/
export const CHARACTER_FIELD_ADD_PARSE_PATTERN = /^character-field-add-\w+-(.+)/

/**
 * field customId 中のセクション中置 `-{sectionType}-` の正本。
 * 生成側（createEdit/createAdd）は PREFIX + `${sectionType}-` の合成で同一 bytes を生成するため
 * 本関数を直接は呼べない。両者の一致は custom-id-predicates.spec.ts で固定する。
 */
export function characterFieldSectionInfix(sectionType: string): string {
  return `-${sectionType}-`
}

export const CharacterFieldCustomId = {
  pattern: CHARACTER_FIELD_CUSTOM_ID_PATTERN,

  createEdit(sectionType: string, characterId: string): string {
    return `${CHARACTER_FIELD_EDIT_CUSTOM_ID_PREFIX}${sectionType}-${characterId}`
  },

  createAdd(sectionType: string, characterId: string): string {
    return `${CHARACTER_FIELD_ADD_CUSTOM_ID_PREFIX}${sectionType}-${characterId}`
  }
} as const
