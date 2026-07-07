import { Injectable, Logger } from '@nestjs/common'
import { EmbedBuilder } from 'discord.js'
import { CharacterEntity } from 'src/domains/character/models/character.entity'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { DiceRollCharacterProviderService } from './dice-roll-character-provider.service'
import { DiceRollPaginationStore, PaginatedDiceRoll } from './dice-roll-pagination.store'
import {
  ALL_CHARACTERS,
  clampPage,
  computeNewPage,
  filterRollsByCharacter,
  limitRolls,
  resolveHistoryTitle,
  sortRollsByCreatedAtDesc
} from './dice-roll-pagination.util'
import {
  buildCharacterSelectRow,
  buildHistoryPages,
  buildPageButtonRow,
  buildPageSelectRow,
  createEmptyEmbed,
  setPageFooters,
  type PaginationRow
} from './dice-roll-pagination.builder'

// 状態を表す型は store を正本とし、後方互換のため再エクスポートする
export { PaginatedDiceRoll } from './dice-roll-pagination.store'

/**
 * ダイスロール履歴のページネーションを取りまとめる薄いオーケストレーター。
 *
 * 計算・整形は `dice-roll-pagination.util`、Embed/コンポーネント生成は
 * `dice-roll-pagination.builder`、状態・キャッシュ保持は
 * `DiceRollPaginationStore` に委譲する。公開メソッドのシグネチャは従来通り。
 */
@Injectable()
export class DiceRollPaginationService {
  private readonly logger = new Logger(DiceRollPaginationService.name)
  private readonly store = new DiceRollPaginationStore()

  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly characterProvider: DiceRollCharacterProviderService
  ) {}

  /**
   * ダイスロール結果をページネーション形式のEmbedに変換
   */
  async createPaginatedEmbeds(channelId: string, characterId?: string): Promise<EmbedBuilder[]> {
    try {
      // キャッシュから取得
      const cachedPages = this.store.getPagesFromCache(channelId, characterId || ALL_CHARACTERS)
      if (cachedPages) {
        this.logger.debug(`[PHASE3] キャッシュから取得: ${characterId || ALL_CHARACTERS} in ${channelId}`)
        return cachedPages
      }

      // ダイスロールデータを取得
      const diceRolls = await this.diceRollService.findTextsByChannelId(channelId)
      if (!diceRolls || diceRolls.length === 0) {
        this.logger.debug(`[PHASE3] ダイスロールデータが見つかりません: ${channelId}`)
        return this.createEmptyEmbed(channelId, characterId)
      }

      // キャラクターID指定時はフィルタ → 新しい順ソート → 最新500件に制限
      const filteredRolls = filterRollsByCharacter(diceRolls, characterId)
      const sortedRolls = sortRollsByCreatedAtDesc(filteredRolls)
      const limitedRolls = limitRolls(sortedRolls)

      const charactersFromCache = this.store.getCharactersFromCache(channelId)

      // キャラクター名を取得してタイトルに追加（特定キャラクターの場合のログ）
      if (characterId && characterId !== ALL_CHARACTERS) {
        const characterName = resolveTitleCharacterName(characterId, charactersFromCache)
        this.logger.debug(`[DiceRollPagination] キャラクター指定: ${characterName}`)
      }

      // ロール履歴がない場合
      if (limitedRolls.length === 0) {
        const title = resolveHistoryTitle(characterId, charactersFromCache)
        return [createEmptyEmbed(title)]
      }

      // Embedページを作成
      const pages = buildHistoryPages(limitedRolls, characterId, charactersFromCache)

      // 空の場合は空のEmbedを返す
      if (pages.length === 0) {
        return this.createEmptyEmbed(channelId, characterId)
      }

      // フッターを設定
      const pagesWithFooter = setPageFooters(pages)

      // キャッシュに保存
      this.store.savePagesToCache(channelId, characterId || ALL_CHARACTERS, pagesWithFooter)

      this.logger.debug(
        `[PHASE3] ${pagesWithFooter.length}ページ生成完了: ${characterId || ALL_CHARACTERS} in ${channelId}`
      )
      return pagesWithFooter
    } catch (error) {
      this.logger.error('[PHASE3] ページネーション生成エラー:', error)
      return this.createEmptyEmbed(channelId, characterId)
    }
  }

  /**
   * 空のEmbedを作成
   */
  private createEmptyEmbed(channelId: string, characterId?: string): EmbedBuilder[] {
    const characters = this.store.getCharactersFromCache(channelId)
    const title = resolveHistoryTitle(characterId, characters)
    return [createEmptyEmbed(title)]
  }

  /**
   * ページネーション用のボタンコントロールを作成
   */
  async createPaginationControls(messageId: string, channelId: string, totalPages: number): Promise<PaginationRow[]> {
    const rows: PaginationRow[] = []

    // 現在の状態を取得
    const state = this.store.getPaginationState(channelId, messageId)

    // ページ移動ボタンを作成
    rows.push(buildPageButtonRow(messageId, channelId, state?.currentPage, totalPages))

    // ページ数が多い場合はページ選択メニューを追加
    if (totalPages > 3) {
      const selectRow = buildPageSelectRow(messageId, channelId, state?.currentPage || 1, totalPages)
      if (selectRow) {
        rows.push(selectRow)
      }
    }

    // キャラクター選択メニューを追加（ページ数に関係なく表示）
    await this.addCharacterSelectMenu(rows, messageId, channelId, state)

    return rows
  }

  /**
   * キャッシュを無効化
   */
  invalidateCache(channelId: string, characterId?: string): void {
    this.store.invalidateCache(channelId, characterId)
  }

  /**
   * キャラクター選択メニューを追加
   */
  private async addCharacterSelectMenu(
    rows: PaginationRow[],
    messageId: string,
    channelId: string,
    state: PaginatedDiceRoll | null
  ): Promise<void> {
    try {
      this.logger.debug(`[DiceRollPagination] キャラクター選択メニュー生成開始: ${channelId}`)

      // キャッシュから取得
      let characters = this.store.getCharactersFromCache(channelId)
      if (!characters) {
        characters = await this.characterProvider.findCharactersByChannelId(channelId)
        this.store.saveCharactersToCache(channelId, characters)
      }

      // キャラクターが見つからない場合は何も表示しない
      if (characters.length === 0) {
        this.logger.debug('[DiceRollPagination] キャラクター情報なし - 選択メニューをスキップ')
        return
      }

      const selectRow = buildCharacterSelectRow(messageId, channelId, characters, state?.characterId)
      if (selectRow) {
        rows.push(selectRow)
      }

      this.logger.debug(`[DiceRollPagination] キャラクター選択メニュー生成完了: ${characters.length}件`)
    } catch (error) {
      this.logger.error('[DiceRollPagination] キャラクター選択メニュー作成エラー:', error)
      // エラーをスローしない - ボタンだけでも表示できるようにする
    }
  }

  /**
   * ページネーション状態を保存
   */
  savePaginationState(channelId: string, messageId: string, state: PaginatedDiceRoll): void {
    this.store.savePaginationState(channelId, messageId, state)
  }

  /**
   * ページネーション状態を取得
   */
  getPaginationState(channelId: string, messageId: string): PaginatedDiceRoll | null {
    return this.store.getPaginationState(channelId, messageId)
  }

  /**
   * ページを更新
   */
  updatePage(channelId: string, messageId: string, direction: 'prev' | 'next' | 'first' | 'last'): EmbedBuilder | null {
    const state = this.store.getPaginationState(channelId, messageId)
    if (!state) return null

    const newPage = computeNewPage(state.currentPage, state.totalPages, direction)
    if (newPage === state.currentPage) return null

    state.currentPage = newPage
    this.store.savePaginationState(channelId, messageId, state)

    return state.pages[newPage - 1] || null
  }

  /**
   * 指定されたページにジャンプ
   */
  jumpToPage(channelId: string, messageId: string, pageNumber: number): EmbedBuilder | null {
    const state = this.store.getPaginationState(channelId, messageId)
    if (!state) return null

    const newPage = clampPage(pageNumber, state.totalPages)
    if (newPage === state.currentPage) return null

    state.currentPage = newPage
    this.store.savePaginationState(channelId, messageId, state)

    return state.pages[newPage - 1] || null
  }

  /**
   * ページネーションをキャンセル
   */
  cancelPagination(channelId: string, messageId: string): boolean {
    return this.store.deletePaginationState(channelId, messageId)
  }

  /**
   * キャラクター選択を更新
   */
  async updateCharacter(channelId: string, messageId: string, characterId: string): Promise<PaginatedDiceRoll | null> {
    try {
      // 新しいページを生成
      const pages = await this.createPaginatedEmbeds(channelId, characterId)
      if (!pages || pages.length === 0) return null

      // 新しい状態を作成
      const newState: PaginatedDiceRoll = {
        pages,
        totalPages: pages.length,
        currentPage: 1,
        characterId,
        messageId
      }

      // 状態を保存
      this.store.savePaginationState(channelId, messageId, newState)

      this.logger.debug(`[PHASE3] キャラクター選択更新完了: ${characterId} (${pages.length}ページ)`)
      return newState
    } catch (error) {
      this.logger.error('[PHASE3] キャラクター選択更新エラー:', error)
      return null
    }
  }
}

/**
 * ログ表示用にキャラクター名のみを解決する（タイトル文字列は付けない）。
 */
function resolveTitleCharacterName(characterId: string, characters: CharacterEntity[] | null): string {
  const character = characters?.find((c) => c.characterId === characterId)
  return character?.characterName || characterId
}
