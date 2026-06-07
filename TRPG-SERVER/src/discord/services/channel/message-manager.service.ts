import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  TextChannel,
  NewsChannel,
  ThreadChannel,
  Message,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder
} from 'discord.js'
import { ErrorHandler } from '../../../core/http/error-handler'

/**
 * メッセージ管理サービス
 *
 * 責務：
 * - メッセージ送信・編集・削除
 * - Embed・コンポーネント管理
 * - メッセージ履歴操作
 */
@Injectable()
export class MessageManagerService {
  private readonly logger = new Logger(MessageManagerService.name)

  constructor() {
    this.logger.debug('Message manager service initialized')
  }

  /**
   * メッセージを送信
   */
  async sendMessage(
    client: Client,
    channelId: string,
    content: string,
    options?: {
      embeds?: EmbedBuilder[]
      components?: ActionRowBuilder<ButtonBuilder>[]
      files?: any[]
      ephemeral?: boolean
    }
  ): Promise<Message> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased()) {
        throw new Error(`Channel ${channelId} is not text-based`)
      }

      const messageOptions: any = {}

      if (content) {
        messageOptions.content = content
      }

      if (options?.embeds) {
        messageOptions.embeds = options.embeds
      }

      if (options?.components) {
        messageOptions.components = options.components
      }

      if (options?.files) {
        messageOptions.files = options.files
      }

      const message = await (channel as TextChannel | NewsChannel | ThreadChannel).send(messageOptions)

      this.logger.debug(`Message sent successfully: ${message.id} to channel ${channelId}`)
      return message
    } catch (error) {
      this.logger.error(`Failed to send message to channel ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          content: content?.substring(0, 100),
          hasEmbeds: !!options?.embeds?.length,
          hasComponents: !!options?.components?.length
        },
        'MessageManagerService'
      )

      throw error
    }
  }

  /**
   * メッセージを編集
   */
  async editMessage(
    client: Client,
    channelId: string,
    messageId: string,
    content?: string,
    options?: {
      embeds?: EmbedBuilder[]
      components?: ActionRowBuilder<ButtonBuilder>[]
    }
  ): Promise<Message> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased()) {
        throw new Error(`Channel ${channelId} is not text-based`)
      }

      const message = await (channel as TextChannel | NewsChannel | ThreadChannel).messages.fetch(messageId)

      const editOptions: any = {}

      if (content !== undefined) {
        editOptions.content = content
      }

      if (options?.embeds) {
        editOptions.embeds = options.embeds
      }

      if (options?.components) {
        editOptions.components = options.components
      }

      const editedMessage = await message.edit(editOptions)

      this.logger.debug(`Message edited successfully: ${messageId} in channel ${channelId}`)
      return editedMessage
    } catch (error) {
      this.logger.error(`Failed to edit message ${messageId} in channel ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          messageId,
          hasContent: !!content,
          hasEmbeds: !!options?.embeds?.length
        },
        'MessageManagerService'
      )

      throw error
    }
  }

  /**
   * メッセージを削除
   */
  async deleteMessage(client: Client, channelId: string, messageId: string): Promise<void> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased()) {
        throw new Error(`Channel ${channelId} is not text-based`)
      }

      const message = await (channel as TextChannel | NewsChannel | ThreadChannel).messages.fetch(messageId)
      await message.delete()

      this.logger.debug(`Message deleted successfully: ${messageId} from channel ${channelId}`)
    } catch (error) {
      this.logger.error(`Failed to delete message ${messageId} from channel ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          messageId
        },
        'MessageManagerService'
      )

      throw error
    }
  }

  /**
   * 複数のメッセージを一括削除
   */
  async deleteMessages(client: Client, channelId: string, messageIds: string[], reason?: string): Promise<void> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased()) {
        throw new Error(`Channel ${channelId} is not text-based`)
      }

      const textChannel = channel as TextChannel | NewsChannel | ThreadChannel

      // Discord APIの制限：一度に削除できるのは100件まで
      const batchSize = 100
      const batches: string[][] = []

      for (let i = 0; i < messageIds.length; i += batchSize) {
        batches.push(messageIds.slice(i, i + batchSize))
      }

      for (const batch of batches) {
        if (batch.length === 1) {
          // 単一メッセージの場合は個別削除
          await this.deleteMessage(client, channelId, batch[0])
        } else {
          // 複数メッセージの場合は一括削除
          await textChannel.bulkDelete(batch, true)
        }
      }

      this.logger.debug(`Bulk deleted ${messageIds.length} messages from channel ${channelId}`)
    } catch (error) {
      this.logger.error(`Failed to bulk delete messages from channel ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          messageCount: messageIds.length,
          reason
        },
        'MessageManagerService'
      )

      throw error
    }
  }

  /**
   * 古いメッセージを削除（日数指定）
   */
  async deleteOldMessages(client: Client, channelId: string, daysOld: number, limit: number = 100): Promise<number> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased()) {
        throw new Error(`Channel ${channelId} is not text-based`)
      }

      const textChannel = channel as TextChannel | NewsChannel | ThreadChannel
      const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000

      const messages = await textChannel.messages.fetch({ limit })
      const oldMessages = messages.filter((message) => message.createdTimestamp < cutoffTime)

      if (oldMessages.size === 0) {
        return 0
      }

      const messageIds = oldMessages.map((message) => message.id)
      await this.deleteMessages(client, channelId, messageIds, `Cleanup: older than ${daysOld} days`)

      this.logger.debug(`Deleted ${oldMessages.size} old messages from channel ${channelId}`)
      return oldMessages.size
    } catch (error) {
      this.logger.error(`Failed to delete old messages from channel ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          daysOld,
          limit
        },
        'MessageManagerService'
      )

      throw error
    }
  }

  /**
   * メッセージ履歴を取得（基本実装）
   */
  async getMessageHistory(
    client: Client,
    channelId: string,
    options?: {
      limit?: number
    }
  ): Promise<any[]> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased()) {
        throw new Error(`Channel ${channelId} is not text-based`)
      }

      const limit = options?.limit || 50
      const messages = await (channel as TextChannel | NewsChannel | ThreadChannel).messages.fetch({ limit })

      // Collectionを配列に変換
      const messageArray: any[] = []
      messages.forEach((message) => {
        messageArray.push(message)
      })

      this.logger.debug(`Retrieved ${messageArray.length} messages from channel ${channelId}`)
      return messageArray
    } catch (error) {
      this.logger.error(`Failed to get message history from channel ${channelId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          limit: options?.limit
        },
        'MessageManagerService'
      )

      throw error
    }
  }

  /**
   * メッセージにリアクションを追加
   */
  async addReaction(client: Client, channelId: string, messageId: string, emoji: string): Promise<void> {
    try {
      const channel = await client.channels.fetch(channelId)

      if (!channel?.isTextBased()) {
        throw new Error(`Channel ${channelId} is not text-based`)
      }

      const message = await (channel as TextChannel | NewsChannel | ThreadChannel).messages.fetch(messageId)
      await message.react(emoji)

      this.logger.debug(`Added reaction ${emoji} to message ${messageId} in channel ${channelId}`)
    } catch (error) {
      this.logger.error(`Failed to add reaction to message ${messageId}`, error)

      ErrorHandler.handleServiceError(
        error,
        {
          channelId,
          messageId,
          emoji
        },
        'MessageManagerService'
      )

      throw error
    }
  }
}
