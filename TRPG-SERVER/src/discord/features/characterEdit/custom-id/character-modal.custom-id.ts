/**
 * characterEdit 編集モーダル customId 契約（純粋モジュール）
 *
 * - 生成フォーマット（2 種）:
 *   - direct  : `char-edit-{sectionType}-{fieldKey}-{characterId}`
 *   - session : `char-edit-modal-{sessionId}`
 * - handler 照合 pattern（正規表現）: `/^char-edit(-modal)?-/`
 *
 * sectionType / fieldKey は文字列補間のみで使用するため string 型で受ける。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** session 形式の prefix（不変） */
export const CHARACTER_MODAL_SESSION_PREFIX = 'char-edit-modal-'

/** legacy（direct）形式の prefix（不変） */
export const CHARACTER_MODAL_LEGACY_PREFIX = 'char-edit-'

/** handler の getCustomIdPattern() が返す正規表現（不変） */
export const CHARACTER_MODAL_CUSTOM_ID_PATTERN = /^char-edit(-modal)?-/

/**
 * モーダル customId の解析結果（編集用）。
 * セッション形式の場合は sessionId を返し、セッション取得は呼び出し側に委ねる。
 */
export type ParsedModalCustomId =
  | { kind: 'session'; sessionId: string }
  | { kind: 'legacy'; characterId: string; sectionType: string; fieldKey: string }
  | { kind: 'invalid' }

export const CharacterModalCustomId = {
  pattern: CHARACTER_MODAL_CUSTOM_ID_PATTERN,
  sessionPrefix: CHARACTER_MODAL_SESSION_PREFIX,
  legacyPrefix: CHARACTER_MODAL_LEGACY_PREFIX,

  /**
   * direct 形式のモーダル customId を生成する（純粋）。
   * @example createDirect('status', 'hp', 'abc123') // 'char-edit-status-hp-abc123'
   */
  createDirect(sectionType: string, fieldKey: string, characterId: string): string {
    return `${CHARACTER_MODAL_LEGACY_PREFIX}${sectionType}-${fieldKey}-${characterId}`
  },

  /**
   * session 形式のモーダル customId を生成する（純粋）。
   * @example createSession('SESSION99') // 'char-edit-modal-SESSION99'
   */
  createSession(sessionId: string): string {
    return `${CHARACTER_MODAL_SESSION_PREFIX}${sessionId}`
  },

  /**
   * モーダル customId を解析する（純粋）。
   * - セッション形式: char-edit-modal-{sessionId}
   * - レガシー形式  : char-edit-{sectionType}-{fieldKey}-{characterId...}
   */
  parse(customId: string): ParsedModalCustomId {
    // セッションベース形式
    if (customId.startsWith(CHARACTER_MODAL_SESSION_PREFIX)) {
      const sessionId = customId.slice(CHARACTER_MODAL_SESSION_PREFIX.length)
      return { kind: 'session', sessionId }
    }

    // 従来の形式（後方互換）
    if (customId.startsWith(CHARACTER_MODAL_LEGACY_PREFIX) && !customId.startsWith(CHARACTER_MODAL_SESSION_PREFIX)) {
      const rest = customId.slice(CHARACTER_MODAL_LEGACY_PREFIX.length)
      const parts = rest.split('-')

      if (parts.length < 3) {
        return { kind: 'invalid' }
      }

      const sectionType = parts[0]
      const fieldKey = parts[1]
      const characterId = parts.slice(2).join('-')

      return { kind: 'legacy', characterId, sectionType, fieldKey }
    }

    return { kind: 'invalid' }
  }
} as const
