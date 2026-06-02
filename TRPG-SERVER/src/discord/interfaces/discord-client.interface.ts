import { Client } from 'discord.js'

/**
 * Discordクライアントインターフェース
 * テスト容易性のために抽象化したインターフェース
 */
export interface DiscordClientInterface {
  /**
   * Discordクライアントを取得する
   * @returns Discordクライアント
   */
  getClient(): Client

  /**
   * クライアントの初期化を行う
   */
  initialize(): Promise<void>

  /**
   * イベントハンドラを登録する
   * @param event イベント名
   * @param handler イベントハンドラ
   */

  on(event: string, handler: (...args: any[]) => void): void

  /**
   * 一度だけ実行されるイベントハンドラを登録する
   * @param event イベント名
   * @param handler イベントハンドラ
   */

  once(event: string, handler: (...args: any[]) => void): void
}
