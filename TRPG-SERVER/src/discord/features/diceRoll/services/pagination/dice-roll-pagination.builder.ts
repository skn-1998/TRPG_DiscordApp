import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  APISelectMenuOption
} from 'discord.js'
import { Character } from 'src/domains/character/models/character.model'
import { DiceRollText } from 'src/domains/dice-roll/models/dice-roll-text.model'
import { DiceCharacterSelectCustomId, DicePageCustomId } from '../../custom-id'
import { ALL_CHARACTERS, formatDiceRoll, isSpecificCharacter, resolveHistoryTitle } from './dice-roll-pagination.util'

/**
 * discord.js の Embed / コンポーネントを組み立てる関数群（状態を持たない）。
 *
 * `DiceRollPaginationService` の UI 生成部分を抽出したもの。
 * キャッシュや状態管理には関与せず、入力から Builder を生成するだけ。
 */

/** Embed 1 ページあたりの description 上限（安全のため低めに設定） */
export const PAGE_LIMIT = 500

type PaginationRow = ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>

/**
 * 「履歴なし」を表す Embed を作成する。
 */
export function createEmptyEmbed(title: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor('#ff6b6b')
    .setDescription('ダイスロール履歴がありません。')
    .setTimestamp()
}

/**
 * ダイスロール一覧から履歴 Embed のページ配列を作成する。
 * フッターは付与しない（{@link setPageFooters} で別途付与）。
 */
export function buildHistoryPages(
  rolls: DiceRollText[],
  characterId: string | undefined,
  characters: Character[] | null
): EmbedBuilder[] {
  const title = resolveHistoryTitle(characterId, characters)

  const pages: EmbedBuilder[] = []
  let currentPage = new EmbedBuilder().setTitle(title).setColor('#0099ff')
  let currentLength = 0

  for (const roll of rolls) {
    try {
      const rollText = formatDiceRoll(roll)
      const newLength = currentLength + rollText.length

      // ページ制限を超える場合は新しいページを作成
      if (newLength > PAGE_LIMIT && currentPage.data.description) {
        pages.push(currentPage)
        currentPage = new EmbedBuilder().setTitle(title).setColor('#0099ff')
        currentLength = 0
      }

      const currentDescription = currentPage.data.description || ''
      currentPage.setDescription(currentDescription + rollText)
      currentLength += rollText.length
    } catch (error) {
      console.error(`[PHASE3] ダイスロール処理エラー:`, error)
      continue
    }
  }

  // 最後のページを追加
  if (currentPage.data.description) {
    pages.push(currentPage)
  }

  return pages
}

/**
 * 各ページにフッター（ページ番号）を設定する。
 */
export function setPageFooters(pages: EmbedBuilder[]): EmbedBuilder[] {
  return pages.map((page, index) => {
    return page.setFooter({
      text: `ページ ${index + 1}/${pages.length}`,
      iconURL: undefined
    })
  })
}

/**
 * ページ移動ボタン行（最初/前/次/最後/閉じる）を作成する。
 */
export function buildPageButtonRow(
  messageId: string,
  channelId: string,
  currentPage: number | undefined,
  totalPages: number
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(DicePageCustomId.first(messageId, channelId))
      .setLabel('最初')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId(DicePageCustomId.prev(messageId, channelId))
      .setLabel('前')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === 1),
    new ButtonBuilder()
      .setCustomId(DicePageCustomId.next(messageId, channelId))
      .setLabel('次')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage === totalPages),
    new ButtonBuilder()
      .setCustomId(DicePageCustomId.last(messageId, channelId))
      .setLabel('最後')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === totalPages),
    new ButtonBuilder()
      .setCustomId(DicePageCustomId.cancel(messageId, channelId))
      .setLabel('閉じる')
      .setStyle(ButtonStyle.Danger)
  )
}

/**
 * ページ選択メニュー行を作成する。
 * 作成に失敗した場合は null を返す（呼び出し側でスキップ可能）。
 */
export function buildPageSelectRow(
  messageId: string,
  channelId: string,
  currentPage: number,
  totalPages: number
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  try {
    const pageOptions: APISelectMenuOption[] = []

    // 最大25ページまで選択肢を作成（Discord制限）
    const maxPages = Math.min(totalPages, 25)
    for (let i = 1; i <= maxPages; i++) {
      pageOptions.push({
        label: `ページ ${i}`,
        value: i.toString(),
        description: `ページ ${i} に移動`,
        default: i === currentPage
      })
    }

    // 25ページを超える場合は省略表示
    if (totalPages > 25) {
      pageOptions.push({
        label: `... (${totalPages}ページ中)`,
        value: '25',
        description: '一部のページのみ表示されています'
      })
    }

    const pageSelectMenu = new StringSelectMenuBuilder()
      .setCustomId(DicePageCustomId.select(messageId, channelId))
      .setPlaceholder('ページを選択')
      .addOptions(pageOptions)

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(pageSelectMenu)
  } catch (error) {
    console.error('[PHASE3] ページ選択メニュー作成エラー:', error)
    return null
  }
}

/**
 * キャラクター選択メニュー行を作成する。
 * キャラクターが 0 件の場合は null を返す（呼び出し側でスキップ）。
 */
export function buildCharacterSelectRow(
  messageId: string,
  channelId: string,
  characters: Character[],
  selectedCharacterId: string | undefined
): ActionRowBuilder<StringSelectMenuBuilder> | null {
  // キャラクターが見つからない場合は何も表示しない
  if (characters.length === 0) {
    return null
  }

  // セレクトメニューオプションを作成
  const characterOptions: APISelectMenuOption[] = [
    {
      label: '全て表示',
      value: ALL_CHARACTERS,
      description: '全キャラクターのダイスロール履歴を表示',
      default: !selectedCharacterId || selectedCharacterId === ALL_CHARACTERS
    }
  ]

  // キャラクターオプションを追加（最大24件、Discord制限）
  const maxCharacters = Math.min(characters.length, 24)
  for (let i = 0; i < maxCharacters; i++) {
    const char = characters[i]
    characterOptions.push({
      label: char.characterName || `キャラクター ${i + 1}`,
      value: char.characterId,
      description: `${char.characterName || 'キャラクター'}のダイスロール履歴`,
      default: selectedCharacterId === char.characterId
    })
  }

  const characterSelectMenu = new StringSelectMenuBuilder()
    .setCustomId(DiceCharacterSelectCustomId.create(messageId, channelId))
    .setPlaceholder('キャラクターを選択')
    .addOptions(characterOptions)

  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(characterSelectMenu)
}

export type { PaginationRow }
export { isSpecificCharacter }
