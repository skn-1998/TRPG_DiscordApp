import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Repository } from 'src/core/interfaces/repository.interface'
import { DiceRollText, DICE_ROLL_TEXT_MODEL, DiceRollTextDocument } from '../models/dice-roll-text.model'

/**
 * ダイスロールテキストリポジトリの実装
 * パフォーマンス最適化とキャッシュ機能を追加
 */
@Injectable()
export class DiceRollTextRepository implements Repository<DiceRollText, string> {
  // 簡易キャッシュ（チャンネル別）
  private readonly cache = new Map<string, { data: DiceRollText[]; timestamp: number }>()
  private readonly CACHE_TTL = 60000 // 1分

  constructor(
    @InjectModel(DICE_ROLL_TEXT_MODEL)
    private readonly diceRollTextModel: Model<DiceRollTextDocument>
  ) {}

  /**
   * ダイスロールテキストを作成する
   * @param entity ダイスロールテキストデータ
   */
  async create(entity: Partial<DiceRollText>): Promise<DiceRollText> {
    const createdDiceRollText = new this.diceRollTextModel(entity)
    const result = await createdDiceRollText.save()

    // キャッシュ無効化
    if (entity.discordChannelId) {
      this.invalidateChannelCache(entity.discordChannelId)
    }

    return result
  }

  /**
   * IDによってダイスロールテキストを検索する（インデックス最適化済み）
   * @param id テキストID
   */
  async findById(id: string): Promise<DiceRollText | null> {
    return this.diceRollTextModel.findOne({ textId: id }).lean().exec()
  }

  /**
   * チャンネルIDによってダイスロールテキストを検索する（インデックス・ページング最適化済み）
   * @param channelId DiscordチャンネルID
   * @param limit 取得件数制限（デフォルト: 500）
   * @param offset オフセット（デフォルト: 0）
   */
  async findByChannelId(channelId: string, limit: number = 500, offset: number = 0): Promise<DiceRollText[]> {
    // キャッシュチェック（最新データのみ）
    if (offset === 0 && limit <= 500) {
      const cached = this.getFromCache(channelId)
      if (cached) {
        return cached.slice(0, limit)
      }
    }

    const result = await this.diceRollTextModel
      .find({ discordChannelId: channelId })
      .select('textId characterId text result diceRoll discordChannelId createdAt')
      .sort({ createdAt: -1 }) // 新しい順
      .limit(limit)
      .skip(offset)
      .lean()
      .exec()

    // 最新500件をキャッシュ
    if (offset === 0 && limit >= 500) {
      this.updateCache(channelId, result)
    }

    return result
  }

  /**
   * キャラクターIDによってダイスロールテキストを検索する（最適化済み）
   */
  async findByCharacterId(characterId: string, limit: number = 100): Promise<DiceRollText[]> {
    return this.diceRollTextModel
      .find({ characterId })
      .select('textId characterId text result diceRoll discordChannelId createdAt')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec()
  }

  /**
   * ダイスロールテキストの件数を取得
   */
  async countByChannelId(channelId: string): Promise<number> {
    return this.diceRollTextModel.countDocuments({ discordChannelId: channelId })
  }

  /**
   * 古いダイスロールテキストを削除（クリーンアップ）
   */
  async deleteOldRolls(channelId: string, keepCount: number = 1000): Promise<number> {
    // 最新のkeepCount件以外を削除
    const rollsToKeep = await this.diceRollTextModel
      .find({ discordChannelId: channelId })
      .select('_id')
      .sort({ createdAt: -1 })
      .limit(keepCount)
      .lean()
      .exec()

    const idsToKeep = rollsToKeep.map((roll) => roll._id)

    const deleteResult = await this.diceRollTextModel.deleteMany({
      discordChannelId: channelId,
      _id: { $nin: idsToKeep }
    })

    // キャッシュ無効化
    this.invalidateChannelCache(channelId)

    return deleteResult.deletedCount || 0
  }

  /**
   * 全てのエンティティを取得する
   */
  async findAll(): Promise<DiceRollText[]> {
    return this.diceRollTextModel.find().exec()
  }

  /**
   * エンティティを更新する
   */
  async update(id: string, entity: Partial<DiceRollText>): Promise<DiceRollText | null> {
    const updated = await this.diceRollTextModel.findOneAndUpdate({ textId: id }, entity, { new: true }).exec()

    // キャッシュ無効化
    if (updated?.discordChannelId) {
      this.invalidateChannelCache(updated.discordChannelId)
    }

    return updated
  }

  /**
   * エンティティを削除する
   */
  async delete(id: string): Promise<void> {
    const deleted = await this.diceRollTextModel.findOneAndDelete({ textId: id }).exec()

    // キャッシュ無効化
    if (deleted?.discordChannelId) {
      this.invalidateChannelCache(deleted.discordChannelId)
    }
  }

  /**
   * エンティティを削除する（Repository インターフェース互換性のため）
   */
  async remove(id: string): Promise<DiceRollText | null> {
    const deleted = await this.diceRollTextModel.findOneAndDelete({ textId: id }).exec()

    // キャッシュ無効化
    if (deleted?.discordChannelId) {
      this.invalidateChannelCache(deleted.discordChannelId)
    }

    return deleted
  }

  /**
   * チャンネルIDによってダイスロールテキストを削除する
   * @param channelId DiscordチャンネルID
   */
  async removeByChannelId(channelId: string): Promise<void> {
    await this.diceRollTextModel.deleteMany({ discordChannelId: channelId }).exec()

    // キャッシュ無効化
    this.invalidateChannelCache(channelId)
  }

  /**
   * キャッシュから取得
   */
  private getFromCache(channelId: string): DiceRollText[] | null {
    const cached = this.cache.get(channelId)
    if (!cached) return null

    const now = Date.now()
    if (now - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(channelId)
      return null
    }

    return cached.data
  }

  /**
   * キャッシュ更新
   */
  private updateCache(channelId: string, data: DiceRollText[]): void {
    this.cache.set(channelId, {
      data: [...data], // コピーを作成
      timestamp: Date.now()
    })
  }

  /**
   * チャンネルキャッシュ無効化
   */
  private invalidateChannelCache(channelId: string): void {
    this.cache.delete(channelId)
  }

  /**
   * 全キャッシュクリア
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * キャッシュ統計
   */
  getCacheStats(): { cachedChannels: number; totalEntries: number } {
    let totalEntries = 0
    for (const cached of this.cache.values()) {
      totalEntries += cached.data.length
    }

    return {
      cachedChannels: this.cache.size,
      totalEntries
    }
  }
}
