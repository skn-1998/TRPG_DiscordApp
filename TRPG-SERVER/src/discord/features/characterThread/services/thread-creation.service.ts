/**
 * Thread Creation Service
 *
 * characterEditパターンに基づくシンプルなスレッド作成サービス
 * 過度な抽象化を排除し、実用性を重視
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  Guild,
  TextChannel,
  ThreadChannel,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ThreadAutoArchiveDuration
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { ErrorHandler, ErrorContext } from '../../../../utils/error-handler'
import { DiscordClientService } from '../../../services/discord-client.service'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { CharacterService } from '../../../../domains/character/character.service'

/**
 * スレッド作成リクエスト
 */
export interface CreateThreadRequest {
  characterId: string
  characterName: string
  channelId: string
  creatorId: string
  guildId: string
  displayType?: 'basic' | 'enhanced' | 'compact' // 表示タイプ
}

/**
 * スレッド作成結果
 */
export interface CreateThreadResult {
  success: boolean
  threadId?: string
  threadUrl?: string
  error?: string
}

/**
 * スレッド作成サービス
 *
 * Discord APIを直接使用してスレッドを作成し、
 * キャラクター情報を投稿する実用的なサービス
 */
@Injectable()
export class ThreadCreationService {
  private readonly logger = new Logger(ThreadCreationService.name)
  private readonly discordClient: Client

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly typedEventService: TypedEventService,
    private readonly characterService: CharacterService
  ) {
    this.discordClient = this.discordClientService.getClient()
    this.registerEventHandlers()
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    this.typedEventService.on('discord.thread.create.requested', this.handleThreadCreateRequest.bind(this))
    this.logger.debug('Thread creation event handlers registered')
  }

  /**
   * スレッド作成リクエストイベントを処理
   */
  private async handleThreadCreateRequest(
    payload: import('../../../../shared/domain/events/event-contracts').EventPayload<'discord.thread.create.requested'>
  ): Promise<void> {
    const { character, channelId, guildId, creatorId, displayType, source } = payload

    this.logger.log(`Handling thread create request for character: ${character.characterId}`)

    try {
      const request: CreateThreadRequest = {
        characterId: character.characterId,
        characterName: character.characterName || 'Unknown Character',
        channelId,
        guildId,
        creatorId,
        displayType
      }

      const result = await this.createCharacterThread(request, character)

      if (result.success) {
        // 成功イベントを発行
        await this.typedEventService.emit('discord.thread.create.completed', {
          threadId: result.threadId!,
          threadUrl: result.threadUrl,
          character,
          source,
          timestamp: new Date()
        })
      } else {
        // 失敗イベントを発行
        await this.typedEventService.emit('discord.thread.create.failed', {
          characterId: character.characterId,
          channelId,
          error: result.error || 'Unknown error',
          source,
          timestamp: new Date()
        })
      }
    } catch (error) {
      this.logger.error('Failed to handle thread create request', error)

      await this.typedEventService.emit('discord.thread.create.failed', {
        characterId: character.characterId,
        channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
        source,
        timestamp: new Date()
      })
    }
  }

  /**
   * キャラクタースレッドを作成
   */
  async createCharacterThread(request: CreateThreadRequest, character: Character): Promise<CreateThreadResult> {
    this.logger.log(`Creating thread for character: ${request.characterName}`)

    try {
      // ギルドを取得
      const guild = await this.getGuild(request.guildId)
      if (!guild) {
        return {
          success: false,
          error: `Guild not found: ${request.guildId}`
        }
      }

      // チャンネルを取得
      const channel = await this.getTextChannel(guild, request.channelId)
      if (!channel) {
        return {
          success: false,
          error: `Channel not found: ${request.channelId}`
        }
      }

      // スレッドを作成
      const thread = await this.createDiscordThread(channel, request.characterName)

      // character-editチャンネルIDを保存してから、discordChannelIdをスレッドIDに更新
      await this.updateCharacterChannelIds(character.characterId, thread.id, character.discordChannelId)

      // キャラクター情報を投稿（表示タイプに応じて処理）
      await this.postCharacterDisplay(thread, character, request.displayType || 'basic')

      const threadUrl = `https://discord.com/channels/${request.guildId}/${request.channelId}/${thread.id}`

      this.logger.log(`Thread created successfully: ${thread.id}`)

      return {
        success: true,
        threadId: thread.id,
        threadUrl
      }
    } catch (error) {
      const context: ErrorContext = {
        characterId: request.characterId,
        channelId: request.channelId,
        action: 'thread-creation'
      }

      ErrorHandler.handleServiceError(error, context, 'ThreadCreationService')

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Discordスレッドを作成
   */
  private async createDiscordThread(channel: TextChannel, characterName: string): Promise<ThreadChannel> {
    const timestamp = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const threadName = `🎭 ${characterName} [${timestamp}]`

    return await channel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PublicThread,
      reason: `Character thread for ${characterName}`
    })
  }

  /**
   * 表示タイプに応じてキャラクター表示を処理
   */
  private async postCharacterDisplay(
    thread: ThreadChannel,
    character: Character,
    displayType: 'basic' | 'enhanced' | 'compact'
  ): Promise<void> {
    try {
      if (displayType === 'enhanced') {
        await this.postEnhancedCharacterInfo(thread, character)
        // Enhanced表示でもダイスロールボタンを表示
        await this.postActionButtons(thread, thread.id)
        await this.postSkillRollButtons(thread, character)
      } else if (displayType === 'compact') {
        await this.postCompactCharacterInfo(thread, character)
        // Compact表示でもダイスロールボタンを表示
        await this.postActionButtons(thread, thread.id)
        await this.postSkillRollButtons(thread, character)
      } else {
        // basic display
        await this.postCharacterInfo(thread, character)
        await this.postActionButtons(thread, thread.id)
        await this.postSkillRollButtons(thread, character)
      }
    } catch (error) {
      this.logger.error(`Failed to post character display (${displayType}), falling back to basic`, error)

      // フォールバック: 基本表示
      await this.postCharacterInfo(thread, character)
      await this.postActionButtons(thread, thread.id)
      await this.postSkillRollButtons(thread, character)
    }
  }

  /**
   * Enhanced Character表示（character-thread用：基本表示＋詳細情報）
   */
  private async postEnhancedCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      this.logger.log(`Posting enhanced character info for: ${character.characterId}`)

      // character-thread用のenhanced表示：基本情報＋詳細表示（編集機能なし）
      await this.postDetailedCharacterInfo(thread, character)

      this.logger.log(`Enhanced character display completed for: ${character.characterId}`)
    } catch (error) {
      this.logger.error('Failed to post enhanced character info', error)
      throw error // Re-throw to trigger fallback in postCharacterDisplay
    }
  }

  /**
   * 詳細キャラクター情報を表示（編集機能なし）
   */
  private async postDetailedCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    // 基本情報Embed
    const basicEmbed = new EmbedBuilder()
      .setTitle(`🎭 ${character.characterName} - 詳細情報`)
      .setColor(0x00ae86)
      .setTimestamp()

    // 基本情報
    if (character.gameSystemId) {
      basicEmbed.addFields({
        name: '🎲 ゲームシステム',
        value: character.gameSystemId,
        inline: true
      })
    }

    basicEmbed.addFields({
      name: '🆔 キャラクターID',
      value: character.characterId,
      inline: true
    })

    // ステータス情報
    if (character.parameter && Object.keys(character.parameter).length > 0) {
      const statusText = this.formatCharacterData(character.parameter)
      if (statusText) {
        basicEmbed.addFields({
          name: '📊 パラメータ',
          value: statusText.substring(0, 1024),
          inline: false
        })
      }
    }

    // スキル情報
    if (character.skill && Object.keys(character.skill).length > 0) {
      const skillText = this.formatCharacterData(character.skill)
      if (skillText) {
        basicEmbed.addFields({
          name: '⚔️ スキル',
          value: skillText.substring(0, 1024),
          inline: false
        })
      }
    }

    // アイテム情報
    if (character.item && Object.keys(character.item).length > 0) {
      const itemText = this.formatCharacterData(character.item)
      if (itemText) {
        basicEmbed.addFields({
          name: '🎒 アイテム',
          value: itemText.substring(0, 1024),
          inline: false
        })
      }
    }

    // 編集URLを追加（Discord チャンネルURL）
    const editUrl = this.generateCharacterEditUrl(character, thread.guild?.id || '')
    if (editUrl) {
      basicEmbed.addFields({
        name: '✏️ キャラクター編集',
        value: `[こちらから詳細な編集ができます](${editUrl})`,
        inline: false
      })
    }

    await thread.send({ embeds: [basicEmbed] })
  }

  /**
   * コンパクト表示（将来の拡張用）
   */
  private async postCompactCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    // 簡単な1行表示など、将来実装
    await this.postCharacterInfo(thread, character)
  }

  /**
   * キャラクター情報Embedを投稿（基本版 + 編集URL）
   */
  private async postCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    const embed = new EmbedBuilder().setTitle(`🎭 ${character.characterName}`).setColor(0x00ae86).setTimestamp()

    // 基本情報
    if (character.gameSystemId) {
      embed.addFields({
        name: '🎲 ゲームシステム',
        value: character.gameSystemId,
        inline: true
      })
    }

    embed.addFields({
      name: '🆔 キャラクターID',
      value: character.characterId,
      inline: true
    })

    // ステータス情報（簡略化）
    if (character.parameter) {
      const statusText = this.formatCharacterData(character.parameter)
      if (statusText) {
        embed.addFields({
          name: '📊 ステータス',
          value: statusText.substring(0, 1024), // Discord field limit
          inline: false
        })
      }
    }

    // キャラクター編集URL（Discord チャンネルURL）
    const editUrl = this.generateCharacterEditUrl(character, thread.guild?.id || '')
    if (editUrl) {
      embed.addFields({
        name: '✏️ キャラクター編集',
        value: `[こちらから詳細な編集ができます](${editUrl})`,
        inline: false
      })
    }

    await thread.send({ embeds: [embed] })
  }

  /**
   * 操作ボタンを投稿（ダイスロールボタンのみ - character-editと共有）
   */
  private async postActionButtons(thread: ThreadChannel, channelId: string): Promise<void> {
    // ダイスロールボタン（thread→親チャンネル送信機能付き）
    const diceButtons = [
      new ButtonBuilder().setCustomId('roll*1d100').setLabel('1D100').setStyle(ButtonStyle.Danger).setEmoji('🎲'),

      new ButtonBuilder().setCustomId('roll*1d6').setLabel('1D6').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),

      new ButtonBuilder().setCustomId('roll*2d6').setLabel('2D6').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),

      new ButtonBuilder().setCustomId('roll*custom').setLabel('カスタム').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    ]

    const diceRow = new ActionRowBuilder<ButtonBuilder>().addComponents(diceButtons)

    await thread.send({
      content: '🎲 ダイスロール（結果は親チャンネルに送信されます）：',
      components: [diceRow]
    })
  }

  /**
   * キャラクターのスキルロールボタンを投稿（character-editと共有）
   */
  private async postSkillRollButtons(thread: ThreadChannel, character: Character): Promise<void> {
    if (!character.skill || Object.keys(character.skill).length === 0) {
      return
    }

    const skillButtons: ButtonBuilder[] = []
    const actionRows: ActionRowBuilder<ButtonBuilder>[] = []
    let buttonCount = 0
    const maxButtonsPerRow = 5
    const maxTotalButtons = 20

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

      // スキルロールボタンを作成（character-editと共有フォーマット）
      const customId = `roll*_${skillName}-${skillValue}*${character.characterId}`

      const button = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(`${skillName}(${skillValue})`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎯')

      skillButtons.push(button)
      buttonCount++

      // 5個ごとに新しい行を作成
      if (skillButtons.length === maxButtonsPerRow) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skillButtons.splice(0, maxButtonsPerRow))
        actionRows.push(row)
      }
    }

    // 残りのボタンがある場合は最後の行に追加
    if (skillButtons.length > 0) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skillButtons)
      actionRows.push(row)
    }

    // スキルロールボタンがある場合は投稿
    if (actionRows.length > 0) {
      await thread.send({
        content: '🎯 スキルロール（結果は親チャンネルに送信されます）：',
        components: actionRows
      })
    }
  }

  /**
   * キャラクター編集URLを生成（DiscordチャンネルURL）
   */
  private generateCharacterEditUrl(character: Character, guildId: string): string | null {
    // 編集専用チャンネルIDがあればそれを使用、なければ通常のチャンネルIDを使用
    const editChannelId = character.discordEditChannelId || character.discordChannelId

    if (editChannelId) {
      // Discord チャンネルURLを生成
      return `https://discord.com/channels/${guildId}/${editChannelId}`
    }
    return null
  }

  /**
   * キャラクターデータをフォーマット
   */
  private formatCharacterData(data: Record<string, unknown>): string {
    if (!data || typeof data !== 'object') {
      return ''
    }

    return Object.entries(data)
      .map(([key, value]) => {
        if (value && typeof value === 'object' && 'name' in value && 'value' in value) {
          const typedValue = value as { name: string; value: string | number }
          return `**${typedValue.name}**: ${typedValue.value}`
        }
        return `**${key}**: ${value}`
      })
      .slice(0, 5) // 最大5項目まで
      .join('\\n')
  }

  /**
   * キャラクターのチャンネルIDを更新（編集チャンネルIDを保存してからスレッドIDに更新）
   */
  private async updateCharacterChannelIds(
    characterId: string,
    threadId: string,
    editChannelId?: string
  ): Promise<void> {
    try {
      const updateData: any = {
        discordChannelId: threadId
      }

      // 元のeditチャンネルIDが存在し、まだ設定されていない場合は保存
      if (editChannelId && editChannelId !== threadId) {
        updateData.discordEditChannelId = editChannelId
      }

      await this.characterService.update(characterId, updateData)
      this.logger.log(`Character channel IDs updated: ${characterId} -> thread: ${threadId}, edit: ${editChannelId}`)
    } catch (error) {
      this.logger.error(`Failed to update character channel IDs: ${characterId}`, error)
      // エラーが発生してもスレッド作成処理は継続
    }
  }

  /**
   * 旧メソッド（下位互換）
   */
  private async updateCharacterChannelId(characterId: string, threadId: string): Promise<void> {
    await this.updateCharacterChannelIds(characterId, threadId)
  }

  /**
   * ギルドを取得
   */
  private async getGuild(guildId: string): Promise<Guild | null> {
    try {
      return await this.discordClient.guilds.fetch(guildId)
    } catch (error) {
      this.logger.error(`Failed to fetch guild ${guildId}:`, error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * テキストチャンネルを取得
   */
  private async getTextChannel(guild: Guild, channelId: string): Promise<TextChannel | null> {
    try {
      const channel = await guild.channels.fetch(channelId)

      if (!channel || !(channel instanceof TextChannel)) {
        return null
      }

      return channel
    } catch (error) {
      this.logger.error(`Failed to fetch channel ${channelId}:`, error instanceof Error ? error.message : String(error))
      return null
    }
  }
}
