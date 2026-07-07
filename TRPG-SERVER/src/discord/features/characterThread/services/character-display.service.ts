/**
 * Character Display Service
 *
 * キャラクター情報表示の統合サービス
 * character-tab-buttons.serviceの機能とDiscordEmbedHandlerServiceを統合
 * features/内でのEmbed生成・更新ロジック一元化
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EmbedBuilder, TextChannel, NewsChannel, ThreadChannel } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { CharacterService } from '../../../../domains/character/character.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ErrorHandler, ErrorContext } from '../../../../core/http/error-handler'
import { EventPayload, EVENT_NAMES } from '../../../../events/contracts'

/**
 * タブ表示タイプ
 */
export type TabType = 'basic' | 'status' | 'skills' | 'items' | 'desc'

/**
 * キャラクター表示サービス
 *
 * 各種タブでのキャラクター情報表示とEmbed更新を統合管理
 * DiscordEmbedHandlerServiceの機能を統合
 */
@Injectable()
export class CharacterDisplayService implements OnModuleInit {
  private readonly logger = new Logger(CharacterDisplayService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly characterService: CharacterService
  ) {}

  /**
   * モジュール初期化時にイベントハンドラーを登録
   * DiscordEmbedHandlerServiceから統合
   */
  async onModuleInit(): Promise<void> {
    this.registerEmbedEventHandlers()
    this.logger.log('Character Display Service initialized with Embed handlers')
  }

  /**
   * Embed関連イベントハンドラーを登録（character-thread専用）
   */
  private registerEmbedEventHandlers(): void {
    // character-thread専用のキャラクター表示リクエストハンドラー
    this.typedEventService.on(
      EVENT_NAMES.DISCORD_CHARACTER_DISPLAY_REQUESTED,
      this.handleCharacterDisplayRequest.bind(this)
    )

    this.logger.debug('Character thread display event handlers registered')
  }

  /**
   * チャンネルIDからキャラクターを検索し、指定タブのEmbedを作成
   */
  async createCharacterEmbed(channelId: string, tabType: TabType = 'basic'): Promise<EmbedBuilder | null> {
    try {
      this.logger.log(`Creating character embed: channelId=${channelId}, tabType=${tabType}`)

      // 同一プロセス内クエリのため CharacterService を直接呼び出す（E-2a: イベント RPC 廃止）
      const character = await this.characterService.findByChannelId(channelId)

      if (character) {
        return this.buildCharacterEmbed(character, tabType)
      }

      this.logger.warn(`Character not found for channelId: ${channelId}`)
      return null
    } catch (error) {
      this.logger.error(`Character embed creation failed for channelId: ${channelId}`, error)

      const context: ErrorContext = {
        channelId,
        action: 'character-display'
      }

      ErrorHandler.handleServiceError(error, context, 'CharacterDisplayService')
      return null
    }
  }

  /**
   * キャラクター情報からEmbedを構築
   */
  private buildCharacterEmbed(character: Character, tabType: TabType): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${character.characterName} - ${this.getTabTitle(tabType)}`)
      .setColor(0x00ae86)
      .setTimestamp()

    // 基本情報は常に表示
    if (character.gameSystemId) {
      embed.addFields({
        name: 'ゲームシステム',
        value: character.gameSystemId,
        inline: true
      })
    }

    embed.addFields({
      name: 'キャラクターID',
      value: character.characterId,
      inline: true
    })

    // タブ別の情報を追加
    switch (tabType) {
      case 'basic':
        // 基本情報は既に設定済み
        break

      case 'status':
        this.addCharacterData(embed, character.parameter, 'ステータス')
        break

      case 'skills':
        this.addCharacterData(embed, character.skill, 'スキル')
        break

      case 'items':
        this.addCharacterData(embed, character.item, 'アイテム')
        break

      case 'desc':
        this.addDescription(embed, character.description)
        break

      default:
        // デフォルトは基本情報
        break
    }

    return embed
  }

  /**
   * キャラクターデータをEmbedに追加
   */
  private addCharacterData(embed: EmbedBuilder, data: Record<string, any> | undefined, title: string): void {
    if (!data || Object.keys(data).length === 0) {
      embed.addFields({ name: title, value: '情報なし', inline: false })
      return
    }

    const fields = Object.entries(data)
      .map(([key, value]) => {
        if (value && typeof value === 'object' && 'name' in value && 'value' in value) {
          return { name: value.name, value: String(value.value), inline: true }
        }
        return { name: key, value: String(value), inline: true }
      })
      .filter((field) => field.value && field.value !== 'undefined')
      .slice(0, 10) // Discord Embed field制限を考慮

    if (fields.length > 0) {
      embed.addFields(...fields)
    } else {
      embed.addFields({ name: title, value: '情報なし', inline: false })
    }
  }

  /**
   * 詳細説明をEmbedに追加
   */
  private addDescription(embed: EmbedBuilder, description: Record<string, unknown> | undefined): void {
    if (!description || typeof description !== 'object') {
      embed.setDescription('詳細情報はありません。')
      return
    }

    const descText = Object.values(description)
      .map((d: any) => {
        if (d && typeof d === 'object' && 'value' in d) {
          return d.value
        }
        return String(d)
      })
      .filter((text) => text && text !== 'undefined')
      .join('\\n')

    if (descText && descText.length > 0) {
      // Discord description limit (2000文字)
      embed.setDescription(descText.substring(0, 2000))
    } else {
      embed.setDescription('詳細情報はありません。')
    }
  }

  /**
   * タブタイトルを取得
   */
  private getTabTitle(tabType: TabType): string {
    const titles: Record<TabType, string> = {
      basic: '基本情報',
      status: 'ステータス',
      skills: 'スキル',
      items: 'アイテム',
      desc: '詳細'
    }

    return titles[tabType] || '基本情報'
  }

  /**
   * タブタイプの妥当性をチェック
   */
  isValidTabType(tabType: string): tabType is TabType {
    return ['basic', 'status', 'skills', 'items', 'desc'].includes(tabType)
  }

  // ============================================================================
  // Character Thread 専用機能
  // ============================================================================

  /**
   * キャラクター表示リクエストを処理（character-thread専用）
   *
   * E-3d: dead な embed 更新通知 emit（恒常購読者ゼロ）を撤去済み。embed 構築のみ行い
   * 聞くだけで何もしないゴースト（購読・メソッドの解体は E-5/E-6 スコープ）。
   */
  private async handleCharacterDisplayRequest(
    payload: EventPayload<'discord.character.display.requested'>
  ): Promise<void> {
    const { character, source } = payload

    this.logger.log(`[CHARACTER-THREAD-DISPLAY] Character display requested: ${character.characterId} from ${source}`)

    try {
      // character-thread専用の基本的なEmbed表示のみ
      this.buildCharacterEmbed(character, 'basic')

      this.logger.log(`[CHARACTER-THREAD-DISPLAY] Character display completed for ${character.characterId}`)
    } catch (error) {
      this.logger.error(`[CHARACTER-THREAD-DISPLAY] Character display failed for ${character.characterId}`, error)
    }
  }

  /**
   * Embed更新の直接実行
   * features/内の他のサービスから使用
   *
   * E-3d: dead な embed 更新通知 emit（恒常購読者ゼロ）を撤去済み。embed 構築のみ行い何もしないゴースト。
   */
  async updateCharacterEmbed(character: Character, channelId: string, tabType: TabType = 'basic'): Promise<void> {
    try {
      this.logger.log(`[CHARACTER-EMBED] Direct embed update: ${character.characterId} (channel: ${channelId})`)

      this.buildCharacterEmbed(character, tabType)
    } catch (error) {
      this.logger.error(`[CHARACTER-EMBED] Direct embed update failed`, error)
      throw error
    }
  }

  /**
   * チャンネルの既存Embedメッセージを検索
   * DiscordEmbedHandlerServiceから統合（簡略化）
   */
  async findExistingCharacterEmbed(
    channel: TextChannel | NewsChannel | ThreadChannel,
    characterId: string
  ): Promise<any> {
    try {
      // 最新100件のメッセージを検索
      const messages = await channel.messages.fetch({ limit: 100 })

      for (const message of messages.values()) {
        if (message.embeds.length > 0) {
          // Embedにキャラクター情報が含まれているかチェック
          const embed = message.embeds[0]
          if (embed.fields?.some((field) => field.name === 'キャラクターID' && field.value === characterId)) {
            return message
          }
        }
      }

      return null
    } catch (error) {
      this.logger.error(`[CHARACTER-EMBED] Failed to find existing embed`, error)
      return null
    }
  }
}
