import { DiceRollText } from 'src/domains/dice-roll/models/dice-roll-text.model'
import { CharacterEntity } from 'src/domains/character/models/character.entity'

/**
 * ページネーションに関する純粋関数群（副作用なし・discord.js 非依存）。
 *
 * `DiceRollPaginationService` から抽出した計算・整形ロジック。
 * I/O・DI・状態を持たないため、モックなしで単体テスト可能。
 */

/** ダイスロール履歴の既定タイトル */
export const DEFAULT_HISTORY_TITLE = 'ダイスロール履歴'

/** ロール履歴の最大保持件数 */
export const MAX_ROLL_LIMIT = 500

/** 「全キャラクター」を表す特別な characterId */
export const ALL_CHARACTERS = 'all'

/**
 * characterId が「特定キャラクター」を指しているか判定する。
 * 未指定または 'all' の場合は false。
 */
export function isSpecificCharacter(characterId?: string): boolean {
  return !!characterId && characterId !== ALL_CHARACTERS
}

/**
 * 表示中キャラクターに応じた履歴タイトルを解決する。
 * 特定キャラクター指定時はキャッシュからキャラクター名を引き、
 * 見つからなければ characterId をそのまま使う。
 */
export function resolveHistoryTitle(characterId: string | undefined, characters: CharacterEntity[] | null): string {
  if (!isSpecificCharacter(characterId)) {
    return DEFAULT_HISTORY_TITLE
  }

  const character = characters?.find((c) => c.characterId === characterId)
  const characterName = character?.characterName || characterId
  return `${characterName}のダイスロール履歴`
}

/**
 * 指定された characterId でダイスロールをフィルタリングする。
 * 未指定または 'all' の場合は全件をそのまま返す。
 */
export function filterRollsByCharacter(rolls: DiceRollText[], characterId?: string): DiceRollText[] {
  if (!isSpecificCharacter(characterId)) {
    return rolls
  }
  return rolls.filter((roll) => roll.characterId === characterId)
}

/**
 * ダイスロールを作成日時の新しい順にソートする（非破壊）。
 */
export function sortRollsByCreatedAtDesc(rolls: DiceRollText[]): DiceRollText[] {
  return [...rolls].sort((a, b) => {
    const timeA = a.createdAt || new Date(0)
    const timeB = b.createdAt || new Date(0)
    return new Date(timeB).getTime() - new Date(timeA).getTime()
  })
}

/**
 * ロール履歴を上限件数で切り詰める。
 */
export function limitRolls(rolls: DiceRollText[], limit = MAX_ROLL_LIMIT): DiceRollText[] {
  return rolls.slice(0, limit)
}

/**
 * 1 件のダイスロールを表示用文字列にフォーマットする。
 */
export function formatDiceRoll(roll: DiceRollText): string {
  const timestamp = new Date(roll.createdAt || new Date())
  const timeString = timestamp.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })

  // textプロパティをそのまま使用
  const rollText = roll.text || `${roll.diceRoll} → ${roll.result}`

  return `**${timeString}** ${rollText}\n`
}

/**
 * ページ移動方向から新しいページ番号を計算する（1 始まり）。
 * 結果は [1, totalPages] にクランプされる。
 */
export function computeNewPage(
  currentPage: number,
  totalPages: number,
  direction: 'prev' | 'next' | 'first' | 'last'
): number {
  switch (direction) {
    case 'prev':
      return Math.max(1, currentPage - 1)
    case 'next':
      return Math.min(totalPages, currentPage + 1)
    case 'first':
      return 1
    case 'last':
      return totalPages
  }
}

/**
 * 指定ページ番号を [1, totalPages] にクランプする。
 */
export function clampPage(pageNumber: number, totalPages: number): number {
  return Math.max(1, Math.min(totalPages, pageNumber))
}
