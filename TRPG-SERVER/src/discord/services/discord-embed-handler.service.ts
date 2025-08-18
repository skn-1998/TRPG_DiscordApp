import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../shared/application/typed-event.service'
import { DiscordService } from '../discord.service'
import { EventPayload } from '../../shared/domain/events/event-contracts'

/**
 * Discord Embed更新ハンドラーサービス
 * TypedEventServiceからのDiscord embed関連イベントを処理
 */
@Injectable()
export class DiscordEmbedHandlerService implements OnModuleInit {
  private readonly logger = new Logger(DiscordEmbedHandlerService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly discordService: DiscordService
  ) {}

  /**
   * モジュール初期化時にイベントハンドラーを登録
   */
  async onModuleInit(): Promise<void> {
    this.registerEventHandlers()
    this.logger.log('Discord Embed Handler Service initialized')
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    // Discord Character Embed更新リクエストハンドラー
    this.typedEventService.on(
      'discord.embed.character.update.requested',
      this.handleCharacterEmbedUpdateRequest.bind(this)
    )

    this.logger.debug('Discord embed event handlers registered')
  }

  /**
   * Character Embed更新リクエストを処理
   */
  private async handleCharacterEmbedUpdateRequest(
    payload: EventPayload<'discord.embed.character.update.requested'>
  ): Promise<void> {
    const { character, channelId, source } = payload

    this.logger.log(`[DISCORD-EMBED] Character embed update requested: ${character.characterId} from ${source}`)

    try {
      // ギルド情報を取得
      const guildInfo = await this.discordService.getChannelInfo(channelId)
      if (!guildInfo) {
        await this.emitUpdateFailed(character.characterId, channelId, 'チャンネル情報を取得できませんでした', source)
        return
      }

      // ギルドの詳細情報を取得
      const guildDetails = await this.discordService.getGuildInfo(guildInfo.guild.id)
      if (!guildDetails) {
        await this.emitUpdateFailed(character.characterId, channelId, 'ギルド情報を取得できませんでした', source)
        return
      }

      // 🚨 DEPRECATED: この中間処理は冗長です
      // File-based Event Handlersが直接DiscordUIServiceを呼び出すため、この中間レイヤーは不要

      this.logger.warn(
        `[DISCORD-EMBED] DEPRECATED: この処理はFile-based Event Handlersにより自動処理されます: ${character.characterId}`
      )

      // 互換性のため成功イベントを発行（実際の処理は行わない）
      await this.emitUpdateCompleted(character.characterId, channelId, true, source)
    } catch (error) {
      const errorMessage = (error as Error).message
      this.logger.error(`[DISCORD-EMBED] Error updating character embed: ${errorMessage}`)
      await this.emitUpdateFailed(character.characterId, channelId, errorMessage, source)
    }
  }

  /**
   * 更新完了イベントを発行
   */
  private async emitUpdateCompleted(
    characterId: string,
    channelId: string,
    success: boolean,
    source: string
  ): Promise<void> {
    await this.typedEventService.emit('discord.embed.character.update.completed', {
      characterId,
      channelId,
      success,
      source,
      timestamp: new Date()
    })
  }

  /**
   * 更新失敗イベントを発行
   */
  private async emitUpdateFailed(characterId: string, channelId: string, error: string, source: string): Promise<void> {
    await this.typedEventService.emit('discord.embed.character.update.failed', {
      characterId,
      channelId,
      error,
      source,
      timestamp: new Date()
    })
  }
}
