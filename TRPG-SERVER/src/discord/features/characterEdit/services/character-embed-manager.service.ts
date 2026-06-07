/**
 * Character Embed Manager Service
 *
 * キャラクター情報を分割Embedで管理するサービス。
 *
 * Embed / ボタン / セレクトメニューの整形ロジックは純粋関数として
 * `../utils/character-embed.util` に抽出済み（Character → Builder を返すだけ）。
 * このサービスは副作用（channel.send / typedEventService.emit）と、
 * 純粋関数への委譲（オーケストレーション）のみを担う。
 */

import { Injectable, Logger } from '@nestjs/common'
import { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { CharacterInputDto } from '../../../../domains/character/dto/create-character.dto'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { ErrorHandler } from '../../../../core/http/error-handler'
import {
  generateShortCharacterId,
  buildSectionedEmbeds,
  buildFieldSelectMenu,
  buildNewCharacterEmbed,
  buildCharacterCreatedEmbed,
  EmbedSectionType
} from '../utils/character-embed.util'

// 既存の import 互換のため re-export（型の正本は util 側）
export { EmbedSectionType }

/**
 * キャラクター編集アクション
 */
export interface CharacterEditAction {
  type: 'add' | 'edit' | 'delete'
  section: EmbedSectionType
  field?: string
}

@Injectable()
export class CharacterEmbedManagerService {
  private readonly logger = new Logger(CharacterEmbedManagerService.name)

  constructor(private readonly typedEventService: TypedEventService) {}

  /**
   * キャラクター情報を分割Embedで表示
   */
  async createSectionedEmbeds(character: Character): Promise<{
    embeds: EmbedBuilder[]
    components: ActionRowBuilder<any>[]
  }> {
    try {
      return buildSectionedEmbeds(character)
    } catch (error) {
      ErrorHandler.handleServiceError(error, { characterId: character.characterId }, 'CharacterEmbedManagerService')
      throw error
    }
  }

  /**
   * 特定セクションのフィールド選択メニューを作成
   */
  createFieldSelectMenu(
    character: Character,
    sectionType: EmbedSectionType,
    characterId: string
  ): StringSelectMenuBuilder | null {
    return buildFieldSelectMenu(character, sectionType, characterId)
  }

  /**
   * 新規キャラクター作成
   */
  async createCharacter(
    characterData: CharacterInputDto,
    channelId: string,
    userId: string
  ): Promise<Character | null> {
    try {
      this.logger.log(`Creating new character: ${characterData.characterName} for user: ${userId}`)

      // CharacterInputDtoからCreateCharacterDtoに変換
      const createData = {
        characterId: characterData.characterId || generateShortCharacterId(),
        characterName: characterData.characterName || '',
        gameSystemId: characterData.gameSystemId || '',
        discordUserId: userId,
        discordChannelId: channelId,
        status: characterData.status,
        parameter: characterData.parameter,
        skill: characterData.skill,
        item: characterData.item,
        description: characterData.description
      }

      // キャラクター作成イベントを発行 (Event Bridge対応)
      await this.typedEventService.emit('character.creation.requested', {
        createData,
        requester: {
          featureId: 'characterEdit',
          context: {
            channelId: channelId,
            sectionType: 'basic',
            triggeredBy: 'modal' // embed manager経由はモーダル入力
          }
        },
        userId,
        source: 'character-embed-manager',
        timestamp: new Date()
      })

      // 作成完了を待機
      const result = await Promise.race([
        this.typedEventService.waitForEvent('character.creation.completed', 10000),
        this.typedEventService.waitForEvent('character.creation.failed', 10000)
      ])

      if ('character' in result) {
        this.logger.log(`Character created successfully: ${result.character.characterId}`)
        return result.character
      } else {
        this.logger.error(`Character creation failed:`, result)
        return null
      }
    } catch (error) {
      this.logger.error('Failed to create character', error)
      return null
    }
  }

  /**
   * 新規キャラクター作成用のEmbedを作成
   */
  createNewCharacterEmbed(
    channelId: string,
    userId: string
  ): {
    embeds: EmbedBuilder[]
    components: ActionRowBuilder<any>[]
  } {
    return buildNewCharacterEmbed(channelId, userId)
  }

  /**
   * キャラクター作成完了メッセージ
   */
  createCharacterCreatedEmbed(character: Character): EmbedBuilder {
    return buildCharacterCreatedEmbed(character)
  }
}
