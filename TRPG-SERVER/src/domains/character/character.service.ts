import { Injectable, Logger } from '@nestjs/common'
import { CharacterRepository } from './repositories/character.repository'
import { CharacterInputDto, AttributeValueDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import { Character, UpdatePrimary } from './models/character.model'
// UserService依存削除 - Character Service単一責任原則の強化
// AppConfigService依存削除 - EventDriven分岐を削除し単純化
// DiscordIntegrationService依存を完全削除 - イベント駆動アーキテクチャに移行
import { TypedEventService } from '../../core/events/typed-event.service'
import { AttributeValue, AttributeSection } from '../../core/types/attribute.types'

/**
 * キャラクターサービス
 * キャラクター情報のCRUD操作を提供する
 */
@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name)

  /**
   * AttributeValueDto を AttributeValue に変換
   */
  private convertDtoToAttributeValue(dto: AttributeValueDto): AttributeValue {
    return {
      name: dto.name,
      index: dto.index,
      values: dto.values || {},
      description: dto.description,
      isVisible: dto.isVisible
    }
  }

  /**
   * DTO セクションを AttributeSection に変換
   */
  private convertDtoSectionToAttributeSection(dtoSection?: Record<string, AttributeValueDto>): AttributeSection {
    if (!dtoSection) return {}

    const section: AttributeSection = {}
    for (const [key, value] of Object.entries(dtoSection)) {
      section[key] = this.convertDtoToAttributeValue(value)
    }
    return section
  }

  /**
   * UpdateCharacterDto を Character 形式に変換
   */
  private convertUpdateDtoToCharacter(dto: UpdateCharacterDto): Partial<Character> {
    const converted: Partial<Character> = {}

    if (dto.characterName !== undefined) converted.characterName = dto.characterName
    if (dto.gameSystemId !== undefined) converted.gameSystemId = dto.gameSystemId
    if (dto.discordChannelId !== undefined) converted.discordChannelId = dto.discordChannelId
    if (dto.discordThreadId !== undefined) converted.discordThreadId = dto.discordThreadId
    if (dto.status !== undefined) converted.status = this.convertDtoSectionToAttributeSection(dto.status)
    if (dto.skill !== undefined) converted.skill = this.convertDtoSectionToAttributeSection(dto.skill)
    if (dto.parameter !== undefined) converted.parameter = this.convertDtoSectionToAttributeSection(dto.parameter)
    if (dto.item !== undefined) converted.item = this.convertDtoSectionToAttributeSection(dto.item)
    if (dto.description !== undefined) converted.description = this.convertDtoSectionToAttributeSection(dto.description)

    return converted
  }

  constructor(
    private readonly characterRepository: CharacterRepository,
    // UserService依存削除 - Character Service単一責任原則の強化
    // DiscordIntegrationService依存を完全削除 - イベント駆動アーキテクチャに移行
    private readonly typedEventService: TypedEventService
  ) {}

  /**
   * キャラクターを作成する（型安全性強化版）
   * @param createCharacterDto キャラクター作成DTO（完全版またはパーシャル版）
   */
  async create(createCharacterDto: CharacterInputDto): Promise<Character> {
    this.logger.log(`Creating character: ${createCharacterDto.characterName}`)

    // 必要なデータの取得
    const { gameSystemId, characterName, discordUserId, discordChannelId, discordThreadId } = createCharacterDto

    // キャラクターIDがない場合はエラー（IDは外部で生成される想定）
    if (!createCharacterDto.characterId) {
      throw new Error('CharacterID is required. Use Character Event Handler for automatic ID generation.')
    }
    const characterId = createCharacterDto.characterId

    const character: Partial<Character> = {
      characterId,
      gameSystemId,
      characterName,
      discordUserId,
      discordChannelId,
      discordThreadId,
      status: this.convertDtoSectionToAttributeSection(createCharacterDto.status),
      skill: this.convertDtoSectionToAttributeSection(createCharacterDto.skill),
      parameter: this.convertDtoSectionToAttributeSection(createCharacterDto.parameter),
      item: this.convertDtoSectionToAttributeSection(createCharacterDto.item),
      description: this.convertDtoSectionToAttributeSection(createCharacterDto.description)
    }

    const createdCharacter = await this.characterRepository.create(character)

    // キャラクター作成完了イベントはCharacterCreationRequestedHandlerで発行されるため、
    // ここでは発行しない（重複回避）
    this.logger.log(`Character created successfully: ${createdCharacter.characterId}`)

    return createdCharacter
  }

  /**
   * ユーザーが所有するすべてのキャラクターを取得する
   * @param discordUserId DiscordユーザーID
   */
  async findHavingAll(discordUserId: string): Promise<Character[]> {
    return this.characterRepository.findByUserId(discordUserId)
  }

  /**
   * 特定のキャラクターを取得する
   * @param id キャラクターID
   */
  async findOne(id: string): Promise<Character | null> {
    return this.characterRepository.findById(id)
  }

  /**
   * キャラクター名で特定のキャラクターを取得する
   * @param name キャラクター名
   */
  async findByName(name: string): Promise<Character | null> {
    return this.characterRepository.findByName(name)
  }

  /**
   * チャンネルIDで特定のキャラクターを取得する（単純化済み）
   * @param channelId DiscordチャンネルID
   */
  async findByChannelId(channelId: string): Promise<Character | null> {
    this.logger.log(`Searching character by channelId: ${channelId}`)
    return this.characterRepository.findByChannelId(channelId)
  }

  /**
   * キャラクターを更新する
   * @param id キャラクターID
   * @param updateCharacterDto 更新データ
   */
  async update(id: string, updateCharacterDto: UpdateCharacterDto): Promise<Character | null> {
    const convertedDto = this.convertUpdateDtoToCharacter(updateCharacterDto)
    const updatedCharacter = await this.characterRepository.update(id, convertedDto)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)

      // character.updatedイベントを発行
      await this.typedEventService.emit('character.updated', {
        character: updatedCharacter,
        updateType: 'update',
        source: 'character-service',
        timestamp: new Date()
      })

      this.logger.log(`Character updated event emitted for: ${updatedCharacter.characterId}`)
    }

    return updatedCharacter
  }

  /**
   * チャンネルIDでキャラクターを更新する（単純化済み）
   * @param channelId DiscordチャンネルID
   * @param updateCharacterDto 更新データ
   */
  async updateByChannelId(channelId: string, updateCharacterDto: UpdateCharacterDto): Promise<Character | null> {
    this.logger.log(`Updating character by channelId: ${channelId}`)
    const convertedDto = this.convertUpdateDtoToCharacter(updateCharacterDto)
    const updatedCharacter = await this.characterRepository.updateByChannelId(channelId, convertedDto)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)
    }

    return updatedCharacter
  }

  /**
   * 特定のフィールドを更新する
   * @param id キャラクターID
   * @param field 更新するフィールド
   * @param data 更新するデータ
   */
  async updateField(id: string, field: UpdatePrimary, data: Record<string, unknown>): Promise<Character | null> {
    const updatedCharacter = await this.characterRepository.updateField(id, field, data)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)

      // character.updatedイベントを発行
      await this.typedEventService.emit('character.updated', {
        character: updatedCharacter,
        updateType: `updateField-${field}`,
        source: 'character-service',
        timestamp: new Date()
      })

      this.logger.log(`Character updated event emitted for field update: ${updatedCharacter.characterId} (${field})`)
    }

    return updatedCharacter
  }

  /**
   * チャンネルIDで特定のフィールドを更新する
   * @param channelId DiscordチャンネルID
   * @param field 更新するフィールド
   * @param data 更新するデータ
   */
  async updateFieldByChannelId(
    channelId: string,
    field: UpdatePrimary,
    data: Record<string, unknown>
  ): Promise<Character | null> {
    const updatedCharacter = await this.characterRepository.updateFieldByChannelId(channelId, field, data)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)

      // character.updatedイベントを発行
      await this.typedEventService.emit('character.updated', {
        character: updatedCharacter,
        updateType: `updateFieldByChannelId-${field}`,
        channelId: channelId,
        source: 'character-service',
        timestamp: new Date()
      })

      this.logger.log(
        `Character updated event emitted for field update by channelId: ${updatedCharacter.characterId} (${field})`
      )
    }

    return updatedCharacter
  }

  /**
   * キャラクターを削除する（単純化済み）
   * @param id キャラクターID
   * @param userId ユーザーID（将来の権限チェック用、現在は未使用）
   */
  async remove(id: string, _userId?: string): Promise<Character | null> {
    this.logger.log(`Deleting character: ${id}`)
    const deletedCharacter = await this.characterRepository.remove(id)

    if (deletedCharacter) {
      // キャラクター削除完了イベントを発行（イベント駆動アーキテクチャ）
      await this.typedEventService.emit('character.deleted', {
        character: deletedCharacter,
        source: 'character-service',
        timestamp: new Date()
      })

      this.logger.log(`Character deleted event emitted for: ${deletedCharacter.characterId}`)
    }

    return deletedCharacter
  }

  /**
   * チャンネルIDでキャラクターを削除する（単純化済み）
   * @param channelId DiscordチャンネルID
   * @param userId ユーザーID（将来の権限チェック用、現在は未使用）
   */
  async removeByChannelId(channelId: string, _userId?: string): Promise<void> {
    this.logger.log(`Deleting character by channelId: ${channelId}`)

    // 削除前にキャラクター情報を取得
    const character = await this.characterRepository.findByChannelId(channelId)

    await this.characterRepository.removeByChannelId(channelId)

    if (character) {
      // キャラクター削除完了イベントを発行（イベント駆動アーキテクチャ）
      await this.typedEventService.emit('character.deleted', {
        character,
        source: 'character-service',
        timestamp: new Date()
      })

      this.logger.log(
        `Character deleted event emitted for channelId: ${channelId}, characterId: ${character.characterId}`
      )
    }
  }

  /**
   * ユーザーが所有するキャラクターの軽量データを取得する（カード表示用）
   * @param discordUserId DiscordユーザーID
   */
  async findUserCharacterSummaries(discordUserId: string): Promise<CharacterSummaryDto[]> {
    // データベースレベルで軽量データのみを取得（通信量とメモリ使用量の両方を最適化）
    return this.characterRepository.findUserCharacterSummaries(discordUserId)
  }

  /**
   * キャラクター更新時にDiscordのEmbedを更新する
   * @param character 更新されたキャラクター
   */
  private async updateDiscordEmbed(character: Character): Promise<void> {
    try {
      // キャラクターにDiscordチャンネルIDが設定されていない場合は処理を終了
      if (!character.discordChannelId) {
        this.logger.debug(`キャラクター ${character.characterId} にDiscordチャンネルIDが設定されていません`)
        return
      }

      // 🚨 REMOVED: 冗長なDiscord Embed更新イベント発行を削除
      // character.update.completed イベントがFile-based Event Handlersにより自動処理されるため不要

      this.logger.log(
        `キャラクター ${character.characterId} のDiscord連携準備完了（File-based Event Handlers経由で自動更新）`
      )
    } catch (error) {
      this.logger.error(
        `キャラクター ${character.characterId} のDiscord連携処理中にエラーが発生しました: ${(error as Error).message}`
      )
    }
  }

  // EventDriven待機メソッドを削除 - 単純化により不要
}
