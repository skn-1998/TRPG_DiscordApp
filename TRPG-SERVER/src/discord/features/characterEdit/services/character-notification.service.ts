import { Injectable, Logger } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { generateAppConfig } from 'src/config/configuration'

// ============================================================================
// Character Notification Service
// ============================================================================

@Injectable()
export class CharacterNotificationService {
  private readonly logger = new Logger(CharacterNotificationService.name)

  constructor() {
    // 自己完結型：Discord依存関係なしで動作
  }

  /**
   * キャラクター作成通知とUI表示
   */
  async notifyCharacterCreation(channel: TextChannel, characterId: string, characterName: string): Promise<void> {
    try {
      const clientUrl = generateAppConfig().app.frontendUrl
      const url = `${clientUrl}/characters/${characterId}`
      await channel.send({
        content: url
      })

      this.logger.log(`キャラクター「${characterName}」の通知を送信しました`)
    } catch (error) {
      this.logger.error('キャラクター通知エラー:', error)
      throw error
    }
  }

}
