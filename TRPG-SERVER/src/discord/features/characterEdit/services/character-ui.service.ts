import { Injectable, Logger } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { DiscordClientService } from '../../../services/discord-client.service'
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import {
  CHARACTER_EMBED_TITLE_KEYWORD,
  GuildInfo,
  buildCharacterEmbed,
  buildCharacterEmbedData
} from '../utils/character-ui.util'

/**
 * キャラクター関連のDiscord UI操作サービス
 * キャラクター機能専用のUI操作を担当
 *
 * 純粋な構築ロジック（embed / select menu / 文言整形）は character-ui.util.ts に分離し、
 * 本サービスは channel 取得・送信・編集などの Discord I/O オーケストレーションを担う。
 */
@Injectable()
export class CharacterUIService {
  private readonly logger = new Logger(CharacterUIService.name)

  constructor(private readonly discordClientService: DiscordClientService) {}

  /**
   * キャラクターEmbedの更新
   */
  async updateCharacterEmbed(channelId: string, character: CharacterEntity): Promise<void> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        throw new Error('Discord client not available')
      }

      const channel = (await client.channels.fetch(channelId)) as TextChannel
      if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid text channel')
      }

      // 既存のEmbedメッセージを検索（ボットが送信したメッセージの中から）
      const messages = await channel.messages.fetch({ limit: 50 })
      const embedMessage = messages.find(
        (msg) =>
          msg.author.id === client.user?.id &&
          msg.embeds.length > 0 &&
          msg.embeds[0].title?.includes(CHARACTER_EMBED_TITLE_KEYWORD)
      )

      // 簡易的なguildInfo作成（getGuildInfoメソッドが見つからないため）
      const guildInfo: GuildInfo = {
        id: '',
        name: 'TRPG Server',
        memberCount: 0,
        channels: []
      }
      const embed = buildCharacterEmbed(buildCharacterEmbedData(character, guildInfo), true)

      if (embedMessage) {
        // 既存のEmbedを更新
        await embedMessage.edit({ embeds: [embed] })
        this.logger.debug('Character embed updated')
      } else {
        // 新しいEmbedメッセージを送信
        await channel.send({ embeds: [embed] })
        this.logger.debug('New character embed created')
      }
    } catch (error) {
      this.logger.error('Failed to update character embed', error)
      throw error
    }
  }
}
