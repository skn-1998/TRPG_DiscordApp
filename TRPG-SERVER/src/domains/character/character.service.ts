import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common'
import { v4 as uuidv4 } from 'uuid'
import { CharacterRepository } from './repositories/character.repository'
import { CharacterInputDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'
import { CharacterSummaryDto } from './dto/character-summary.dto'
import { Character, UpdatePrimary, CHARACTER_MODEL } from './models/character.model'
import { UserService } from '../user/user.service'
import { DiscordService } from '../../discord/discord.service'
import { AppConfigService } from '../../config/config.service'
import { DiscordIntegrationService } from '../../discord/application/discord-integration.service'

/**
 * キャラクターサービス
 * キャラクター情報のCRUD操作を提供する
 */
@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name)

  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly userService: UserService,
    @Inject(forwardRef(() => DiscordService))
    private readonly discordService: DiscordService,
    private readonly configService: AppConfigService,
    @Inject(forwardRef(() => DiscordIntegrationService))
    private readonly discordIntegrationService: DiscordIntegrationService
  ) {}

  /**
   * キャラクターを作成する
   * @param createCharacterDto キャラクター作成DTO（完全版またはパーシャル版）
   */
  async create(createCharacterDto: CharacterInputDto): Promise<Character> {
    const useEventDriven = this.configService.get('prototype.eventDriven')

    if (useEventDriven) {
      // Phase 2: イベント駆動方式
      this.logger.log(`[EVENT-DRIVEN] Creating character via events: ${createCharacterDto.characterName}`)

      // CharacterInputDtoからCreateCharacterDtoへの変換
      const characterId = createCharacterDto.characterId || uuidv4()
      const createData = {
        characterId,
        characterName: createCharacterDto.characterName || '',
        gameSystemId: createCharacterDto.gameSystemId || '',
        discordUserId: createCharacterDto.discordUserId || '',
        discordChannelId: createCharacterDto.discordChannelId,
        status: createCharacterDto.status,
        parameter: createCharacterDto.parameter,
        skill: createCharacterDto.skill,
        item: createCharacterDto.item,
        description: createCharacterDto.description
      }

      // イベントを発行
      await this.discordIntegrationService.requestCharacterCreation(createData, createCharacterDto.discordUserId || '')

      // 非同期処理のため、仮のCharacterオブジェクトを返す
      return {
        characterId,
        characterName: createCharacterDto.characterName || '',
        gameSystemId: createCharacterDto.gameSystemId || '',
        discordUserId: createCharacterDto.discordUserId || '',
        discordChannelId: createCharacterDto.discordChannelId || '',
        status: createCharacterDto.status || {},
        skill: createCharacterDto.skill || {},
        parameter: createCharacterDto.parameter || {}
      } as Character
    } else {
      // Phase 1: 既存の直接呼び出し方式
      this.logger.log(`[DIRECT] Creating character directly: ${createCharacterDto.characterName}`)

      // 必要なデータの取得
      const { gameSystemId, characterName, discordUserId, discordChannelId } = createCharacterDto

      // キャラクターIDがない場合は生成
      const characterId = createCharacterDto.characterId || uuidv4()

      const character: Partial<Character> = {
        characterId,
        gameSystemId,
        characterName,
        discordUserId,
        discordChannelId,
        status: createCharacterDto.status || {},
        skill: createCharacterDto.skill || {},
        parameter: createCharacterDto.parameter || {}
      }

      // キャラクターを作成
      const createdCharacter = await this.characterRepository.create(character)

      // ユーザーにキャラクターIDを追加
      if (discordUserId) {
        await this.userService.addCharacterId(discordUserId, characterId)
      }

      return createdCharacter
    }
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
    const useEventDriven = this.configService.get('prototype.eventDriven')

    if (useEventDriven) {
      // Phase 2: イベント駆動方式
      this.logger.log(`[EVENT-DRIVEN] Searching character via events: ${channelId}`)

      // 検索イベントを発行
      await this.discordIntegrationService.requestCharacterSearch({ channelId }, 'api')

      // 非同期処理の結果を待つ
      return await this.waitForCharacterSearchResult(channelId)
    } else {
      // Phase 1: 既存の直接呼び出し方式
      this.logger.log(`[DIRECT] Searching character directly: ${channelId}`)
      return this.characterRepository.findByChannelId(channelId)
    }
  }

  /**
   * キャラクターを更新する
   * @param id キャラクターID
   * @param updateCharacterDto 更新データ
   */
  async update(id: string, updateCharacterDto: UpdateCharacterDto): Promise<Character | null> {
    const updatedCharacter = await this.characterRepository.update(id, updateCharacterDto)

    if (updatedCharacter) {
      await this.updateDiscordEmbed(updatedCharacter)
    }

    return updatedCharacter
  }

  /**
   * チャンネルIDでキャラクターを更新する
   * @param channelId DiscordチャンネルID
   * @param updateCharacterDto 更新データ
   */
  async updateByChannelId(channelId: string, updateCharacterDto: UpdateCharacterDto): Promise<Character | null> {
    const useEventDriven = this.configService.get('prototype.eventDriven')

    if (useEventDriven) {
      // Phase 2: イベント駆動方式
      this.logger.log(`[EVENT-DRIVEN] Updating character via events: ${channelId}`)

      // 更新イベントを発行
      await this.discordIntegrationService.requestCharacterUpdate(channelId, updateCharacterDto)

      // 非同期処理の結果を待つ
      return await this.waitForCharacterUpdateResult(channelId, updateCharacterDto)
    } else {
      // Phase 1: 既存の直接呼び出し方式
      this.logger.log(`[DIRECT] Updating character directly: ${channelId}`)
      const updatedCharacter = await this.characterRepository.updateByChannelId(channelId, updateCharacterDto)

      if (updatedCharacter) {
        await this.updateDiscordEmbed(updatedCharacter)
      }

      return updatedCharacter
    }
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
    }

    return updatedCharacter
  }

  /**
   * キャラクターを削除する
   * @param id キャラクターID
   * @param userId ユーザーID（イベント駆動時の権限チェック用）
   */
  async remove(id: string, userId?: string): Promise<void> {
    const useEventDriven = this.configService.get('prototype.eventDriven')

    if (useEventDriven && userId) {
      // Phase 2: イベント駆動方式
      this.logger.log(`[EVENT-DRIVEN] Deleting character via events: ${id}`)

      await this.discordIntegrationService.requestCharacterDeletion(id, userId, 'Direct deletion request')
    } else {
      // Phase 1: 既存の直接呼び出し方式
      this.logger.log(`[DIRECT] Deleting character directly: ${id}`)
      await this.characterRepository.remove(id)
    }
  }

  /**
   * チャンネルIDでキャラクターを削除する
   * @param channelId DiscordチャンネルID
   * @param userId ユーザーID（イベント駆動時の権限チェック用）
   */
  async removeByChannelId(channelId: string, userId?: string): Promise<void> {
    const useEventDriven = this.configService.get('prototype.eventDriven')

    if (useEventDriven && userId) {
      // Phase 2: イベント駆動方式
      this.logger.log(`[EVENT-DRIVEN] Deleting character by channel via events: ${channelId}`)

      // まずキャラクターを取得してIDを確認
      const character = await this.characterRepository.findByChannelId(channelId)
      if (character) {
        await this.discordIntegrationService.requestCharacterDeletion(
          character.characterId,
          userId,
          'Channel-based deletion request'
        )
      } else {
        this.logger.warn(`[EVENT-DRIVEN] Character not found for channel: ${channelId}`)
      }
    } else {
      // Phase 1: 既存の直接呼び出し方式
      this.logger.log(`[DIRECT] Deleting character by channel directly: ${channelId}`)
      await this.characterRepository.removeByChannelId(channelId)
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

      // ギルド情報を取得
      const guildInfo = await this.discordService.getChannelInfo(character.discordChannelId)
      if (!guildInfo) {
        this.logger.error(`チャンネル ${character.discordChannelId} の情報を取得できませんでした`)
        return
      }

      // ギルドの詳細情報を取得
      const guildDetails = await this.discordService.getGuildInfo(guildInfo.guild.id)
      if (!guildDetails) {
        this.logger.error(`ギルド ${guildInfo.guild.id} の情報を取得できませんでした`)
        return
      }

      // DiscordのEmbedを更新
      const result = await this.discordService.createOrUpdateCharacterEmbed(
        character,
        character.discordChannelId,
        guildDetails
      )

      if (result.success) {
        this.logger.log(`キャラクター ${character.characterId} のDiscordEmbed更新が完了しました`)
      } else {
        this.logger.error(`キャラクター ${character.characterId} のDiscordEmbed更新に失敗しました: ${result.error}`)
      }
    } catch (error) {
      this.logger.error(
        `キャラクター ${character.characterId} のDiscordEmbed更新中にエラーが発生しました: ${(error as Error).message}`
      )
    }
  }

  /**
   * キャラクター検索結果を待つ
   * @param channelId チャンネルID
   */
  private async waitForCharacterSearchResult(channelId: string): Promise<Character | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Character search timeout'))
      }, 5000)

      const handleCharacterFound = (character: Character | null) => {
        if (character && character.discordChannelId === channelId) {
          clearTimeout(timeout)
          resolve(character)
        } else if (!character) {
          clearTimeout(timeout)
          resolve(null)
        }
      }

      const handleCharacterNotFound = () => {
        clearTimeout(timeout)
        resolve(null)
      }

      // イベントリスナーを設定（簡単な実装）
      // 実際の実装では適切なイベントバスのsubscribeを使用する必要があります
      setTimeout(() => {
        this.characterRepository.findByChannelId(channelId).then(handleCharacterFound).catch(handleCharacterNotFound)
      }, 100)
    })
  }

  /**
   * キャラクター更新結果を待つ
   * @param channelId チャンネルID
   * @param updateData 更新データ
   */
  private async waitForCharacterUpdateResult(
    channelId: string,
    updateData: UpdateCharacterDto
  ): Promise<Character | null> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Character update timeout'))
      }, 5000)

      const handleCharacterUpdated = (character: Character | null) => {
        if (character && character.discordChannelId === channelId) {
          clearTimeout(timeout)
          resolve(character)
        } else if (!character) {
          clearTimeout(timeout)
          resolve(null)
        }
      }

      const handleCharacterUpdateFailed = () => {
        clearTimeout(timeout)
        resolve(null)
      }

      // イベントリスナーを設定（簡単な実装）
      // 実際の実装では適切なイベントバスのsubscribeを使用する必要があります
      setTimeout(() => {
        this.characterRepository
          .updateByChannelId(channelId, updateData)
          .then(handleCharacterUpdated)
          .catch(handleCharacterUpdateFailed)
      }, 100)
    })
  }
}
