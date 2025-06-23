import gameSystemList from '~/static/gameSystemList.json'
import _ from 'lodash'
import Fuse from 'fuse.js'
import moji from 'moji'
import convertRomanToKana from '~/utils/convertRomanToKana'
import { OptionsFilter } from '@mantine/core'
import { GameSystemJSON } from '~/types/gameSystem'

const fuseOptions = {
  threshold: 0.4,
  keys: ['SEARCH_KEY_KANJI', 'SEARCH_KEY_HIRAGANA']
}

// ソート済みのゲームシステムリスト
export const sortedGameSystemList = _.sortBy(gameSystemList, ['PRIORITY', 'SORT_KEY'])

// Fuseインスタンス
export const fuse = new Fuse<GameSystemJSON>(sortedGameSystemList, fuseOptions)

// セレクトボックス用のオプション配列
export const gameSystemOptions = sortedGameSystemList.map((e) => ({ value: e.ID, label: e.NAME }))

/**
 * 検索テキストをひらがな・カタカナに変換する
 * @param str 検索文字列
 * @returns [変換済み文字列1, 変換済み文字列2]
 */
export function convertSearchText(str: string): [string, string] {
  const _str = str.trim()
  // 全角英数・全角スペースを半角に
  const HE = moji(_str).convert('ZS', 'HS').convert('ZE', 'HE').toString()
  // ローマ字をカタカナに
  const KKfromRoman = convertRomanToKana(HE)
  // カタカナをひらがなに統一 ローマ字(英字)はそのまま
  const convertedWithRoman = moji(HE).convert('KK', 'HG').toString()
  // ローマ字をカタカナにしてからひらがなに統一
  const convertedAllHG = moji(KKfromRoman).convert('KK', 'HG').toString()
  return [convertedWithRoman, convertedAllHG]
}

/**
 * ゲームシステムの検索を行う
 * @param searchQuery 検索クエリ
 * @returns 検索結果のゲームシステム配列
 */
export function searchGameSystems(searchQuery: string): GameSystemJSON[] {
  const _search = searchQuery.trim()
  if (_search === '') return sortedGameSystemList

  const gameSystemSearchText = convertSearchText(_search.slice(0, 200))
  const gameSystemSearchArr_KANJI = gameSystemSearchText.map((e) => ({ SEARCH_KEY_KANJI: e }))
  const gameSystemSearchArr_HIRAGANA = gameSystemSearchText.map((e) => ({ SEARCH_KEY_HIRAGANA: e }))
  const gameSystemSearchArr = [...gameSystemSearchArr_KANJI, ...gameSystemSearchArr_HIRAGANA]

  const searchResults = fuse.search({ $or: gameSystemSearchArr }).map((e) => e.item)
  return searchResults
}

/**
 * Mantineのセレクトボックス用のオプションフィルター関数
 * @param options セレクトボックスのオプション
 * @param search 検索文字列
 * @returns フィルタリング済みのオプション配列
 */
export const createGameSystemOptionsFilter = (): OptionsFilter => {
  return ({ options, search }) => {
    const _search = search.trim()
    if (_search === '') return gameSystemOptions

    const searchResults = searchGameSystems(_search)
    const formattedResult = searchResults.map((e) => ({ value: e.ID, label: e.NAME }))
    return formattedResult
  }
}

/**
 * ゲームシステムIDから名前を取得する
 * @param id ゲームシステムID
 * @returns ゲームシステム名（見つからない場合は空文字列）
 */
export function getGameSystemNameById(id: string): string {
  const gameSystem = sortedGameSystemList.find((system) => system.ID === id)
  return gameSystem?.NAME || ''
}

/**
 * ゲームシステムIDから詳細情報を取得する
 * @param id ゲームシステムID
 * @returns ゲームシステム詳細情報（見つからない場合はundefined）
 */
export function getGameSystemById(id: string): GameSystemJSON | undefined {
  return sortedGameSystemList.find((system) => system.ID === id)
}

/**
 * ゲームシステムのヘルプメッセージを取得する
 * @param id ゲームシステムID
 * @returns ヘルプメッセージ（見つからない場合は空文字列）
 */
export function getGameSystemHelpMessage(id: string): string {
  const gameSystem = sortedGameSystemList.find((system) => system.ID === id)
  return gameSystem?.HELP_MESSAGE || ''
}
