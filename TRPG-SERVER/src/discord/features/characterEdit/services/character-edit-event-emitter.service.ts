/**
 * Character Edit Event Emitter Service
 *
 * EnhancedCharacterEditService が発火していた characterEdit.* イベント発行責務を集約する。
 * Discord interaction から必要な情報を取り出し TypedEventService 経由でイベントを発行する。
 * 発行に失敗してもログのみで握りつぶし、呼び出し元の処理を妨げない（現挙動を保存）。
 */

import { Injectable, Logger } from '@nestjs/common'
import { ButtonInteraction, ModalSubmitInteraction, CacheType } from 'discord.js'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { AttributeValue } from '../../../../core/types/attribute.types'
import { EVENT_NAMES } from '../../../../events/contracts'
import {
  extractCharacterIdFromCustomId,
  parseModalSubmitCustomId,
  normalizeSectionType
} from '../utils/enhanced-character-edit.util'

@Injectable()
export class CharacterEditEventEmitterService {
  private readonly logger = new Logger(CharacterEditEventEmitterService.name)

  constructor(private readonly typedEventService: TypedEventService) {}

  /**
   * モーダル開始イベント発火
   */
  async emitModalOpened(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const characterId = extractCharacterIdFromCustomId(interaction.customId)
      if (!characterId) return

      await this.typedEventService.emit(EVENT_NAMES.CHARACTER_EDIT_MODAL_OPENED, {
        characterId,
        userId: interaction.user.id,
        timestamp: new Date(),
        sessionId: `modal-${Date.now()}`,
        modal: {
          sectionType: 'basic' as const,
          fieldKey: 'characterName',
          currentValue: { name: '', values: {}, isVisible: true } as AttributeValue
        }
      })
    } catch (error) {
      this.logger.error('Failed to emit modal opened event', error)
    }
  }

  /**
   * モーダル送信イベント発火
   */
  async emitModalSubmitted(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    try {
      const { characterId, sectionType, fieldKey } = parseModalSubmitCustomId(interaction.customId)

      // モーダルから新しい値を取得
      const newValue =
        interaction.fields.getTextInputValue(`${sectionType}-${fieldKey}`) ||
        interaction.fields.getTextInputValue('character-name') ||
        interaction.fields.getTextInputValue('game-system') ||
        ''

      await this.typedEventService.emit(EVENT_NAMES.CHARACTER_EDIT_MODAL_SUBMITTED, {
        characterId,
        userId: interaction.user.id,
        timestamp: new Date(),
        sessionId: `modal-${Date.now()}`,
        modal: {
          sectionType: normalizeSectionType(sectionType),
          fieldKey,
          newValue: { name: newValue, values: {}, isVisible: true } as AttributeValue,
          oldValue: { name: '', values: {}, isVisible: true } as AttributeValue
        }
      })
    } catch (error) {
      this.logger.error('Failed to emit modal submitted event', error)
    }
  }

  /**
   * Embed更新リクエストイベント発火
   */
  async emitEmbedRefresh(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const characterId = extractCharacterIdFromCustomId(interaction.customId)
      if (!characterId) return

      await this.typedEventService.emit(EVENT_NAMES.CHARACTER_EDIT_EMBED_REFRESH_REQUESTED, {
        characterId,
        userId: interaction.user.id,
        timestamp: new Date(),
        sessionId: `embed-${Date.now()}`,
        embed: {
          channelId: interaction.channelId || '',
          embedType: 'enhanced' as const,
          section: 'status' as const
        }
      })
    } catch (error) {
      this.logger.error('Failed to emit embed refresh event', error)
    }
  }

  /**
   * エラーイベント発火
   */
  async emitError(error: any, customId: string, userId: string): Promise<void> {
    try {
      const characterId = extractCharacterIdFromCustomId(customId)

      await this.typedEventService.emit(EVENT_NAMES.CHARACTER_EDIT_ERROR_OCCURRED, {
        characterId: characterId || 'unknown',
        userId,
        timestamp: new Date(),
        error: {
          code: 'ENHANCED_CHARACTER_EDIT_ERROR',
          message: error.message || 'Unknown error',
          operation: customId,
          details: { customId, stack: error.stack },
          severity: 'medium'
        }
      })
    } catch (emitError) {
      this.logger.error('Failed to emit error event', emitError)
    }
  }
}
