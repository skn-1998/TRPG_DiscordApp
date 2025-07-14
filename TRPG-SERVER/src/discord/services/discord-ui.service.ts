import { Injectable, Logger } from '@nestjs/common'
import { ChannelType, EmbedBuilder, TextChannel, MessageCreateOptions } from 'discord.js'
import { DiscordClientService } from './discord-client.service'
import { SendMessageDto, EmbedDto } from '../dto/send-message.dto'
import { CreateChannelDto } from '../dto/create-channel.dto'
import { Character } from '../../domains/character/models/character.model'

interface GuildInfo {
  id: string
  name: string
  memberCount: number
  channels: Array<{ id: string; name: string; type: string }>
}

interface EmbedData {
  title: string
  description: string
  color: number
  fields: Array<{
    name: string
    value: string
    inline: boolean
  }>
}

/**
 * Discord UI操作専用サービス
 * 循環依存を避けるため、CharacterServiceに依存しない軽量な実装
 */
@Injectable()
export class DiscordUIService {
  private readonly logger = new Logger(DiscordUIService.name)

  constructor(private readonly discordClientService: DiscordClientService) {}

  /**
   * メッセージを送信
   */
  async sendMessage(sendMessageDto: SendMessageDto): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        return { success: false, error: 'Discord client not available' }
      }

      const channel = await client.channels.fetch(sendMessageDto.channelId)
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Invalid channel' }
      }

      const messageOptions: MessageCreateOptions = {}

      if (sendMessageDto.content) {
        messageOptions.content = sendMessageDto.content
      }

      if (sendMessageDto.embed) {
        messageOptions.embeds = [sendMessageDto.embed]
      }

      const sentMessage = await (channel as TextChannel).send(messageOptions)

      return { success: true, messageId: sentMessage.id }
    } catch (error) {
      this.logger.error('Failed to send message:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * チャンネルを作成
   */
  async createChannel(
    createChannelDto: CreateChannelDto
  ): Promise<{ success: boolean; channelId?: string; error?: string }> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        return { success: false, error: 'Discord client not available' }
      }

      const guild = await client.guilds.fetch(createChannelDto.guildId)
      if (!guild) {
        return { success: false, error: 'Guild not found' }
      }

      const channel = await guild.channels.create({
        name: createChannelDto.name,
        type: ChannelType.GuildText, // 固定でGuildTextを使用
        topic: createChannelDto.topic,
        parent: createChannelDto.parentId
      })

      return { success: true, channelId: channel.id }
    } catch (error) {
      this.logger.error('Failed to create channel:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * キャラクター情報のEmbedを作成または更新
   */
  async createOrUpdateCharacterEmbed(
    character: Character,
    channelId: string,
    guildInfo: GuildInfo
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        return { success: false, error: 'Discord client not available' }
      }

      const channel = await client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        return { success: false, error: 'Invalid channel' }
      }

      // 既存のキャラクターEmbedを検索
      const existingEmbed = await this.findExistingCharacterEmbed(channel as TextChannel)

      const embedData = this.createCharacterEmbedData(character, guildInfo)
      const embed = new EmbedBuilder()
        .setTitle(embedData.title)
        .setDescription(embedData.description)
        .setColor(embedData.color)
        .addFields(embedData.fields)

      if (existingEmbed) {
        // 既存のEmbedを更新
        const updatedMessage = await existingEmbed.edit({ embeds: [embed] })
        return { success: true, messageId: updatedMessage.id }
      } else {
        // 新しいEmbedを作成
        const newMessage = await (channel as TextChannel).send({ embeds: [embed] })
        return { success: true, messageId: newMessage.id }
      }
    } catch (error) {
      this.logger.error('Failed to create or update character embed:', error)
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * 既存のキャラクターEmbedを検索
   */
  private async findExistingCharacterEmbed(channel: TextChannel) {
    try {
      const messages = await channel.messages.fetch({ limit: 50 })
      const client = this.discordClientService.getClient()

      if (!client?.user) return null

      return (
        messages.find(
          (msg) =>
            msg.author.id === client.user!.id &&
            msg.embeds.length > 0 &&
            msg.embeds[0].title?.includes('キャラクター情報')
        ) || null
      )
    } catch (error) {
      this.logger.error('Failed to find existing character embed:', error)
      return null
    }
  }

  /**
   * キャラクターEmbedデータを作成
   */
  private createCharacterEmbedData(character: Character, guildInfo: GuildInfo): EmbedData {
    const fields = []

    // 基本情報
    if (character.characterName) {
      fields.push({ name: 'キャラクター名', value: character.characterName, inline: true })
    }

    // ステータス情報
    if (character.status) {
      try {
        const statusObj = typeof character.status === 'string' ? JSON.parse(character.status) : character.status
        Object.entries(statusObj).forEach(([key, value]) => {
          if (value) {
            fields.push({ name: key, value: String(value), inline: true })
          }
        })
      } catch {
        fields.push({ name: 'ステータス', value: String(character.status), inline: false })
      }
    }

    // スキル情報
    if (character.skill) {
      try {
        const skillObj = typeof character.skill === 'string' ? JSON.parse(character.skill) : character.skill
        const skillText = Object.entries(skillObj)
          .filter(([, value]) => value)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')

        if (skillText) {
          fields.push({ name: 'スキル', value: skillText, inline: false })
        }
      } catch {
        fields.push({ name: 'スキル', value: String(character.skill), inline: false })
      }
    }

    return {
      title: `🎭 キャラクター情報 - ${character.characterName || '未設定'}`,
      description: `サーバー: ${guildInfo.name}\nチャンネル: <#${character.discordChannelId}>`,
      color: 0x00ff00,
      fields
    }
  }
}
