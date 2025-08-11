/**
 * Character Display Service
 *
 * キャラクター情報表示の統合サービス
 * character-tab-buttons.serviceの機能とDiscordEmbedHandlerServiceを統合
 * features/内でのEmbed生成・更新ロジック一元化
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { EmbedBuilder, Client, TextChannel, NewsChannel, ThreadChannel } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { ErrorHandler, ErrorContext } from '../../../../utils/error-handler'
import { EventPayload } from '../../../../shared/domain/events/event-contracts'

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

  constructor(private readonly typedEventService: TypedEventService) {}

  /**
   * モジュール初期化時にイベントハンドラーを登録
   * DiscordEmbedHandlerServiceから統合
   */
  async onModuleInit(): Promise<void> {
    this.registerEmbedEventHandlers()
    this.logger.log('Character Display Service initialized with Embed handlers')
  }

  /**
   * Embed関連イベントハンドラーを登録
   * DiscordEmbedHandlerServiceから統合
   */
  private registerEmbedEventHandlers(): void {
    // Discord Character Embed更新リクエストハンドラー
    this.typedEventService.on(
      'discord.embed.character.update.requested',
      this.handleCharacterEmbedUpdateRequest.bind(this)
    )

    // キャラクター情報更新時のEmbed自動更新
    this.typedEventService.on('character.updated', this.handleCharacterUpdated.bind(this))

    this.logger.debug('Discord embed event handlers registered in features/characterThread/')
  }

  /**
   * チャンネルIDからキャラクターを検索し、指定タブのEmbedを作成
   */
  async createCharacterEmbed(channelId: string, tabType: TabType = 'basic'): Promise<EmbedBuilder | null> {
    try {
      this.logger.log(`Creating character embed: channelId=${channelId}, tabType=${tabType}`)

      // キャラクター検索イベントを発行
      await this.typedEventService.emit('character.findByChannelId.requested', {
        channelId,
        source: 'character-display-service',
        timestamp: new Date(),
        tabType
      })

      // 結果を待機（タイムアウト10秒）
      const result = await Promise.race([
        this.typedEventService.waitForEvent('character.findByChannelId.completed', 10000),
        this.typedEventService.waitForEvent('character.findByChannelId.failed', 10000)
      ])

      if ('character' in result && result.character) {
        return this.buildCharacterEmbed(result.character, tabType)
      }

      this.logger.warn(`Character not found for channelId: ${channelId}`)
      return null
    } catch (error) {
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
  // DiscordEmbedHandlerServiceから統合されたメソッド
  // ============================================================================

  /**
   * Character Embed更新リクエストを処理
   * DiscordEmbedHandlerServiceから統合
   */
  private async handleCharacterEmbedUpdateRequest(
    payload: EventPayload<'discord.embed.character.update.requested'>
  ): Promise<void> {
    const { character, channelId, source } = payload

    this.logger.log(`[CHARACTER-EMBED] Character embed update requested: ${character.characterId} from ${source}`)

    try {
      // 新しいEmbedを作成
      const embed = this.buildCharacterEmbed(character, 'basic')

      // Discord APIを通じてEmbed更新（TypedEventService経由）
      this.typedEventService.emit('discord.message.embed.update', {
        channelId,
        embed: embed.toJSON(),
        character,
        success: true,
        source: 'character-display-service',
        timestamp: new Date()
      })

      this.logger.log(`[CHARACTER-EMBED] Embed update completed for ${character.characterId}`)
    } catch (error) {
      this.logger.error(`[CHARACTER-EMBED] Embed update failed for ${character.characterId}`, error)

      // エラーイベントを発行
      this.typedEventService.emit('discord.embed.character.update.failed', {
        characterId: character.characterId,
        channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
        source,
        timestamp: new Date()
      })
    }
  }

  /**
   * キャラクター更新時の自動Embed更新処理
   * DiscordEmbedHandlerServiceから統合
   */
  private async handleCharacterUpdated(payload: EventPayload<'character.updated'>): Promise<void> {
    const { character, updateType } = payload

    this.logger.log(`[CHARACTER-EMBED] Character updated: ${character.characterId} (${updateType})`)

    try {
      // 更新タイプに応じてTabTypeを決定
      const tabType = this.getTabTypeFromUpdateType(updateType)

      // 新しいEmbedを作成
      const embed = this.buildCharacterEmbed(character, tabType)

      // チャンネルIDが設定されている場合のみ更新
      if (character.discordChannelId) {
        this.typedEventService.emit('discord.message.embed.update', {
          channelId: character.discordChannelId,
          embed: embed.toJSON(),
          character,
          success: true,
          source: 'character-auto-update',
          timestamp: new Date()
        })

        this.logger.log(`[CHARACTER-EMBED] Auto-update completed for ${character.characterId}`)
      }
    } catch (error) {
      this.logger.error(`[CHARACTER-EMBED] Auto-update failed for ${character.characterId}`, error)
    }
  }

  /**
   * 更新タイプからTabTypeを決定
   */
  private getTabTypeFromUpdateType(updateType: string): TabType {
    const updateTypeMapping: Record<string, TabType> = {
      parameter: 'status',
      skill: 'skills',
      item: 'items',
      description: 'desc',
      basic: 'basic'
    }

    return updateTypeMapping[updateType] || 'basic'
  }

  /**
   * Embed更新の直接実行
   * features/内の他のサービスから使用
   */
  async updateCharacterEmbed(character: Character, channelId: string, tabType: TabType = 'basic'): Promise<void> {
    try {
      this.logger.log(`[CHARACTER-EMBED] Direct embed update: ${character.characterId}`)

      const embed = this.buildCharacterEmbed(character, tabType)

      this.typedEventService.emit('discord.message.embed.update', {
        channelId,
        embed: embed.toJSON(),
        character,
        success: true,
        source: 'character-display-direct',
        timestamp: new Date()
      })
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
  ): Promise<any | null> {
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
