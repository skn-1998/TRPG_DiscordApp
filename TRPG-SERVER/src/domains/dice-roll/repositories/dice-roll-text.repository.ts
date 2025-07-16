import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Repository } from 'src/core/interfaces/repository.interface'
import { DiceRollText, DICE_ROLL_TEXT_MODEL, DiceRollTextDocument } from '../models/dice-roll-text.model'

/**
 * ダイスロールテキストリポジトリの実装
 */
@Injectable()
export class DiceRollTextRepository implements Repository<DiceRollText, string> {
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
    return createdDiceRollText.save()
  }

  /**
   * IDによってダイスロールテキストを検索する
   * @param id テキストID
   */
  async findById(id: string): Promise<DiceRollText | null> {
    return this.diceRollTextModel.findOne({ textId: id }).exec()
  }

  /**
   * チャンネルIDによってダイスロールテキストを検索する
   * @param channelId DiscordチャンネルID
   */
  async findByChannelId(channelId: string): Promise<DiceRollText[]> {
    console.log(`[Performance] MongoDB: findByChannelIdの実行開始 - channelId=${channelId}`)
    const startTime = Date.now()
    try {
      const result = await this.diceRollTextModel.find({ discordChannelId: channelId }).exec()
      const duration = Date.now() - startTime
      console.log(`[Performance] MongoDB: findByChannelId完了 - 件数=${result.length}, 所要時間=${duration}ms`)
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[Performance] MongoDB: findByChannelIdエラー - 所要時間=${duration}ms, エラー=`, error)
      throw error
    }
  }

  /**
   * キャラクターIDによってダイスロールテキストを検索する
   * @param characterId キャラクターID
   */
  async findByCharacterId(characterId: string): Promise<DiceRollText[]> {
    return this.diceRollTextModel.find({ characterId }).exec()
  }

  /**
   * 条件に一致するすべてのダイスロールテキストを検索する
   * @param filter フィルター条件
   */
  async findAll(filter?: Partial<DiceRollText>): Promise<DiceRollText[]> {
    return this.diceRollTextModel.find(filter || {}).exec()
  }

  /**
   * ダイスロールテキストを更新する
   * @param id テキストID
   * @param updateData 更新するデータ
   */
  async update(id: string, updateData: Partial<DiceRollText>): Promise<DiceRollText | null> {
    return this.diceRollTextModel.findOneAndUpdate({ textId: id }, updateData, { new: true }).exec()
  }

  /**
   * ダイスロールテキストを削除する
   * @param id テキストID
   */
  async remove(id: string): Promise<DiceRollText | null> {
    return this.diceRollTextModel.findOneAndDelete({ textId: id }).exec()
  }

  /**
   * チャンネルIDによってダイスロールテキストを削除する
   * @param channelId DiscordチャンネルID
   */
  async removeByChannelId(channelId: string): Promise<void> {
    await this.diceRollTextModel.deleteMany({ discordChannelId: channelId }).exec()
  }
}
