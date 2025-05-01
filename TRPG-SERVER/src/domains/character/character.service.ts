import { Injectable } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { CharacterRepository } from './repositories/character.repository'
import { PartialInputCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { Character, UpdatePrimary, CHARACTER_MODEL } from './models/character.model'

/**
 * キャラクターサービス
 * キャラクター情報のCRUD操作を提供する
 */
@Injectable()
export class CharacterService {
  constructor(private readonly characterRepository: CharacterRepository) {}

  /**
   * キャラクターを作成する
   * @param createCharacterDto キャラクター作成DTO（完全版またはパーシャル版）
   */
  async create(createCharacterDto: PartialInputCharacterDto): Promise<Character> {
    // 必要なデータの取得
    const { TRPGId, characterName, discordUserId, discordChannelId } = createCharacterDto

    // キャラクターIDがない場合は生成
    const characterId = createCharacterDto.characterId || uuidv4()

    const character: Partial<Character> = {
      characterId,
      TRPGId,
      characterName,
      discordUserId,
      discordChannelId,
      status: createCharacterDto.status || {},
      skill: createCharacterDto.skill || {},
      parameter: createCharacterDto.parameter || {}
    }

    return this.characterRepository.create(character)
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
   * チャンネルIDで特定のキャラクターを取得する
   * @param channelId DiscordチャンネルID
   */
  async findByChannelId(channelId: string): Promise<Character | null> {
    return this.characterRepository.findByChannelId(channelId)
  }

  /**
   * キャラクターを更新する
   * @param id キャラクターID
   * @param updateCharacterDto 更新データ
   */
  async update(id: string, updateCharacterDto: UpdateCharacterDto): Promise<Character | null> {
    return this.characterRepository.update(id, updateCharacterDto)
  }

  /**
   * チャンネルIDでキャラクターを更新する
   * @param channelId DiscordチャンネルID
   * @param updateCharacterDto 更新データ
   */
  async updateByChannelId(channelId: string, updateCharacterDto: UpdateCharacterDto): Promise<Character | null> {
    return this.characterRepository.updateByChannelId(channelId, updateCharacterDto)
  }

  /**
   * 特定のフィールドを更新する
   * @param id キャラクターID
   * @param field 更新するフィールド
   * @param data 更新するデータ
   */
  async updateField(id: string, field: UpdatePrimary, data: Record<string, unknown>): Promise<Character | null> {
    return this.characterRepository.updateField(id, field, data)
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
    return this.characterRepository.updateFieldByChannelId(channelId, field, data)
  }

  /**
   * キャラクターを削除する
   * @param id キャラクターID
   */
  async remove(id: string): Promise<void> {
    await this.characterRepository.remove(id)
  }

  /**
   * チャンネルIDでキャラクターを削除する
   * @param channelId DiscordチャンネルID
   */
  async removeByChannelId(channelId: string): Promise<void> {
    await this.characterRepository.removeByChannelId(channelId)
  }
}
