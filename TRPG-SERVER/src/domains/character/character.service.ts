import { Injectable, Logger } from '@nestjs/common'
import { CharacterRepository } from './repositories/character.repository'
import { CharacterInputDto, AttributeValueDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import { UpdatePrimary } from './models/character.model'
import { CharacterEntity } from './models/character.entity'
// UserService依存削除 - Character Service単一責任原則の強化
// AppConfigService依存削除 - EventDriven分岐を削除し単純化
// DiscordIntegrationService依存を完全削除 - イベント駆動アーキテクチャに移行
import { AttributeValue, AttributeSection, isAttributeSection } from '../../core/types/attribute.types'

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
      dice: dto.dice,
      isVisible: dto.isVisible
    }
  }

  /**
   * DTO セクションを AttributeSection に変換
   */
  private convertDtoSectionToAttributeSection(
    dtoSection: Record<string, AttributeValueDto> | undefined,
    sectionName: string
  ): AttributeSection {
    if (!dtoSection) return {}
    if (!isAttributeSection(dtoSection)) {
      throw new TypeError(`Invalid ${sectionName}: expected AttributeSection canonical form`)
    }

    const section: AttributeSection = {}
    for (const [key, value] of Object.entries(dtoSection)) {
      section[key] = this.convertDtoToAttributeValue(value)
    }
    return section
  }

  /**
   * UpdateCharacterDto を Character 形式に変換
   */
  private convertUpdateDtoToCharacter(dto: UpdateCharacterDto): Partial<CharacterEntity> {
    const converted: Partial<CharacterEntity> = {}

    if (dto.characterName !== undefined) converted.characterName = dto.characterName
    if (dto.gameSystemId !== undefined) converted.gameSystemId = dto.gameSystemId
    if (dto.discordChannelId !== undefined) converted.discordChannelId = dto.discordChannelId
    if (dto.discordThreadId !== undefined) converted.discordThreadId = dto.discordThreadId
    if (dto.status !== undefined) converted.status = this.convertDtoSectionToAttributeSection(dto.status, 'status')
    if (dto.skill !== undefined) converted.skill = this.convertDtoSectionToAttributeSection(dto.skill, 'skill')
    if (dto.parameter !== undefined)
      converted.parameter = this.convertDtoSectionToAttributeSection(dto.parameter, 'parameter')
    if (dto.item !== undefined) converted.item = this.convertDtoSectionToAttributeSection(dto.item, 'item')
    if (dto.description !== undefined)
      converted.description = this.convertDtoSectionToAttributeSection(dto.description, 'description')

    return converted
  }

  constructor(
    // UserService依存削除 - Character Service単一責任原則の強化
    // DiscordIntegrationService依存を完全削除 - イベント駆動アーキテクチャに移行
    private readonly characterRepository: CharacterRepository
  ) {}

  /**
   * キャラクターを作成する（型安全性強化版）
   * @param createCharacterDto キャラクター作成DTO（完全版またはパーシャル版）
   */
  async create(createCharacterDto: CharacterInputDto): Promise<CharacterEntity> {
    this.logger.log(`Creating character: ${createCharacterDto.characterName}`)

    // 必要なデータの取得
    const { gameSystemId, characterName, discordUserId, discordChannelId } = createCharacterDto

    // キャラクターIDがない場合はエラー（IDは外部で生成される想定）
    if (!createCharacterDto.characterId) {
      throw new Error('CharacterID is required. Use Character Event Handler for automatic ID generation.')
    }
    const characterId = createCharacterDto.characterId

    const character: Partial<CharacterEntity> = {
      characterId,
      gameSystemId,
      characterName,
      discordUserId,
      discordChannelId,
      status: this.convertDtoSectionToAttributeSection(createCharacterDto.status, 'status'),
      skill: this.convertDtoSectionToAttributeSection(createCharacterDto.skill, 'skill'),
      parameter: this.convertDtoSectionToAttributeSection(createCharacterDto.parameter, 'parameter'),
      item: this.convertDtoSectionToAttributeSection(createCharacterDto.item, 'item'),
      description: this.convertDtoSectionToAttributeSection(createCharacterDto.description, 'description')
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
  async findHavingAll(discordUserId: string): Promise<CharacterEntity[]> {
    return this.characterRepository.findByUserId(discordUserId)
  }

  /**
   * 特定のキャラクターを取得する
   * @param id キャラクターID
   */
  async findOne(id: string): Promise<CharacterEntity | null> {
    return this.characterRepository.findById(id)
  }

  /**
   * 認証済み所有者のキャラクターだけを取得する（HTTP公開操作用）
   */
  async findOneForOwner(id: string, discordUserId: string): Promise<CharacterEntity | null> {
    return this.characterRepository.findByIdForOwner(id, discordUserId)
  }

  /**
   * キャラクター名で特定のキャラクターを取得する
   * @param name キャラクター名
   */
  async findByName(name: string): Promise<CharacterEntity | null> {
    return this.characterRepository.findByName(name)
  }

  /**
   * チャンネルIDで特定のキャラクターを取得する（単純化済み）
   * @param channelId DiscordチャンネルID
   */
  async findByChannelId(channelId: string): Promise<CharacterEntity | null> {
    this.logger.log(`Searching character by channelId: ${channelId}`)
    return this.characterRepository.findByChannelId(channelId)
  }

  /**
   * キャラクターを更新する
   * @param id キャラクターID
   * @param updateCharacterDto 更新データ
   */
  async update(id: string, updateCharacterDto: UpdateCharacterDto): Promise<CharacterEntity | null> {
    const convertedDto = this.convertUpdateDtoToCharacter(updateCharacterDto)
    const updatedCharacter = await this.characterRepository.update(id, convertedDto)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)
    }

    return updatedCharacter
  }

  /**
   * 認証済み所有者のキャラクターだけを更新する（HTTP公開操作用）
   */
  async updateForOwner(
    id: string,
    discordUserId: string,
    updateCharacterDto: UpdateCharacterDto
  ): Promise<CharacterEntity | null> {
    const convertedDto = this.convertUpdateDtoToCharacter(updateCharacterDto)
    const updatedCharacter = await this.characterRepository.updateForOwner(id, discordUserId, convertedDto)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)
    }

    return updatedCharacter
  }

  /**
   * チャンネルIDでキャラクターを更新する（単純化済み）
   * @param channelId DiscordチャンネルID
   * @param updateCharacterDto 更新データ
   */
  async updateByChannelId(channelId: string, updateCharacterDto: UpdateCharacterDto): Promise<CharacterEntity | null> {
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
  async updateField(id: string, field: UpdatePrimary, data: AttributeSection): Promise<CharacterEntity | null> {
    if (!isAttributeSection(data)) {
      throw new TypeError(`Invalid ${field}: expected AttributeSection canonical form`)
    }
    const updatedCharacter = await this.characterRepository.updateField(id, field, data)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)
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
    data: AttributeSection
  ): Promise<CharacterEntity | null> {
    if (!isAttributeSection(data)) {
      throw new TypeError(`Invalid ${field}: expected AttributeSection canonical form`)
    }
    const updatedCharacter = await this.characterRepository.updateFieldByChannelId(channelId, field, data)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)
    }

    return updatedCharacter
  }

  /**
   * キャラクターを削除する（単純化済み）
   * @param id キャラクターID
   * @param userId ユーザーID（将来の権限チェック用、現在は未使用）
   */
  async remove(id: string, _userId?: string): Promise<CharacterEntity | null> {
    this.logger.log(`Deleting character: ${id}`)
    const deletedCharacter = await this.characterRepository.remove(id)

    return deletedCharacter
  }

  /**
   * 認証済み所有者のキャラクターだけを削除する（HTTP公開操作用）
   */
  async removeForOwner(id: string, discordUserId: string): Promise<CharacterEntity | null> {
    this.logger.log(`Deleting character for owner: ${id}`)
    return this.characterRepository.removeForOwner(id, discordUserId)
  }

  /**
   * チャンネルIDでキャラクターを削除する（単純化済み）
   * @param channelId DiscordチャンネルID
   * @param userId ユーザーID（将来の権限チェック用、現在は未使用）
   */
  async removeByChannelId(channelId: string, _userId?: string): Promise<void> {
    this.logger.log(`Deleting character by channelId: ${channelId}`)

    await this.characterRepository.removeByChannelId(channelId)
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
  private async updateDiscordEmbed(character: CharacterEntity): Promise<void> {
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
