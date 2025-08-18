import { Injectable } from '@nestjs/common'
import { EventHandler, EventContext } from './_shared/event-handler.base'
import { DiscordUIService } from '../../discord/services/discord-ui.service'
import { DiscordClientService } from '../../discord/services/discord-client.service'
import { CharacterCreationCompletedEvent } from '../contracts/unified-event-contracts'
import { TextChannel } from 'discord.js'
import { Character } from 'src/domains/character/models/character.model'

/**
 * character.creation.completed 専用ハンドラー
 *
 * 🎯 責務:
 * - キャラクター作成完了時のDiscord UI更新
 * - チャンネルEmbedの更新
 * - 作成完了通知の送信
 * - チャンネル名同期（Channel Orchestrator機能統合）
 */
@Injectable()
export class CharacterCreationCompletedHandler extends EventHandler<CharacterCreationCompletedEvent> {
  constructor(
    private readonly discordUIService: DiscordUIService,
    private readonly discordClientService: DiscordClientService
  ) {
    super()
  }

  /**
   * 処理するイベント名
   */
  getEventName(): string {
    return 'character.creation.completed'
  }

  /**
   * メイン処理
   */
  async handle(event: CharacterCreationCompletedEvent, context?: EventContext): Promise<void> {
    this.logger.log(`🎭 Processing character creation completed: ${event.character.characterName}`)

    try {
      // Discord UI更新処理
      await this.updateDiscordUI(event, context)

      this.logger.log(`✅ Character creation UI update completed: ${event.character.characterId}`)
    } catch (error) {
      this.logger.error(
        `❌ Character creation UI update failed: ${error instanceof Error ? error.message : String(error)}`
      )
      throw error
    }
  }

  /**
   * Discord UI更新処理
   */
  private async updateDiscordUI(event: CharacterCreationCompletedEvent, context?: EventContext): Promise<void> {
    const { character } = event

    // 0. チャンネル名の同期（Channel Orchestrator機能統合）
    if (character.discordChannelId) {
      await this.syncChannelNameWithCharacter(character.discordChannelId, character.characterName)
    }

    // 1. チャンネルが存在する場合、セレクトメニュー付きEmbedを作成
    if (character.discordChannelId) {
      this.logger.debug(`Creating character embed with select menu in channel: ${character.discordChannelId}`)

      try {
        // DiscordUIServiceを使用してセレクトメニュー付きEmbedを作成
        await this.discordUIService.sendCharacterEmbedWithSelectMenu(
          character.discordChannelId,
          character as Character,
          character.discordUserId
        )

        this.logger.debug(`✅ Character embed with select menu created successfully`)
      } catch (error) {
        this.logger.warn(
          `⚠️ Character embed creation failed: ${error instanceof Error ? error.message : String(error)}`
        )
        // Embed作成の失敗は致命的ではないため、処理を続行
      }
    }

    // 2. 作成完了通知の送信（チャンネルが存在する場合）
    if (character.discordChannelId) {
      try {
        await this.discordUIService.sendCharacterCreationNotification(
          character.discordChannelId,
          character as any,
          character.discordUserId
        )
        this.logger.debug(`✅ Creation notification sent successfully`)
      } catch (error) {
        this.logger.warn(`⚠️ Creation notification failed: ${error instanceof Error ? error.message : String(error)}`)
        // 通知の失敗は致命的ではないため、処理を続行
      }
    }

    // 3. ウェルカムメッセージの送信（新規作成時）
    if (character.discordChannelId && character.discordUserId) {
      try {
        await this.discordUIService.sendWelcomeMessage(
          character.discordChannelId,
          character.discordUserId,
          character.characterName
        )
        this.logger.debug(`✅ Welcome message sent successfully`)
      } catch (error) {
        this.logger.warn(`⚠️ Welcome message failed: ${error instanceof Error ? error.message : String(error)}`)
        // ウェルカムメッセージの失敗は致命的ではないため、処理を続行
      }
    }
  }

  /**
   * リトライ可能エラーの判定
   */
  protected isRetryableError(error: Error): boolean {
    // Discord API関連のエラーはリトライ可能
    if (error.message.includes('Discord') || error.message.includes('API')) {
      return true
    }

    return super.isRetryableError(error)
  }

  /**
   * 最大リトライ回数
   */
  protected getMaxRetries(): number {
    return 2 // Discord API呼び出しのため控えめに設定
  }

  /**
   * チャンネル名をキャラクター名に同期（Channel Orchestrator機能統合）
   */
  private async syncChannelNameWithCharacter(channelId: string, characterName: string): Promise<void> {
    try {
      const client = this.discordClientService.getClient()
      if (!client) {
        this.logger.warn('Discord client not available for channel name sync')
        return
      }

      const channel = await client.channels.fetch(channelId)
      if (!channel || !channel.isTextBased()) {
        this.logger.warn(`チャンネルが見つかりません: ${channelId}`)
        return
      }

      const textChannel = channel as TextChannel
      const sanitizedChannelName = this.sanitizeChannelName(characterName)

      if (textChannel.name !== sanitizedChannelName) {
        await textChannel.setName(sanitizedChannelName, `キャラクター名を反映: ${characterName}`)
        this.logger.log(`チャンネル名をキャラクター名に同期しました: ${characterName} → ${sanitizedChannelName}`)
      } else {
        this.logger.debug(`チャンネル名は既に同期済み: ${sanitizedChannelName}`)
      }
    } catch (error) {
      this.logger.warn(`チャンネル名の同期に失敗しました: ${characterName}`, error)
      // チャンネル名の同期失敗は致命的ではないため、エラーを再スローしない
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
      sanitized = 'character'
    }

    return sanitized
  }
}
