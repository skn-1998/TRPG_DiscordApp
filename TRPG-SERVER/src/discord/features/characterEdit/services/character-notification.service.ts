import { Injectable, Logger } from '@nestjs/common'
import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, TextChannel } from 'discord.js'
import { generateAppConfig } from 'src/config/configuration'
import { characterEditIds } from '../events/character-edit.ids'

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

      // セレクトメニューを直接作成（自己完結型）
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(characterEditIds.changeCharacterInfo.customId)
        .setPlaceholder(characterEditIds.changeCharacterInfo.placeholder)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('ステータス').setValue('status'),
          new StringSelectMenuOptionBuilder().setLabel('パラメータ').setValue('parameter'),
          new StringSelectMenuOptionBuilder().setLabel('スキル').setValue('skill')
        )

      const selectComponent = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await channel.send({
        content: url,
        components: [selectComponent]
      })

      this.logger.log(`キャラクター「${characterName}」の通知を送信しました`)
    } catch (error) {
      this.logger.error('キャラクター通知エラー:', error)
      throw error
    }
  }

  /**
   * キャラクター作成完了通知（イベント統合サービス用）
   */
  async notifyCharacterCreated(characterId: string, channelId: string, creatorId: string): Promise<void> {
    try {
      const clientUrl = generateAppConfig().app.frontendUrl
      const url = `${clientUrl}/characters/${characterId}`

      this.logger.log(`キャラクター作成完了通知: ${characterId}`)
      // 実際の通知処理は必要に応じて実装
    } catch (error) {
      this.logger.error('キャラクター作成完了通知エラー:', error)
      throw error
    }
  }

  /**
   * キャラクターEmbed更新（イベント統合サービス用）
   */
  async updateCharacterEmbed(
    characterId: string,
    channelId: string,
    updateType: 'status' | 'parameter' | 'skill' | 'full'
  ): Promise<void> {
    try {
      this.logger.log(`キャラクターEmbed更新: ${characterId} (${updateType})`)
      // 実際のEmbed更新処理は必要に応じて実装
    } catch (error) {
      this.logger.error('キャラクターEmbed更新エラー:', error)
      throw error
    }
  }
}
