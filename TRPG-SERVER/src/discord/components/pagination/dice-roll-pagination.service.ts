import { Injectable } from '@nestjs/common'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { CharacterService } from 'src/domains/character/character.service'
import { Character } from 'src/domains/character/models/character.model'

// ページネーションの状態を保持するためのインターフェース
export interface PaginatedDiceRoll {
  pages: EmbedBuilder[] // 各ページのEmbed
  totalPages: number // 総ページ数
  currentPage: number // 現在のページ
  characterId?: string // 表示中のキャラクターID（指定時）
  messageId?: string // 関連するDiscordメッセージID
}

// チャンネルごとのページネーション状態を保持
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

  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly characterService: CharacterService
  ) {}

  /**
   * ダイスロール結果をページに分割してEmbedを作成
   * @param channelId Discordチャンネル
   * @param characterId キャラクターID（オプション）
   */
  async createPaginatedEmbeds(channelId: string, characterId?: string): Promise<EmbedBuilder[]> {
    try {
      const startTime = Date.now()
      console.log(`[Performance] ページネーション処理開始: channelId=${channelId}`)

      const cacheKey = characterId || 'all'

      // キャッシュをチェック（再有効化）
      if (this.pageCache[channelId]?.[cacheKey]) {
        const cache = this.pageCache[channelId][cacheKey]
        const now = Date.now()
        const age = now - cache.timestamp

        // キャッシュが有効期限内なら使用
        if (age < this.CACHE_TTL) {
          const cacheHitTime = Date.now() - startTime
          console.log(
            `キャッシュを使用: channelId=${channelId}, cacheKey=${cacheKey}, age=${age}ms, 取得時間=${cacheHitTime}ms`
          )
          return cache.pages
        } else {
          console.log(`キャッシュ期限切れ: channelId=${channelId}, cacheKey=${cacheKey}, age=${age}ms`)
        }
      } else {
        console.log(`キャッシュ未使用: channelId=${channelId}, cacheKey=${cacheKey}`)
      }

      // DB問い合わせ開始時間
      const dbQueryStartTime = Date.now()

      // ダイスロール履歴を取得（全部または特定キャラクター）
      const diceRolls = await this.diceRollService.findTextsByChannelId(channelId)

      // DB問い合わせ終了時間
      const dbQueryEndTime = Date.now()
      const dbQueryDuration = dbQueryEndTime - dbQueryStartTime
      console.log(
        `[Performance] DB問い合わせ完了: channelId=${channelId}, 件数=${diceRolls.length}, 所要時間=${dbQueryDuration}ms`
      )

      // フィルタリング開始時間
      const filterStartTime = Date.now()

      const characterRolls = characterId
        ? diceRolls.filter((diceRollText) => diceRollText.characterId === characterId)
        : diceRolls

      // 最新の100件に制限して処理を軽量化
      const limitedRolls = characterRolls
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 100)

      const filterEndTime = Date.now()
      const filterDuration = filterEndTime - filterStartTime
      console.log(
        `[Performance] データフィルタリング完了: フィルタ前=${diceRolls.length}件, フィルタ後=${limitedRolls.length}件, 所要時間=${filterDuration}ms`
      )

      // Embed生成開始時間
      const embedStartTime = Date.now()

      // ページに分割（1ページあたり約1800文字まで）
      const pages: EmbedBuilder[] = []
      let currentPage = new EmbedBuilder().setTitle('ダイスロール履歴').setColor('#0099ff')

      let currentLength = 0
      const pageLimit = 500 // Embedの安全上限より少なめに設定

      // キャラクター名を取得してタイトルに追加（特定キャラクターの場合）
      // characterIdが明示的に指定されていない場合は、全体表示とする
      if (characterId && characterId !== 'all') {
        try {
          const character = await this.characterService.findOne(characterId)
          if (character && character.characterName) {
            currentPage.setTitle(`${character.characterName}のダイスロール`)
          }
        } catch (error) {
          console.error('キャラクター情報取得エラー:', error)
        }
      }

      // ロール履歴がない場合
      if (limitedRolls.length === 0) {
        currentPage.setDescription('ダイスロール履歴がありません')
        pages.push(currentPage)
        const result = this.setPageFooters(pages)

        // Embed生成時間を計測
        const embedEndTime = Date.now()
        const embedDuration = embedEndTime - embedStartTime
        console.log(`[Performance] Embed生成完了: ページ数=${result.length}, 所要時間=${embedDuration}ms`)

        // キャッシュに保存（再有効化）
        this.saveToCache(channelId, cacheKey, result)

        const totalTime = Date.now() - startTime
        console.log(
          `[Performance] ページネーション処理完了: 総所要時間=${totalTime}ms (DB=${dbQueryDuration}ms, フィルタ=${filterDuration}ms, Embed=${embedDuration}ms)`
        )

        return result
      }

      // バッチ処理で効率化（20件ずつ処理）
      const batchSize = 20
      for (let i = 0; i < limitedRolls.length; i += batchSize) {
        const batch = limitedRolls.slice(i, i + batchSize)

        for (const roll of batch) {
          // フォーマットを変更して新しいエントリを上に表示
          const entryText = `${roll.text}\n`

          if (currentLength + entryText.length > pageLimit) {
            // 現在のページを確定し、新しいページを作成
            pages.push(currentPage)

            // 新しいページは前のページと同じタイトルを維持
            currentPage = new EmbedBuilder().setTitle(currentPage.data.title).setColor('#0099ff')

            currentLength = 0
          }

          // 項目を追加（既存のテキストの前に新しいエントリを追加）
          const currentDescription = currentPage.data.description || ''
          currentPage.setDescription(entryText + currentDescription)
          currentLength += entryText.length
        }
      }

      // 最後のページを追加
      if (currentLength > 0) {
        pages.push(currentPage)
      }

      const result = this.setPageFooters(pages)

      const embedEndTime = Date.now()
      const embedDuration = embedEndTime - embedStartTime
      console.log(`[Performance] Embed生成完了: ページ数=${result.length}, 所要時間=${embedDuration}ms`)

      // キャッシュに保存（再有効化）
      this.saveToCache(channelId, cacheKey, result)

      const totalTime = Date.now() - startTime
      console.log(
        `[Performance] ページネーション処理完了: 総所要時間=${totalTime}ms (DB=${dbQueryDuration}ms, フィルタ=${filterDuration}ms, Embed=${embedDuration}ms)`
      )

      return result
    } catch (error) {
      console.error('ページ生成エラー:', error)
      // エラー時は空のページを返す
      const errorPage = new EmbedBuilder()
        .setTitle('ダイスロール履歴')
        .setDescription('履歴の読み込み中にエラーが発生しました')
        .setColor('#ff0000')
      return [errorPage]
    }
  }

  /**
   * 各ページにフッターを設定する
   */
  private setPageFooters(pages: EmbedBuilder[]): EmbedBuilder[] {
    pages.forEach((page, index) => {
      page.setFooter({
        text: `Page ${index + 1}/${pages.length}`
      })
    })
    return pages
  }

  /**
   * ページネーションボタンとセレクトメニューを作成
   */
  async createPaginationControls(
    messageId: string,
    channelId: string,
    totalPages: number
  ): Promise<(ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[]> {
    // ページネーション状態を取得
    const state = this.getPaginationState(channelId, messageId)
    const currentPage = state ? state.currentPage : 0

    // 結果を返すコントロール配列
    const rows: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[] = []

    // 総ページ数が0の場合でも最低限のコントロールは作成
    const effectiveTotalPages = Math.max(1, totalPages)

    // ナビゲーションボタン
    const prevButton = new ButtonBuilder()
      .setCustomId(`dice-prev*${messageId}*${channelId}`)
      .setLabel('◀ 前へ')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage <= 0 || effectiveTotalPages <= 1)

    const nextButton = new ButtonBuilder()
      .setCustomId(`dice-next*${messageId}*${channelId}`)
      .setLabel('次へ ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currentPage >= effectiveTotalPages - 1 || effectiveTotalPages <= 1)

    // 現在のページ/総ページ数を表示するボタン（クリックできないスタイル）
    const pageInfoButton = new ButtonBuilder()
      .setCustomId(`dice-page-info*${messageId}*${channelId}`)
      .setLabel(`${currentPage + 1} / ${effectiveTotalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true)

    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageInfoButton, nextButton)

    // ボタン行を追加
    rows.push(buttonRow)

    try {
      // キャラクター選択メニュー生成
      await this.addCharacterSelectMenu(rows, messageId, channelId, state)
    } catch (error) {
      console.error('キャラクター選択メニュー作成エラー:', error)
      // エラーが発生しても少なくともボタンは表示する
    }

    // 最低でもボタン行が含まれているはず
    return rows
  }

  /**
   * ページのキャッシュを保存
   */
  private saveToCache(channelId: string, characterId: string, pages: EmbedBuilder[]): void {
    if (!this.pageCache[channelId]) {
      this.pageCache[channelId] = {}
    }

    this.pageCache[channelId][characterId] = {
      pages: pages,
      timestamp: Date.now()
    }

    console.log(`キャッシュを保存: channelId=${channelId}, characterId=${characterId}, ページ数=${pages.length}`)
  }

  /**
   * キャッシュを無効化
   */
  invalidateCache(channelId: string, characterId?: string): void {
    if (characterId) {
      // 特定のキャラクターのキャッシュのみ削除
      if (this.pageCache[channelId]) {
        delete this.pageCache[channelId][characterId]
        delete this.pageCache[channelId]['all'] // 全体表示も更新が必要
        console.log(`特定キャラクターのキャッシュを無効化: channelId=${channelId}, characterId=${characterId}`)
      }
    } else {
      // チャンネル全体のキャッシュを削除
      delete this.pageCache[channelId]
      console.log(`チャンネル全体のキャッシュを無効化: channelId=${channelId}`)
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
      // キャッシュからキャラクター情報を取得
      let characters = this.getCharactersFromCache(channelId)

      // キャッシュにデータがない場合は新しく取得
      if (!characters) {
        characters = await this.fetchCharacters(channelId)

        // 取得できなかったらここで処理終了
        if (!characters || characters.length === 0) {
          return
        }
      }

      // セレクトメニューのオプションを作成
      const characterOptions = []

      // 全表示オプション - state.characterIdがundefinedまたはnullの場合デフォルトを全表示に
      characterOptions.push({
        label: '全てのキャラクター',
        value: 'all',
        description: '全キャラクターのロール履歴を表示',
        default: state?.characterId === undefined || state?.characterId === null
      })

      // 各キャラクターのオプション
      for (const character of characters) {
        if (character && character.characterId && character.characterName) {
          characterOptions.push({
            label: character.characterName || 'Unknown',
            value: character.characterId,
            description: `${character.characterName}`,
            default: state?.characterId === character.characterId
          })
        }
      }

      // 選択肢があればセレクトメニューを作成
      if (characterOptions.length > 1) {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId(`dice-char-select*${messageId}*${channelId}`)
          .setPlaceholder('キャラクターを選択')
          .addOptions(characterOptions)

        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

        rows.push(selectRow)
      }
    } catch (error) {
      console.error('キャラクター選択メニュー作成エラー:', error)
      // エラーをスローしない - ボタンだけでも表示できるようにする
    }
  }

  /**
   * キャッシュからキャラクター情報を取得
   */
  private getCharactersFromCache(channelId: string): Character[] | null {
    const cache = this.characterCache[channelId]
    if (cache && Date.now() - cache.timestamp < this.CHARACTER_CACHE_TTL) {
      return cache.characters
    }
    return null
  }

  /**
   * キャラクター情報を取得してキャッシュに保存
   */
  private async fetchCharacters(channelId: string): Promise<Character[]> {
    try {
      // チャンネルに関連するキャラクターを取得
      const diceRollChannel = await this.diceRollService.findChannelByChannelId(channelId)
      if (!diceRollChannel || !diceRollChannel.characterIds || diceRollChannel.characterIds.length === 0) {
        return []
      }

      // 全てのキャラクターを先に取得
      const characters: Character[] = []
      for (const charId of diceRollChannel.characterIds) {
        try {
          const character = await this.characterService.findOne(charId)
          if (character) {
            characters.push(character)
          }
        } catch (error) {
          console.error(`キャラクター取得エラー (ID: ${charId}):`, error)
        }
      }

      // キャッシュに保存
      if (!this.characterCache[channelId]) {
        this.characterCache[channelId] = { characters: [], timestamp: 0 }
      }

      this.characterCache[channelId] = {
        characters,
        timestamp: Date.now()
      }

      return characters
    } catch (error) {
      console.error('キャラクター情報取得エラー:', error)
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
   * ページを更新（前へ/次へ）
   */
  updatePage(channelId: string, messageId: string, direction: 'prev' | 'next'): EmbedBuilder | null {
    const state = this.getPaginationState(channelId, messageId)
    if (!state) return null

    if (direction === 'prev' && state.currentPage > 0) {
      state.currentPage--
    } else if (direction === 'next' && state.currentPage < state.totalPages - 1) {
      state.currentPage++
    } else {
      return null // 変更なし
    }

    this.savePaginationState(channelId, messageId, state)
    return state.pages[state.currentPage]
  }

  /**
   * キャラクター切り替え時のページ更新
   */
  async updateCharacter(channelId: string, messageId: string, characterId: string): Promise<PaginatedDiceRoll | null> {
    // 'all'の場合は全キャラクター表示
    const targetCharId = characterId === 'all' ? undefined : characterId

    // キャッシュを無効化して最新データを取得
    this.invalidateCache(channelId, targetCharId)

    // 新しいページを生成
    const pages = await this.createPaginatedEmbeds(channelId, targetCharId)

    // 状態を更新
    const newState: PaginatedDiceRoll = {
      pages,
      totalPages: pages.length,
      currentPage: 0,
      characterId: targetCharId,
      messageId
    }

    this.savePaginationState(channelId, messageId, newState)
    return newState
  }
}
