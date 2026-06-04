/**
 * characterThread スレッド作成セレクト customId 契約（純粋モジュール）
 *
 * - handler 照合 pattern（文字列）: `character-thread-create-select`
 *   （exact 一致 or 前方一致。現状の customId は完全一致で使用）
 *
 * 照合意味論（registry base handler）: 文字列は exact（score 100）または startsWith（score 50+len）。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す文字列 pattern（不変） */
export const CHARACTER_THREAD_CREATE_CUSTOM_ID_PATTERN = 'character-thread-create-select'

export const CharacterThreadCreateCustomId = {
  pattern: CHARACTER_THREAD_CREATE_CUSTOM_ID_PATTERN
} as const
