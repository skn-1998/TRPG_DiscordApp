import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { AppConfigService } from 'src/config/config.service'

import { Client, GatewayIntentBits, Events, ClientOptions } from 'discord.js'
import { DiscordClientInterface } from '../interfaces/discord-client.interface'

/**
 * Discordクライアントサービス
 * Discordとの接続・通信を管理
 */
@Injectable()
export class DiscordClientService implements DiscordClientInterface {
  private readonly logger = new Logger(DiscordClientService.name)
  private readonly client: Client
  private initialized = false

  constructor(private readonly configService: AppConfigService) {
    const clientOptions: ClientOptions = {
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
      ]
    }

    this.client = new Client(clientOptions)
  }

  /**
   * モジュール初期化後に明示的に呼び出す必要があります
   * Webサーバーの起動を妨げないよう、OnModuleInitから切り離しました
   */
  async initializeClient(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.logger.log('Discordクライアントを初期化しています...')

    try {
      await this.initialize()
      this.initialized = true
      this.logger.log('Discordクライアントの初期化が完了しました')
    } catch (error) {
      this.logger.error('Discordクライアントの初期化に失敗しました')
      if (error instanceof Error) {
        this.logger.error(error.message)
      }
      throw error
    }
  }

  /**
   * クライアントを取得する
   * @returns Discordクライアント
   */
  getClient(): Client {
    return this.client
  }

  /**
   * クライアントを初期化する
   */
  async initialize(): Promise<void> {
    // クライアント準備完了時のイベントハンドラを登録
    this.client.once(Events.ClientReady, (readyClient) => {
      this.logger.log(`DiscordBOTが起動しました: ${readyClient.user.tag}`)

      // 起動したことをログに記録
      this.logger.log('DiscordBOTがチャンネル作成イベントをリッスンしています...')
    })

    // チャンネル作成イベントを直接登録（セットアップのデバッグ用）
    this.client.on(Events.ChannelCreate, (channel) => {
      this.logger.log(`新しいチャンネルが作成されました: ${channel.name} (ID: ${channel.id})`)
    })

    // トークンを使用してログイン
    const token = this.configService.get('discord.token')

    if (!token) {
      throw new Error('Discord BOTトークンが設定されていません')
    }

    await this.client.login(token)
  }

  /**
   * イベントハンドラを登録する
   * @param event イベント名
   * @param handler イベントハンドラ
   */

  on(event: string, handler: (...args: any[]) => void): void {
    this.client.on(event, handler)
  }

  /**
   * 一度だけ実行されるイベントハンドラを登録する
   * @param event イベント名
   * @param handler イベントハンドラ
   */

  once(event: string, handler: (...args: any[]) => void): void {
    this.client.once(event, handler)
  }
}
