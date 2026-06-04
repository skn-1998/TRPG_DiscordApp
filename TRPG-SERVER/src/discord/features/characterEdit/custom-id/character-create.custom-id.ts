/**
 * characterEdit 作成ボタン customId 契約（純粋モジュール）
 *
 * - 生成フォーマット:
 *   - basic : `character-create-basic-{channelId}-{userId}`
 *   - cancel: `character-create-cancel-{channelId}-{userId}`
 * - handler 照合 pattern（正規表現）: `/^character-create-(basic|cancel)-/`
 *
 * 解析（parseBasic）は非貪欲マッチで channelId / userId を分離する現挙動を保存する:
 *   `/character-create-basic-(.+?)-(.+)$/`
 *
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

type CharacterCreateAction = 'basic' | 'cancel'

const CHARACTER_CREATE_PREFIX: Record<CharacterCreateAction, string> = {
  basic: 'character-create-basic-',
  cancel: 'character-create-cancel-'
}

type CharacterCreateBasicParsedCustomId = {
  channelId: string | null
  userId: string | null
}

/** handler の getCustomIdPattern() が返す正規表現（不変） */
export const CHARACTER_CREATE_CUSTOM_ID_PATTERN = /^character-create-(basic|cancel)-/

/** parseBasic が使用する非貪欲解析パターン（現挙動を保存） */
const CHARACTER_CREATE_BASIC_PARSE_PATTERN = /character-create-basic-(.+?)-(.+)$/

export const CharacterCreateCustomId = {
  pattern: CHARACTER_CREATE_CUSTOM_ID_PATTERN,

  createBasic(channelId: string, userId: string): string {
    return `${CHARACTER_CREATE_PREFIX.basic}${channelId}-${userId}`
  },

  createCancel(channelId: string, userId: string): string {
    return `${CHARACTER_CREATE_PREFIX.cancel}${channelId}-${userId}`
  },

  /**
   * customId が basic 作成ボタンのものか判定する（純粋）。
   * 分岐ディスパッチの現挙動を保存するため startsWith 判定。
   */
  isBasic(customId: string): boolean {
    return customId.startsWith(CHARACTER_CREATE_PREFIX.basic)
  },

  /**
   * customId が cancel 作成ボタンのものか判定する（純粋）。
   * 分岐ディスパッチの現挙動を保存するため startsWith 判定。
   */
  isCancel(customId: string): boolean {
    return customId.startsWith(CHARACTER_CREATE_PREFIX.cancel)
  },

  /**
   * basic 作成 customId から channelId / userId を抽出する（純粋）。
   * 一致しない場合は { channelId: null, userId: null }。
   */
  parseBasic(customId: string): CharacterCreateBasicParsedCustomId {
    const match = customId.match(CHARACTER_CREATE_BASIC_PARSE_PATTERN)

    if (!match) {
      return { channelId: null, userId: null }
    }

    return {
      channelId: match[1],
      userId: match[2]
    }
  }
} as const
