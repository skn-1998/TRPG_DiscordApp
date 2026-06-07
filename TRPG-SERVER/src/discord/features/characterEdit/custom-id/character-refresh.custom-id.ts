/**
 * characterEdit refresh customId 契約（純粋モジュール）
 *
 * - 生成フォーマット: `character-refresh-{characterId}`
 * - handler 照合 pattern（前方一致）: `character-refresh-`
 *
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

type CharacterRefreshParsedCustomId = {
  characterId: string
}

/** handler の getCustomIdPattern() が返す前方一致 prefix（不変） */
export const CHARACTER_REFRESH_CUSTOM_ID_PATTERN = 'character-refresh-'

export const CharacterRefreshCustomId = {
  pattern: CHARACTER_REFRESH_CUSTOM_ID_PATTERN,

  create(characterId: string): string {
    return `${CHARACTER_REFRESH_CUSTOM_ID_PATTERN}${characterId}`
  },

  /**
   * customId が refresh ボタンのものか判定する（純粋）。
   * 分岐ディスパッチの現挙動を保存するため startsWith 判定（characterId 空でも true）。
   */
  is(customId: string): boolean {
    return customId.startsWith(CHARACTER_REFRESH_CUSTOM_ID_PATTERN)
  },

  parse(customId: string): CharacterRefreshParsedCustomId | null {
    if (!customId.startsWith(CHARACTER_REFRESH_CUSTOM_ID_PATTERN)) {
      return null
    }

    const characterId = customId.slice(CHARACTER_REFRESH_CUSTOM_ID_PATTERN.length)
    if (!characterId) {
      return null
    }

    return { characterId }
  }
} as const
