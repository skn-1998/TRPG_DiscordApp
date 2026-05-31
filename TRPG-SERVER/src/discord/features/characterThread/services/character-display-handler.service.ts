/**
 * Character Display Handler Service
 *
 * キャラクター表示処理を担当する疎結合サービス
 * 表示タイプに応じて適切な表示処理を実行
 */

import { Injectable, Logger } from '@nestjs/common'
import { TextChannel, ThreadChannel } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { EventPayload } from '../../../../events/contracts'
import { DiscordClientService } from '../../../services/discord-client.service'
import { ErrorHandler } from '../../../../utils/error-handler'
import { CharacterDisplayService } from './character-display.service'

/**
 * キャラクター表示ハンドラーサービス
 *
 * discord.character.display.requested イベントを受信して
 * displayType に応じた表示処理を実行
 */
@Injectable()
export class CharacterDisplayHandlerService {
  private readonly logger = new Logger(CharacterDisplayHandlerService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly discordClientService: DiscordClientService,
    private readonly characterDisplayService: CharacterDisplayService
  ) {
    this.registerEventHandlers()
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    this.typedEventService.on('discord.character.display.requested', this.handleCharacterDisplayRequested.bind(this))

    this.logger.debug('Character Display Handler event handlers registered')
  }

  /**
   * キャラクター表示リクエストイベントの処理
   */
  private async handleCharacterDisplayRequested(
    payload: EventPayload<'discord.character.display.requested'>
  ): Promise<void> {
    try {
      const { character, channelId, displayType, requesterId, source } = payload

      this.logger.log(
        `Character display requested for: ${character.characterId}, channel: ${channelId}, displayType: ${displayType}, source: ${source}`
      )

      // displayTypeが'basic'または'compact'の場合に処理
      if (displayType === 'basic' || displayType === 'compact' || !displayType) {
        // Discord チャンネルを取得
        const discordClient = this.discordClientService.getClient()
        const channel = await discordClient.channels.fetch(channelId)
        if (!channel || !channel.isTextBased()) {
          this.logger.warn(`Channel not found or not text-based: ${channelId}`)
          throw new Error(`Invalid channel: ${channelId}`)
        }

        const textChannel = channel as TextChannel | ThreadChannel

        // 基本的なキャラクター表示
        await this.displayBasicCharacter(textChannel, character)

        // 成功イベントを発行
        await this.typedEventService.emit('discord.character.display.completed', {
          characterId: character.characterId,
          channelId,
          success: true,
          source: 'character-display-handler',
          timestamp: new Date()
        })
      } else {
        this.logger.log(`Skipping basic display for displayType: ${displayType}`)
        return
      }
    } catch (error) {
      this.logger.error('Failed to handle character display requested event', error)

      // 失敗イベントを発行
      await this.typedEventService.emit('discord.character.display.failed', {
        characterId: payload.character.characterId,
        channelId: payload.channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'character-display-handler',
        timestamp: new Date()
      })
    }
  }

  /**
   * 基本的なキャラクター表示
   */
  private async displayBasicCharacter(channel: TextChannel | ThreadChannel, character: Character): Promise<void> {
    try {
      this.logger.log(`Displaying basic character info for: ${character.characterId}`)

      // イベント駆動で基本的なキャラクター表示を実行
      await this.typedEventService.emit('discord.embed.character.update.requested', {
        character,
        channelId: channel.id,
        displayType: 'basic',
        source: 'character-display-handler',
        timestamp: new Date()
      })

      this.logger.log(`Basic character display completed for: ${character.characterId}`)
    } catch (error) {
      ErrorHandler.handleServiceError(
        error,
        {
          channelId: channel.id,
          characterId: character.characterId
        },
        'CharacterDisplayHandlerService.displayBasicCharacter'
      )
      throw error
    }
  }
}
