import { Injectable, Inject, forwardRef } from '@nestjs/common'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  APISelectMenuOption
} from 'discord.js'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { Character } from 'src/domains/character/models/character.model'
import { DiceRollText } from 'src/domains/dice-roll/models/dice-roll-text.model'

// ページネーションの状態を保持するためのインターフェース
export interface PaginatedDiceRoll {
  pages: EmbedBuilder[] // 各ページのEmbed
  totalPages: number // 総ページ数
  currentPage: number // 現在のページ
  characterId?: string // 表示中のキャラクターID（指定時）
  messageId?: string // 関連するDiscordメッセージID
}

// 内部的な状態管理用のインターフェース
interface DiceRollPaginationState {
  [channelId: string]: {
    [messageId: string]: PaginatedDiceRoll
  }
}

@Injectable()
export class DiceRollPaginationService {
  // ページネーション状態を保持するインメモリストア
  private paginationState: DiceRollPaginationState = {}

  // ページのキャッシュ (キャラクターID別)
  private pageCache: {
    [channelId: string]: {
      [characterId: string]: {
        pages: EmbedBuilder[]
        timestamp: number
      }
    }
  } = {}

  // キャラクター情報のキャッシュ（チャンネルID別）
  private characterCache: {
    [channelId: string]: {
      characters: Character[]
      timestamp: number
    }
  } = {}

  // キャッシュの有効期限 (ミリ秒)
  private readonly CACHE_TTL = 5000 // 5秒（ダイスロール間隔に合わせて短く設定）
  private readonly CHARACTER_CACHE_TTL = 60000 // 1分（キャラクター情報は頻繁に変わらない）

  constructor(private readonly diceRollService: DiceRollService) {}

  /**
   * ダイスロール結果をページネーション形式のEmbedに変換
   */
  async createPaginatedEmbeds(channelId: string, characterId?: string): Promise<EmbedBuilder[]> {
    try {
      // キャッシュから取得
      const cachedPages = this.getFromCache(channelId, characterId || 'all')
      if (cachedPages) {
        console.log(`[PHASE3] キャッシュから取得: ${characterId || 'all'} in ${channelId}`)
        return cachedPages
      }

      // ダイスロールデータを取得
      const diceRolls = await this.diceRollService.findTextsByChannelId(channelId)
      if (!diceRolls || diceRolls.length === 0) {
        console.log(`[PHASE3] ダイスロールデータが見つかりません: ${channelId}`)
        return this.createEmptyEmbed(characterId)
      }

      // キャラクターIDが指定されている場合、フィルタリング
      let filteredRolls = diceRolls
      if (characterId && characterId !== 'all') {
        filteredRolls = diceRolls.filter((roll: DiceRollText) => roll.characterId === characterId)
      }

      // 日時順でソート（新しい順）
      const sortedRolls = filteredRolls.sort((a: DiceRollText, b: DiceRollText) => {
        const timeA = a.createdAt || new Date(0)
        const timeB = b.createdAt || new Date(0)
        return new Date(timeB).getTime() - new Date(timeA).getTime()
      })

      // 最新500件に制限
      const limitedRolls = sortedRolls.slice(0, 500)

      // Embedページを作成
      const pages: EmbedBuilder[] = []
      let currentPage = new EmbedBuilder().setTitle('ダイスロール履歴').setColor('#0099ff')

      let currentLength = 0
      const pageLimit = 500 // Embedの安全上限より少なめに設定

      // キャラクター名を取得してタイトルに追加（特定キャラクターの場合）
      // 【PHASE3】 一時的にキャラクター名取得をスキップ
      if (characterId && characterId !== 'all') {
        console.log(`[PHASE3] キャラクター指定: ${characterId}`)
        currentPage.setTitle(`キャラクター(${characterId})のダイスロール`)
      }

      // ロール履歴がない場合
      if (limitedRolls.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle(
            characterId && characterId !== 'all' ? `キャラクター(${characterId})のダイスロール` : 'ダイスロール履歴'
          )
          .setColor('#ff6b6b')
          .setDescription('ダイスロール履歴がありません。')
          .setTimestamp()
        return [emptyEmbed]
      }

      // 各ダイスロールを処理
      for (const roll of limitedRolls) {
        try {
          // ダイスロール結果の文字列を生成
          const rollText = this.formatDiceRoll(roll)

          // 追加後の長さを計算
          const newLength = currentLength + rollText.length

          // ページ制限を超える場合は新しいページを作成
          if (newLength > pageLimit && currentPage.data.description) {
            pages.push(currentPage)
            currentPage = new EmbedBuilder()
              .setTitle(
                characterId && characterId !== 'all' ? `キャラクター(${characterId})のダイスロール` : 'ダイスロール履歴'
              )
              .setColor('#0099ff')
            currentLength = 0
          }

          // 現在のページに追加
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

      // 空の場合は空のEmbedを返す
      if (pages.length === 0) {
        return this.createEmptyEmbed(characterId)
      }

      // フッターを設定
      const pagesWithFooter = this.setPageFooters(pages)

      // キャッシュに保存
      this.saveToCache(channelId, characterId || 'all', pagesWithFooter)

      console.log(`[PHASE3] ${pagesWithFooter.length}ページ生成完了: ${characterId || 'all'} in ${channelId}`)
      return pagesWithFooter
    } catch (error) {
      console.error('[PHASE3] ページネーション生成エラー:', error)
      return this.createEmptyEmbed(characterId)
    }
  }

  /**
   * 空のEmbedを作成
   */
  private createEmptyEmbed(characterId?: string): EmbedBuilder[] {
    const emptyEmbed = new EmbedBuilder()
      .setTitle(
        characterId && characterId !== 'all' ? `キャラクター(${characterId})のダイスロール` : 'ダイスロール履歴'
      )
      .setColor('#ff6b6b')
      .setDescription('ダイスロール履歴がありません。')
      .setTimestamp()
    return [emptyEmbed]
  }

  /**
   * ダイスロール結果を表示形式にフォーマット
   */
  private formatDiceRoll(roll: DiceRollText): string {
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
   * 各ページにフッターを設定
   */
  private setPageFooters(pages: EmbedBuilder[]): EmbedBuilder[] {
    return pages.map((page, index) => {
      return page.setFooter({
        text: `ページ ${index + 1}/${pages.length}`,
        iconURL: undefined
      })
    })
  }

  /**
   * ページネーション用のボタンコントロールを作成
   */
  async createPaginationControls(
    messageId: string,
    channelId: string,
    totalPages: number
  ): Promise<(ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[]> {
    const rows: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] = []

    // ページ数が1以下の場合は何も表示しない
    if (totalPages <= 1) {
      return rows
    }

    // 現在の状態を取得
    const state = this.getPaginationState(channelId, messageId)

    // ページ移動ボタンを作成
    const pageButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`dice-page-first*${messageId}*${channelId}`)
        .setLabel('最初')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(state?.currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`dice-page-prev*${messageId}*${channelId}`)
        .setLabel('前')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state?.currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`dice-page-next*${messageId}*${channelId}`)
        .setLabel('次')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(state?.currentPage === totalPages),
      new ButtonBuilder()
        .setCustomId(`dice-page-last*${messageId}*${channelId}`)
        .setLabel('最後')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(state?.currentPage === totalPages),
      new ButtonBuilder()
        .setCustomId(`dice-page-cancel*${messageId}*${channelId}`)
        .setLabel('閉じる')
        .setStyle(ButtonStyle.Danger)
    )

    rows.push(pageButtons)

    // ページ数が多い場合はページ選択メニューを追加
    if (totalPages > 3) {
      await this.addPageSelectMenu(rows, messageId, channelId, state?.currentPage || 1, totalPages)
    }

    // キャラクター選択メニューを追加
    await this.addCharacterSelectMenu(rows, messageId, channelId, state)

    return rows
  }

  /**
   * ページ選択メニューを追加
   */
  private async addPageSelectMenu(
    rows: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[],
    messageId: string,
    channelId: string,
    currentPage: number,
    totalPages: number
  ): Promise<void> {
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
        .setCustomId(`dice-page-select*${messageId}*${channelId}`)
        .setPlaceholder('ページを選択')
        .addOptions(pageOptions)

      const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(pageSelectMenu)
      rows.push(selectRow)
    } catch (error) {
      console.error('[PHASE3] ページ選択メニュー作成エラー:', error)
    }
  }

  /**
   * キャッシュから取得
   */
  private getFromCache(channelId: string, characterId: string): EmbedBuilder[] | null {
    const channelCache = this.pageCache[channelId]
    if (!channelCache) return null

    const cached = channelCache[characterId]
    if (!cached) return null

    // キャッシュの有効期限チェック
    const now = Date.now()
    if (now - cached.timestamp > this.CACHE_TTL) {
      delete channelCache[characterId]
      return null
    }

    return cached.pages
  }

  /**
   * キャッシュに保存
   */
  private saveToCache(channelId: string, characterId: string, pages: EmbedBuilder[]): void {
    if (!this.pageCache[channelId]) {
      this.pageCache[channelId] = {}
    }

    this.pageCache[channelId][characterId] = {
      pages,
      timestamp: Date.now()
    }
  }

  /**
   * キャッシュを無効化
   */
  invalidateCache(channelId: string, characterId?: string): void {
    if (!this.pageCache[channelId]) return

    if (characterId) {
      delete this.pageCache[channelId][characterId]
    } else {
      delete this.pageCache[channelId]
    }

    // キャラクター情報キャッシュも無効化
    if (this.characterCache[channelId]) {
      delete this.characterCache[channelId]
    }
  }

  /**
   * キャラクター選択メニューを追加
   */
  private async addCharacterSelectMenu(
    rows: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[],
    messageId: string,
    channelId: string,
    state: PaginatedDiceRoll | null
  ): Promise<void> {
    try {
      // 【PHASE3】 キャラクター選択メニューを一時的に無効化
      console.log('[PHASE3] キャラクター選択メニューは一時的に無効化されています')
      return
    } catch (error) {
      console.error('[PHASE3] キャラクター選択メニュー作成エラー:', error)
      // エラーをスローしない - ボタンだけでも表示できるようにする
    }
  }

  /**
   * キャラクター情報をキャッシュから取得
   */
  private getCharactersFromCache(channelId: string): Character[] | null {
    const cached = this.characterCache[channelId]
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.CHARACTER_CACHE_TTL) {
      delete this.characterCache[channelId]
      return null
    }

    return cached.characters
  }

  /**
   * キャラクター情報を取得してキャッシュに保存
   */
  private async fetchCharacters(channelId: string): Promise<Character[]> {
    try {
      // 【PHASE3】 キャラクター情報取得を一時的に無効化
      console.log('[PHASE3] キャラクター情報取得は一時的に無効化されています')
      return []
    } catch (error) {
      console.error('[PHASE3] キャラクター情報取得エラー:', error)
      return []
    }
  }

  /**
   * ページネーション状態を保存
   */
  savePaginationState(channelId: string, messageId: string, state: PaginatedDiceRoll): void {
    if (!this.paginationState[channelId]) {
      this.paginationState[channelId] = {}
    }
    this.paginationState[channelId][messageId] = state
  }

  /**
   * ページネーション状態を取得
   */
  getPaginationState(channelId: string, messageId: string): PaginatedDiceRoll | null {
    return this.paginationState[channelId]?.[messageId] || null
  }

  /**
   * ページを更新
   */
  updatePage(channelId: string, messageId: string, direction: 'prev' | 'next' | 'first' | 'last'): EmbedBuilder | null {
    const state = this.getPaginationState(channelId, messageId)
    if (!state) return null

    let newPage = state.currentPage
    switch (direction) {
      case 'prev':
        newPage = Math.max(1, state.currentPage - 1)
        break
      case 'next':
        newPage = Math.min(state.totalPages, state.currentPage + 1)
        break
      case 'first':
        newPage = 1
        break
      case 'last':
        newPage = state.totalPages
        break
    }

    if (newPage === state.currentPage) return null

    state.currentPage = newPage
    this.savePaginationState(channelId, messageId, state)

    return state.pages[newPage - 1] || null
  }

  /**
   * 指定されたページにジャンプ
   */
  jumpToPage(channelId: string, messageId: string, pageNumber: number): EmbedBuilder | null {
    const state = this.getPaginationState(channelId, messageId)
    if (!state) return null

    const newPage = Math.max(1, Math.min(state.totalPages, pageNumber))
    if (newPage === state.currentPage) return null

    state.currentPage = newPage
    this.savePaginationState(channelId, messageId, state)

    return state.pages[newPage - 1] || null
  }

  /**
   * ページネーションをキャンセル
   */
  cancelPagination(channelId: string, messageId: string): boolean {
    if (!this.paginationState[channelId]) return false

    delete this.paginationState[channelId][messageId]

    // チャンネル全体の状態が空になったら削除
    if (Object.keys(this.paginationState[channelId]).length === 0) {
      delete this.paginationState[channelId]
    }

    return true
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
      this.savePaginationState(channelId, messageId, newState)

      console.log(`[PHASE3] キャラクター選択更新完了: ${characterId} (${pages.length}ページ)`)
      return newState
    } catch (error) {
      console.error('[PHASE3] キャラクター選択更新エラー:', error)
      return null
    }
  }
}
