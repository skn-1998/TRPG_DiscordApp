/**
 * Character Display Service
 *
 * キャラクター情報表示の統合サービス
 * character-tab-buttons.serviceの機能とDiscordEmbedHandlerServiceを統合
 * features/内でのEmbed生成・更新ロジック一元化
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import {
  EmbedBuilder,
  Client,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ErrorHandler, ErrorContext } from '../../../../utils/error-handler'
import { EventPayload } from '../../../../events/contracts'

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
   * Embed関連イベントハンドラーを登録（character-thread専用）
   */
  private registerEmbedEventHandlers(): void {
    // character-thread専用のキャラクター表示リクエストハンドラー
    this.typedEventService.on('discord.character.display.requested', this.handleCharacterDisplayRequest.bind(this))

    this.logger.debug('Character thread display event handlers registered')
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

      // 結果を待機（タイムアウト3秒に短縮）
      const result = await Promise.race([
        this.typedEventService.waitForEvent('character.findByChannelId.completed', 3000),
        this.typedEventService.waitForEvent('character.findByChannelId.failed', 3000)
      ])

      if ('character' in result && result.character) {
        return this.buildCharacterEmbed(result.character, tabType)
      }

      this.logger.warn(`Character not found for channelId: ${channelId}`)
      return null
    } catch (error) {
      // タイムアウトエラーの場合は詳細ログを出力
      if (error instanceof Error && error.message.includes('timeout')) {
        this.logger.warn(`Character search timeout for channelId: ${channelId} - falling back to alternative method`)
      } else {
        this.logger.error(`Character embed creation failed for channelId: ${channelId}`, error)
      }

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
   */
  private async handleCharacterDisplayRequest(
    payload: EventPayload<'discord.character.display.requested'>
  ): Promise<void> {
    const { character, channelId, source } = payload

    this.logger.log(`[CHARACTER-THREAD-DISPLAY] Character display requested: ${character.characterId} from ${source}`)

    try {
      // character-thread専用の基本的なEmbed表示のみ
      const embed = this.buildCharacterEmbed(character, 'basic')
      this.typedEventService.emit('discord.message.embed.update', {
        channelId,
        embed: embed.toJSON(),
        character,
        success: true,
        source: 'character-thread-display',
        timestamp: new Date()
      })

      this.logger.log(`[CHARACTER-THREAD-DISPLAY] Character display completed for ${character.characterId}`)
    } catch (error) {
      this.logger.error(`[CHARACTER-THREAD-DISPLAY] Character display failed for ${character.characterId}`, error)
    }
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

  /**
   * キャラクターのスキルに基づいてスキルロールボタンを生成
   */
  createSkillRollButtons(character: Character): ActionRowBuilder<ButtonBuilder>[] {
    const buttons: ButtonBuilder[] = []
    const actionRows: ActionRowBuilder<ButtonBuilder>[] = []

    if (!character.skill || Object.keys(character.skill).length === 0) {
      return []
    }

    let buttonCount = 0
    const maxButtonsPerRow = 5
    const maxTotalButtons = 20 // Discord制限に配慮

    for (const [skillKey, skillData] of Object.entries(character.skill)) {
      if (buttonCount >= maxTotalButtons) break

      let skillName: string
      let skillValue: number

      // スキルデータの形式を判定
      if (skillData && typeof skillData === 'object') {
        if ('name' in skillData && 'value' in skillData) {
          skillName = skillData.name as string
          skillValue = Number(skillData.value) || 0
        } else {
          skillName = skillKey
          skillValue = Number(skillData) || 0
        }
      } else {
        skillName = skillKey
        skillValue = Number(skillData) || 0
      }

      // スキル値が0以下の場合はスキップ
      if (skillValue <= 0) continue

      // スキルロールボタンを作成
      // customId形式: roll*_{skillName}-{skillValue}*{characterId}
      const customId = `roll*_${skillName}-${skillValue}*${character.characterId}`

      const button = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(`${skillName}(${skillValue})`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎯')

      buttons.push(button)
      buttonCount++

      // 5個ごとに新しい行を作成
      if (buttons.length === maxButtonsPerRow) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.splice(0, maxButtonsPerRow))
        actionRows.push(row)
      }
    }

    // 残りのボタンがある場合は最後の行に追加
    if (buttons.length > 0) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)
      actionRows.push(row)
    }

    return actionRows
  }

  /**
   * 基本ダイスロールボタンを生成
   */
  createBasicDiceButtons(character: Character): ActionRowBuilder<ButtonBuilder> {
    const diceButtons = [
      new ButtonBuilder()
        .setCustomId(`roll*1d100*${character.characterId}`)
        .setLabel('1D100')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🎲'),

      new ButtonBuilder()
        .setCustomId(`roll*1d6*${character.characterId}`)
        .setLabel('1D6')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎲'),

      new ButtonBuilder()
        .setCustomId(`roll*2d6*${character.characterId}`)
        .setLabel('2D6')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎲'),

      new ButtonBuilder()
        .setCustomId(`roll*custom*${character.characterId}`)
        .setLabel('カスタム')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️')
    ]

    return new ActionRowBuilder<ButtonBuilder>().addComponents(diceButtons)
  }
}
