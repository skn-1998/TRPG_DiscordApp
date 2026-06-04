/**
 * characterEdit compact-view customId 契約（純粋モジュール）
 *
 * - 生成フォーマット: `character-compact-view-{characterId}`
 * - handler 照合 pattern（前方一致）: `character-compact-view-`
 *
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

type CharacterCompactParsedCustomId = {
  characterId: string
}

/** handler の getCustomIdPattern() が返す前方一致 prefix（不変） */
export const CHARACTER_COMPACT_CUSTOM_ID_PATTERN = 'character-compact-view-'

export const CharacterCompactCustomId = {
  pattern: CHARACTER_COMPACT_CUSTOM_ID_PATTERN,

  create(characterId: string): string {
    return `${CHARACTER_COMPACT_CUSTOM_ID_PATTERN}${characterId}`
  },

  parse(customId: string): CharacterCompactParsedCustomId | null {
    if (!customId.startsWith(CHARACTER_COMPACT_CUSTOM_ID_PATTERN)) {
      return null
    }

    const characterId = customId.slice(CHARACTER_COMPACT_CUSTOM_ID_PATTERN.length)
    if (!characterId) {
      return null
    }

    return { characterId }
  }
} as const
