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
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { CharacterInputDto } from '../../../../domains/character/dto/create-character.dto'
import { CharacterCreationCoreService } from '../../../../domains/character/services/character-creation-core.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { EVENT_NAMES } from '../../../../events/contracts'
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

@Injectable()
export class CharacterEmbedManagerService {
  private readonly logger = new Logger(CharacterEmbedManagerService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly creationCore: CharacterCreationCoreService
  ) {}

  /**
   * キャラクター情報を分割Embedで表示
   */
  async createSectionedEmbeds(character: CharacterEntity): Promise<{
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
    character: CharacterEntity,
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
  ): Promise<CharacterEntity | null> {
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

      // キャラクター作成（イベント RPC を廃止し domain サービスへ直接委譲）
      // 注: characterId は event 経路と同じ意味論で domain 側が 'char_' プレフィックスで採番する
      const character = await this.creationCore.createValidated(createData)

      // 恒常購読者（CharacterCreationCompletedHandler 等）向けの通知は fire-and-forget で維持
      void this.typedEventService
        .emit(EVENT_NAMES.CHARACTER_CREATION_COMPLETED, {
          character,
          source: 'character-embed-manager',
          timestamp: new Date()
        })
        .catch((emitError) => {
          this.logger.error('Failed to emit character.creation.completed', emitError)
        })

      this.logger.log(`Character created successfully: ${character.characterId}`)
      return character
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
  createCharacterCreatedEmbed(character: CharacterEntity): EmbedBuilder {
    return buildCharacterCreatedEmbed(character)
  }
}
