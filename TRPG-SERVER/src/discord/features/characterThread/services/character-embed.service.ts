import { Injectable, Logger } from '@nestjs/common'
import { Client, ThreadChannel, EmbedBuilder } from 'discord.js'
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { DiscordClientService } from '../../../services/discord-client.service'

/**
 * キャラクターEmbed作成サービス
 *
 * 責務：
 * - キャラクター情報のEmbed生成
 * - 表示タイプ別の情報整形
 * - キャラクターデータの表示ロジック
 */
@Injectable()
export class CharacterEmbedService {
  private readonly logger = new Logger(CharacterEmbedService.name)
  private readonly discordClient: Client

  constructor(private readonly discordClientService: DiscordClientService) {
    this.discordClient = this.discordClientService.getClient()
    this.logger.debug('Character embed service initialized')
  }

  /**
   * キャラクター情報をスレッドに投稿
   */
  async postCharacterDisplay(
    thread: ThreadChannel,
    character: CharacterEntity,
    displayType: 'basic' | 'enhanced' | 'compact' = 'enhanced'
  ): Promise<void> {
    this.logger.debug(`Posting character display: ${character.characterName} (${displayType})`)

    try {
      switch (displayType) {
        case 'enhanced':
          await this.postEnhancedCharacterInfo(thread, character)
          break
        case 'compact':
          await this.postCompactCharacterInfo(thread, character)
          break
        case 'basic':
        default:
          await this.postBasicCharacterInfo(thread, character)
          break
      }

      this.logger.debug(`Character display posted successfully: ${character.characterName}`)
    } catch (error) {
      this.logger.error(`Failed to post character display: ${character.characterName}`, error)
      throw error
    }
  }

  /**
   * 強化表示：詳細なキャラクター情報
   */
  private async postEnhancedCharacterInfo(thread: ThreadChannel, character: CharacterEntity): Promise<void> {
    const embed = this.buildEnhancedCharacterEmbed(thread.guildId, character)

    await thread.send({ embeds: [embed] })
  }

  private buildEnhancedCharacterEmbed(guildId: string, character: CharacterEntity): EmbedBuilder {
    // DiscordチャンネルURLを生成
    const channelUrl = character.discordChannelId
      ? `https://discord.com/channels/${guildId}/${character.discordChannelId}`
      : null

    const description = [
      `**ゲームシステム**: ${character.gameSystemId || '未設定'}`,
      channelUrl ? `**編集チャンネル**: [キャラクター編集](${channelUrl})` : null
    ]
      .filter(Boolean)
      .join('\n')

    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${character.characterName}`)
      .setDescription(description)
      .setColor(0x00ae86)
      .setTimestamp()

    // ステータス情報
    if (character.status && Object.keys(character.status).length > 0) {
      const statusText = this.formatAttributeSection(character.status)
      if (statusText) {
        embed.addFields({ name: '📊 ステータス', value: statusText, inline: true })
      }
    }

    // パラメータ情報
    if (character.parameter && Object.keys(character.parameter).length > 0) {
      const parameterText = this.formatAttributeSection(character.parameter)
      if (parameterText) {
        embed.addFields({ name: '⚡ パラメータ', value: parameterText, inline: true })
      }
    }

    // スキル情報（上位5個まで）
    if (character.skill && Object.keys(character.skill).length > 0) {
      const skillText = this.formatAttributeSection(character.skill, 5)
      if (skillText) {
        embed.addFields({ name: '🎯 スキル', value: skillText, inline: false })
      }
    }

    // アイテム情報（上位3個まで）
    if (character.item && Object.keys(character.item).length > 0) {
      const itemText = this.formatAttributeSection(character.item, 3)
      if (itemText) {
        embed.addFields({ name: '🎒 アイテム', value: itemText, inline: false })
      }
    }

    // 説明情報
    if (character.description && Object.keys(character.description).length > 0) {
      const descriptionText = this.formatAttributeSection(character.description, 1)
      if (descriptionText) {
        embed.addFields({ name: '📖 説明', value: descriptionText, inline: false })
      }
    }

    return embed
  }

  /**
   * コンパクト表示：最小限の情報
   */
  private async postCompactCharacterInfo(thread: ThreadChannel, character: CharacterEntity): Promise<void> {
    // DiscordチャンネルURLを生成
    const guildId = thread.guildId
    const channelUrl = character.discordChannelId
      ? `https://discord.com/channels/${guildId}/${character.discordChannelId}`
      : null

    const description = [
      `**${character.gameSystemId || 'システム未設定'}**`,
      channelUrl ? `[編集チャンネル](${channelUrl})` : null
    ]
      .filter(Boolean)
      .join('\n')

    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${character.characterName}`)
      .setDescription(description)
      .setColor(0x36393f)
      .setTimestamp()

    // 主要ステータスのみ（最大3個）
    if (character.status && Object.keys(character.status).length > 0) {
      const statusText = this.formatAttributeSection(character.status, 3)
      if (statusText) {
        embed.addFields({ name: '📊 主要ステータス', value: statusText, inline: false })
      }
    }

    await thread.send({ embeds: [embed] })
  }

  /**
   * 基本表示：標準的な情報
   */
  private async postBasicCharacterInfo(thread: ThreadChannel, character: CharacterEntity): Promise<void> {
    // DiscordチャンネルURLを生成
    const guildId = thread.guildId
    const channelUrl = character.discordChannelId
      ? `https://discord.com/channels/${guildId}/${character.discordChannelId}`
      : null

    const description = [
      `**ゲームシステム**: ${character.gameSystemId || '未設定'}`,
      channelUrl ? `**編集チャンネル**: [キャラクター編集](${channelUrl})` : null
    ]
      .filter(Boolean)
      .join('\n')

    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${character.characterName}`)
      .setDescription(description)
      .setColor(0x0099ff)
      .setTimestamp()

    // ステータス
    if (character.status && Object.keys(character.status).length > 0) {
      const statusText = this.formatAttributeSection(character.status)
      if (statusText) {
        embed.addFields({ name: '📊 ステータス', value: statusText, inline: true })
      }
    }

    // パラメータ
    if (character.parameter && Object.keys(character.parameter).length > 0) {
      const parameterText = this.formatAttributeSection(character.parameter)
      if (parameterText) {
        embed.addFields({ name: '⚡ パラメータ', value: parameterText, inline: true })
      }
    }

    await thread.send({ embeds: [embed] })
  }

  /**
   * アトリビュートセクションのフォーマット
   */
  private formatAttributeSection(attributes: Record<string, any>, maxItems: number = 10): string {
    const entries = Object.entries(attributes).slice(0, maxItems)
    if (entries.length === 0) return ''

    return entries
      .map(([key, value]) => {
        if (typeof value === 'object' && value !== null) {
          // AttributeValue オブジェクトの場合
          const name = value.name || key
          const values = value.values || {}

          if (Object.keys(values).length > 0) {
            const valueStr = Object.entries(values)
              .map(([k, v]) => `${k}:${v}`)
              .join(', ')
            return `**${name}**: ${valueStr}`
          } else {
            return `**${name}**: ${value.description || '未設定'}`
          }
        } else {
          // プリミティブ値の場合
          return `**${key}**: ${value}`
        }
      })
      .join('\n')
  }

  /**
   * キャラクター情報をスレッドに投稿（従来のpostCharacterInfo互換メソッド）
   */
  async postCharacterInfo(thread: ThreadChannel, character: CharacterEntity, _userName?: string): Promise<void> {
    this.logger.debug(`Posting character info: ${character.characterName}`)
    await this.postCharacterDisplay(thread, character, 'enhanced')
  }

  /**
   * キャラクター表示の更新
   */
  async updateCharacterDisplay(character: CharacterEntity): Promise<void> {
    try {
      if (!character.discordThreadId) {
        this.logger.warn(`No thread ID found for character: ${character.characterId}`)
        return
      }

      const thread = await this.discordClient.channels.fetch(character.discordThreadId)
      if (!thread?.isThread()) {
        this.logger.warn(`Thread not found or invalid: ${character.discordThreadId}`)
        return
      }

      // 既存のキャラクター情報Embedメッセージを検索して更新
      await this.updateExistingCharacterEmbed(thread as ThreadChannel, character)

      this.logger.debug(`Character display updated: ${character.characterName}`)
    } catch (error) {
      this.logger.error(`Failed to update character display: ${character.characterName}`, error)
      throw error
    }
  }

  /**
   * 既存のキャラクター情報Embedメッセージを検索して更新
   */
  private async updateExistingCharacterEmbed(thread: ThreadChannel, character: CharacterEntity): Promise<void> {
    try {
      // 最近の50メッセージを取得してキャラクター情報Embedを検索
      const messages = await thread.messages.fetch({ limit: 50 })

      // ボットが送信したキャラクター情報Embedを検索
      const characterEmbedMessage = messages.find(
        (message) =>
          message.author.id === this.discordClient.user?.id &&
          message.embeds.length > 0 &&
          message.embeds[0].title?.includes(character.characterName) &&
          message.embeds[0].title?.includes('🎭')
      )

      if (characterEmbedMessage) {
        // 既存メッセージを更新
        this.logger.debug(`Found existing character embed message, updating: ${characterEmbedMessage.id}`)

        const embed = this.buildEnhancedCharacterEmbed(thread.guildId, character)

        await characterEmbedMessage.edit({ embeds: [embed] })
        this.logger.debug(`Character embed message updated successfully`)
      } else {
        // 既存メッセージが見つからない場合は新しいメッセージを投稿
        this.logger.debug(`No existing character embed found, posting new message`)
        await this.postCharacterDisplay(thread, character, 'enhanced')
      }
    } catch (error) {
      this.logger.error(`Failed to update existing character embed: ${error}`)
      // エラー時は新しいメッセージを投稿
      await this.postCharacterDisplay(thread, character, 'enhanced')
    }
  }
}
