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

/**
 * スレッド作成リクエスト
 */
export interface CreateThreadRequest {
  characterId: string
  characterName: string
  channelId: string
  creatorId: string
  guildId: string
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

  constructor(private readonly discordClientService: DiscordClientService) {
    this.discordClient = this.discordClientService.getClient()
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

      // キャラクター情報を投稿
      await this.postCharacterInfo(thread, character)

      // 操作ボタンを投稿
      await this.postActionButtons(thread, request.channelId)

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
   * キャラクター情報Embedを投稿
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

    await thread.send({ embeds: [embed] })
  }

  /**
   * 操作ボタンを投稿
   */
  private async postActionButtons(thread: ThreadChannel, channelId: string): Promise<void> {
    const buttons = [
      new ButtonBuilder()
        .setCustomId(`character-tab*${channelId}*basic`)
        .setLabel('基本情報')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),

      new ButtonBuilder()
        .setCustomId(`character-tab*${channelId}*status`)
        .setLabel('ステータス')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊'),

      new ButtonBuilder()
        .setCustomId(`character-tab*${channelId}*skills`)
        .setLabel('スキル')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚔️'),

      new ButtonBuilder()
        .setCustomId(`character-tab*${channelId}*desc`)
        .setLabel('詳細')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📖')
    ]

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons)

    await thread.send({
      content: '📋 キャラクター情報を表示：',
      components: [actionRow]
    })
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
