import { Injectable, Logger } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ErrorHandler } from '../../../../utils/error-handler'

/**
 * チャンネル名同期サービス
 *
 * キャラクター名とDiscordチャンネル名を同期する
 */
@Injectable()
export class ChannelNameSyncService {
  private readonly logger = new Logger(ChannelNameSyncService.name)

  constructor(private readonly typedEventService: TypedEventService) {}

  /**
   * チャンネル名をキャラクター名に同期
   */
  async syncChannelNameToCharacter(channel: TextChannel, character: Character): Promise<boolean> {
    try {
      this.logger.log(`Syncing channel name to character: ${character.characterName}`)

      // チャンネル名をキャラクター名に変更
      const sanitizedName = this.sanitizeChannelName(character.characterName)

      if (channel.name === sanitizedName) {
        this.logger.log(`Channel name already matches: ${sanitizedName}`)
        return true
      }

      await channel.setName(sanitizedName, `キャラクター名を反映: ${character.characterName}`)

      // DB更新: characterテーブルのdiscordChannelIdが正しく設定されていることを確認
      await this.updateCharacterChannelInfo(character, channel.id)

      this.logger.log(`Channel name updated: ${channel.name} → ${sanitizedName}`)
      return true
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          channelId: channel.id,
          characterId: character.characterId,
          channelName: character.characterName
        },
        'ChannelNameSyncService.syncChannelNameToCharacter'
      )
      return false
    }
  }

  /**
   * キャラクター情報を更新してチャンネルIDを設定
   */
  private async updateCharacterChannelInfo(character: Character, channelId: string): Promise<boolean> {
    try {
      if (character.discordChannelId === channelId) {
        return true // 既に設定済み
      }

      // キャラクター更新イベントを発行
      await this.typedEventService.emit('character.update.requested', {
        channelId: character.discordChannelId || channelId,
        updateData: {
          discordChannelId: channelId
        },
        userId: character.discordUserId,
        source: 'channel-name-sync',
        timestamp: new Date()
      })

      // 更新完了を待機
      const result = await Promise.race([
        this.typedEventService.waitForEvent('character.update.completed', 5000),
        this.typedEventService.waitForEvent('character.update.failed', 5000)
      ])

      if ('character' in result) {
        this.logger.log(`Character channel info updated: ${character.characterId}`)
        return true
      } else {
        this.logger.error(`Character channel info update failed: ${character.characterId}`, result)
        return false
      }
    } catch (error) {
      this.logger.error('Failed to update character channel info', error)
      return false
    }
  }

  /**
   * チャンネル名をDiscordの制約に合わせてサニタイズ
   */
  private sanitizeChannelName(characterName: string): string {
    // Discordチャンネル名の制約:
    // - 2-100文字
    // - 小文字、数字、ハイフン、アンダースコア、日本語のみ
    // - スペースは使用不可
    let sanitized = characterName
      .toLowerCase()
      .replace(/\s+/g, '-') // スペースをハイフンに変換
      .replace(/[^\w\-ぁ-んァ-ヶー一-龯]/g, '') // 無効文字を除去
      .slice(0, 100) // 最大100文字

    // 最低2文字必要
    if (sanitized.length < 2) {
      sanitized = `character-${sanitized}`.slice(0, 100)
    }

    // ハイフンで開始・終了することはできない
    sanitized = sanitized.replace(/^-+|-+$/g, '')
    if (sanitized.length < 2) {
      sanitized = 'character-ch'
    }

    return sanitized
  }

  /**
   * キャラクターIDからキャラクター情報を取得
   */
  async getCharacterById(characterId: string): Promise<Character | null> {
    try {
      // CharacterServiceを直接注入して使用する必要があります
      // 現在はTypedEventServiceのみ注入されているため、
      // 一旦 null を返してエラーを回避
      this.logger.warn(`getCharacterById not implemented yet for ID: ${characterId}`)
      return null
    } catch (error) {
      this.logger.error(`Failed to get character by ID: ${characterId}`, error)
      return null
    }
  }

  /**
   * チャンネルIDからキャラクター情報を取得
   */
  async getCharacterByChannelId(channelId: string): Promise<Character | null> {
    try {
      await this.typedEventService.emit('character.findByChannelId.requested', {
        channelId,
        source: 'channel-name-sync',
        timestamp: new Date()
      })

      const result = await Promise.race([
        this.typedEventService.waitForEvent('character.findByChannelId.completed', 5000),
        this.typedEventService.waitForEvent('character.findByChannelId.failed', 5000)
      ])

      if ('character' in result && result.character) {
        return result.character
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to get character by channel ID: ${channelId}`, error)
      return null
    }
  }
}
