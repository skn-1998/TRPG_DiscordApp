/**
 * characterThread スレッド選択 customId 契約（純粋モジュール）
 *
 * - handler 照合 pattern（正規表現）: `/^character-thread-select(-with-thread|-current)?$/`
 *   （`character-thread-select` / `-with-thread` / `-current` の3形に完全一致）
 *
 * 照合意味論（registry base handler）: RegExp は `pattern.test(customId)`（score 30）。
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

/** handler の getCustomIdPattern() が返す正規表現（不変） */
export const CHARACTER_THREAD_SELECT_CUSTOM_ID_PATTERN = /^character-thread-select(-with-thread|-current)?$/

export const CharacterThreadSelectCustomId = {
  pattern: CHARACTER_THREAD_SELECT_CUSTOM_ID_PATTERN
} as const
