/**
 * Character Edit Message Updater Service
 *
 * refresh ボタン押下時またはモーダル保存後に、チャンネル内の既存 characterEdit メッセージを探して
 * 編集（edit）する責務を担う。見つからない場合は新規送信にフォールバックする。
 * Discord チャンネルのメッセージ走査という副作用を呼び出し元から分離する。
 */

import { Injectable, Logger } from '@nestjs/common'
import { ButtonInteraction, ModalSubmitInteraction, TextChannel, Message, Collection, CacheType } from 'discord.js'
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { ErrorHandler } from '../../../../core/http/error-handler'
import { CharacterEmbedManagerService } from './character-embed-manager.service'
import { messageHasCharacterEditButtons, MessageLike } from '../utils/enhanced-character-edit.util'

@Injectable()
export class CharacterEditMessageUpdaterService {
  private readonly logger = new Logger(CharacterEditMessageUpdaterService.name)

  constructor(private readonly embedManager: CharacterEmbedManagerService) {}

  /**
   * 既存のcharacterEditEmbedを更新する
   */
  async updateExistingCharacterEditEmbed(
    character: CharacterEntity,
    interaction: ButtonInteraction<CacheType> | ModalSubmitInteraction<CacheType>
  ): Promise<void> {
    try {
      if (!interaction.channel || !('messages' in interaction.channel)) {
        this.logger.warn('Channel does not support message fetching')
        return
      }

      const textChannel = interaction.channel as TextChannel

      // 最近の50メッセージを取得してcharacterEditEmbedを探す
      const messages = await textChannel.messages.fetch({ limit: 50 })
      const characterEditMessage = this.findCharacterEditMessage(messages, character.characterId)

      if (characterEditMessage) {
        // 既存メッセージを更新
        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)

        await characterEditMessage.edit({
          content: `🔄 ${character.characterName}の情報を更新しました`,
          embeds,
          components
        })

        this.logger.log(`Updated existing characterEdit embed for character: ${character.characterId}`)
      } else {
        // 既存メッセージが見つからない場合は新規送信
        this.logger.warn(
          `No existing characterEdit message found for character: ${character.characterId}, sending new message`
        )

        const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)
        // NOTE: 状態選択契約の意図的例外 - ここで復旧するのは interaction 応答ではなく、
        // 全員が参照する共有チャンネルの characterEdit embed。reply/followUp は送らない。
        await textChannel.send({
          content: `🔄 ${character.characterName}の情報を更新しました`,
          embeds,
          components
        })
      }
    } catch (error) {
      // フォールバック: 新しいメッセージを送信
      try {
        if (interaction.channel && 'send' in interaction.channel) {
          const { embeds, components } = await this.embedManager.createSectionedEmbeds(character)
          // NOTE: 状態選択契約の意図的例外 - interaction 応答を増やさず、共有 embed だけを復旧する。
          await (interaction.channel as TextChannel).send({
            content: `🔄 ${character.characterName}の情報を更新しました`,
            embeds,
            components
          })
        }
      } catch (fallbackError) {
        this.logger.warn('Fallback message sending also failed', fallbackError)
      }

      ErrorHandler.handleServiceError(
        error,
        {
          characterId: character.characterId,
          userId: interaction.user.id
        },
        'EnhancedCharacterEditService.updateExistingCharacterEditEmbed'
      )
    }
  }

  /**
   * CharacterEditメッセージを検索
   */
  private findCharacterEditMessage(messages: Collection<string, Message>, characterId: string): Message | null {
    for (const message of messages.values()) {
      if (messageHasCharacterEditButtons(message as unknown as MessageLike, characterId)) {
        return message
      }
    }

    return null
  }
}
