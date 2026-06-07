import { EmbedBuilder } from 'discord.js'
import { Character } from 'src/domains/character/models/character.model'

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

/**
 * ページネーションのインメモリ状態とキャッシュを保持するストア。
 *
 * `DiceRollPaginationService` から状態管理責務を抽出したもの。
 * DI を要さない単純なデータ保持クラスで、TTL に基づく失効のみを行う。
 */
export class DiceRollPaginationStore {
  // キャッシュの有効期限 (ミリ秒)
  private readonly CACHE_TTL = 5000 // 5秒（ダイスロール間隔に合わせて短く設定）
  private readonly CHARACTER_CACHE_TTL = 60000 // 1分（キャラクター情報は頻繁に変わらない）

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

  // --- ページキャッシュ ---

  getPagesFromCache(channelId: string, characterId: string): EmbedBuilder[] | null {
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

  savePagesToCache(channelId: string, characterId: string, pages: EmbedBuilder[]): void {
    if (!this.pageCache[channelId]) {
      this.pageCache[channelId] = {}
    }

    this.pageCache[channelId][characterId] = {
      pages,
      timestamp: Date.now()
    }
  }

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

  // --- キャラクター情報キャッシュ ---

  getCharactersFromCache(channelId: string): Character[] | null {
    const cached = this.characterCache[channelId]
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.CHARACTER_CACHE_TTL) {
      delete this.characterCache[channelId]
      return null
    }

    return cached.characters
  }

  saveCharactersToCache(channelId: string, characters: Character[]): void {
    this.characterCache[channelId] = {
      characters,
      timestamp: Date.now()
    }
  }

  // --- ページネーション状態 ---

  savePaginationState(channelId: string, messageId: string, state: PaginatedDiceRoll): void {
    if (!this.paginationState[channelId]) {
      this.paginationState[channelId] = {}
    }
    this.paginationState[channelId][messageId] = state
  }

  getPaginationState(channelId: string, messageId: string): PaginatedDiceRoll | null {
    return this.paginationState[channelId]?.[messageId] || null
  }

  deletePaginationState(channelId: string, messageId: string): boolean {
    if (!this.paginationState[channelId]) return false

    delete this.paginationState[channelId][messageId]

    // チャンネル全体の状態が空になったら削除
    if (Object.keys(this.paginationState[channelId]).length === 0) {
      delete this.paginationState[channelId]
    }

    return true
  }
}
