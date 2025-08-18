import { Injectable, Logger } from '@nestjs/common'
import { Client, ThreadChannel, EmbedBuilder } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
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
    character: Character,
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
  private async postEnhancedCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${character.characterName}`)
      .setDescription(`**ゲームシステム**: ${character.gameSystemId || '未設定'}`)
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

    await thread.send({ embeds: [embed] })
  }

  /**
   * コンパクト表示：最小限の情報
   */
  private async postCompactCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${character.characterName}`)
      .setDescription(`**${character.gameSystemId || 'システム未設定'}**`)
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
  private async postBasicCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(`🎭 ${character.characterName}`)
      .setDescription(`**ゲームシステム**: ${character.gameSystemId || '未設定'}`)
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
  async postCharacterInfo(thread: ThreadChannel, character: Character, userName?: string): Promise<void> {
    this.logger.debug(`Posting character info: ${character.characterName}`)
    await this.postCharacterDisplay(thread, character, 'enhanced')
  }

  /**
   * キャラクター表示の更新
   */
  async updateCharacterDisplay(character: Character): Promise<void> {
    try {
      if (!character.threadId) {
        this.logger.warn(`No thread ID found for character: ${character.characterId}`)
        return
      }

      const thread = await this.discordClient.channels.fetch(character.threadId)
      if (!thread?.isThread()) {
        this.logger.warn(`Thread not found or invalid: ${character.threadId}`)
        return
      }

      // 既存のメッセージを削除して新しい表示を投稿
      // （実装の簡素化のため、新しいメッセージを投稿）
      await this.postCharacterDisplay(thread as ThreadChannel, character, 'enhanced')

      this.logger.debug(`Character display updated: ${character.characterName}`)
    } catch (error) {
      this.logger.error(`Failed to update character display: ${character.characterName}`, error)
      throw error
    }
  }
}
