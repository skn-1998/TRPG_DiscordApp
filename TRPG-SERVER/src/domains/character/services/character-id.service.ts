import { Injectable, Logger } from '@nestjs/common'
import { IdGeneratorUtil } from '../../../shared/utils/id-generator.util'
import { CharacterRepository } from '../repositories/character.repository'

/**
 * キャラクターID生成サービス
 *
 * 🎯 責務:
 * - ユニークなキャラクターIDの生成
 * - 重複チェックとフォールバック戦略
 * - ドメイン固有のID生成ルール
 */
@Injectable()
export class CharacterIdService {
  private readonly logger = new Logger(CharacterIdService.name)

  constructor(private readonly characterRepository: CharacterRepository) {}

  /**
   * ユニークなキャラクターID生成
   * @param prefix プレフィックス（デフォルト: 'char_'）
   * @param maxAttempts 最大試行回数（デフォルト: 10）
   * @returns ユニークなキャラクターID
   */
  async generateUniqueCharacterId(prefix = 'char_', maxAttempts = 10): Promise<string> {
    let attempts = 0

    while (attempts < maxAttempts) {
      const candidateId = IdGeneratorUtil.generateShortId(prefix, 8)

      // ユニーク性検証
      const exists = await this.characterRepository.existsById(candidateId)
      if (!exists) {
        this.logger.debug(`Generated unique character ID: ${candidateId} (attempt: ${attempts + 1})`)
        return candidateId
      }

      attempts++
      this.logger.debug(`ID collision detected: ${candidateId} (attempt: ${attempts})`)
    }

    // フォールバック1: より長いランダムID
    const fallbackId = IdGeneratorUtil.generateShortId(prefix, 12)
    const fallbackExists = await this.characterRepository.existsById(fallbackId)
    if (!fallbackExists) {
      this.logger.warn(`Using fallback ID generation: ${fallbackId}`)
      return fallbackId
    }

    // フォールバック2: タイムスタンプベースID
    const timestampId = IdGeneratorUtil.generateTimestampId(prefix)
    this.logger.warn(`Using timestamp-based ID generation: ${timestampId}`)
    return timestampId
  }

  /**
   * チャンネル内でユニークなキャラクターID生成
   * @param channelId DiscordチャンネルID
   * @param prefix プレフィックス（デフォルト: 'char_'）
   * @param maxAttempts 最大試行回数（デフォルト: 10）
   * @returns チャンネル内でユニークなキャラクターID
   */
  async generateUniqueCharacterIdInChannel(channelId: string, prefix = 'char_', maxAttempts = 10): Promise<string> {
    let attempts = 0

    while (attempts < maxAttempts) {
      const candidateId = IdGeneratorUtil.generateShortId(prefix, 8)

      // チャンネル内ユニーク性検証
      const exists = await this.characterRepository.existsByIdAndChannel(candidateId, channelId)
      if (!exists) {
        this.logger.debug(
          `Generated unique character ID in channel ${channelId}: ${candidateId} (attempt: ${attempts + 1})`
        )
        return candidateId
      }

      attempts++
      this.logger.debug(`Channel ID collision detected: ${candidateId} in ${channelId} (attempt: ${attempts})`)
    }

    // フォールバック1: より長いランダムID
    const fallbackId = IdGeneratorUtil.generateShortId(prefix, 12)
    const fallbackExists = await this.characterRepository.existsByIdAndChannel(fallbackId, channelId)
    if (!fallbackExists) {
      this.logger.warn(`Using fallback ID generation in channel ${channelId}: ${fallbackId}`)
      return fallbackId
    }

    // フォールバック2: タイムスタンプベースID
    const timestampId = IdGeneratorUtil.generateTimestampId(prefix)
    this.logger.warn(`Using timestamp-based ID generation in channel ${channelId}: ${timestampId}`)
    return timestampId
  }

  /**
   * 読みやすいキャラクターID生成
   * 人間が識別しやすい文字のみを使用
   * @param prefix プレフィックス（デフォルト: 'char_'）
   * @param maxAttempts 最大試行回数（デフォルト: 10）
   * @returns 読みやすいユニークなキャラクターID
   */
  async generateReadableCharacterId(prefix = 'char_', maxAttempts = 10): Promise<string> {
    let attempts = 0

    while (attempts < maxAttempts) {
      const candidateId = IdGeneratorUtil.generateReadableId(prefix, 8)

      // ユニーク性検証
      const exists = await this.characterRepository.existsById(candidateId)
      if (!exists) {
        this.logger.debug(`Generated readable character ID: ${candidateId} (attempt: ${attempts + 1})`)
        return candidateId
      }

      attempts++
      this.logger.debug(`Readable ID collision detected: ${candidateId} (attempt: ${attempts})`)
    }

    // フォールバック: タイムスタンプベースID
    const timestampId = IdGeneratorUtil.generateTimestampId(prefix)
    this.logger.warn(`Using timestamp-based readable ID generation: ${timestampId}`)
    return timestampId
  }

  /**
   * セキュアなキャラクターID生成
   * より高い複雑性とユニーク性を持つID
   * @param prefix プレフィックス（デフォルト: 'char_'）
   * @returns セキュアなユニークなキャラクターID
   */
  async generateSecureCharacterId(prefix = 'char_'): Promise<string> {
    // セキュアIDは衝突確率が極めて低いため、1回の試行のみ
    const secureId = IdGeneratorUtil.generateSecureId(prefix, 16)

    // 念のため存在確認
    const exists = await this.characterRepository.existsById(secureId)
    if (!exists) {
      this.logger.debug(`Generated secure character ID: ${secureId}`)
      return secureId
    }

    // 極めて稀な衝突の場合はUUIDを使用
    const uuidId = `${prefix}${IdGeneratorUtil.generateUuid()}`
    this.logger.warn(`Using UUID fallback for secure ID: ${uuidId}`)
    return uuidId
  }

  /**
   * キャラクター名の重複チェック
   * @param characterName キャラクター名
   * @param channelId DiscordチャンネルID（オプション）
   * @param discordUserId DiscordユーザーID（オプション）
   * @returns 重複している場合はtrue
   */
  async isCharacterNameDuplicate(characterName: string, channelId?: string, discordUserId?: string): Promise<boolean> {
    if (channelId) {
      return await this.characterRepository.existsByNameAndChannel(characterName, channelId)
    }

    if (discordUserId) {
      return await this.characterRepository.existsByNameAndUser(characterName, discordUserId)
    }

    // 全体での重複チェック（非推奨：パフォーマンス上の理由）
    this.logger.warn('Performing global character name duplicate check - consider providing channelId or discordUserId')
    const character = await this.characterRepository.findByName(characterName)
    return character !== null
  }

  /**
   * ID生成統計の取得
   * デバッグおよび監視用
   * @returns ID生成に関する統計情報
   */
  async getIdGenerationStats(): Promise<{
    totalCharacters: number
    averageIdLength: number
    prefixDistribution: Record<string, number>
  }> {
    // 実装は必要に応じて追加
    // 現在は基本的な統計のみ
    const allCharacters = await this.characterRepository.findAll()

    const totalCharacters = allCharacters.length
    const averageIdLength =
      totalCharacters > 0 ? allCharacters.reduce((sum, char) => sum + char.characterId.length, 0) / totalCharacters : 0

    const prefixDistribution: Record<string, number> = {}
    allCharacters.forEach((char) => {
      const prefix = char.characterId.split('_')[0] + '_'
      prefixDistribution[prefix] = (prefixDistribution[prefix] || 0) + 1
    })

    return {
      totalCharacters,
      averageIdLength: Math.round(averageIdLength * 100) / 100,
      prefixDistribution
    }
  }
}
