import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Repository } from 'src/core/interfaces/repository.interface'
import { DiceRollChannel, DICE_ROLL_CHANNEL_MODEL, DiceRollChannelDocument } from '../models/dice-roll-channel.model'

/**
 * ダイスロールチャンネルリポジトリの実装
 */
@Injectable()
export class DiceRollChannelRepository implements Repository<DiceRollChannel, string> {
  constructor(
    @InjectModel(DICE_ROLL_CHANNEL_MODEL)
    private readonly diceRollChannelModel: Model<DiceRollChannelDocument>
  ) {}

  /**
   * ダイスロールチャンネルを作成する
   * @param entity ダイスロールチャンネルデータ
   */
  async create(entity: Partial<DiceRollChannel>): Promise<DiceRollChannel> {
    const createdDiceRollChannel = new this.diceRollChannelModel(entity)
    return createdDiceRollChannel.save()
  }

  /**
   * IDによってダイスロールチャンネルを検索する
   * @param id DiscordチャンネルID
   */
  async findById(id: string): Promise<DiceRollChannel | null> {
    return this.diceRollChannelModel.findOne({ discordChannelId: id }).exec()
  }

  /**
   * チャンネルIDによってダイスロールチャンネルを検索する
   * @param channelId DiscordチャンネルID
   */
  async findByChannelId(channelId: string): Promise<DiceRollChannel | null> {
    return this.findById(channelId)
  }

  /**
   * 条件に一致するすべてのダイスロールチャンネルを検索する
   * @param filter フィルター条件
   */
  async findAll(filter?: Partial<DiceRollChannel>): Promise<DiceRollChannel[]> {
    return this.diceRollChannelModel.find(filter || {}).exec()
  }

  /**
   * ダイスロールチャンネルを更新する
   * @param channelId DiscordチャンネルID
   * @param updateData 更新するデータ
   */
  async update(channelId: string, updateData: Partial<DiceRollChannel>): Promise<DiceRollChannel | null> {
    return this.diceRollChannelModel.findOneAndUpdate({ discordChannelId: channelId }, updateData, { new: true }).exec()
  }

  /**
   * テキストIDをダイスロールチャンネルに追加する
   * @param channelId DiscordチャンネルID
   * @param textId テキストID
   */
  async addTextId(channelId: string, textId: string): Promise<DiceRollChannel | null> {
    return this.diceRollChannelModel
      .findOneAndUpdate({ discordChannelId: channelId }, { $addToSet: { textIds: textId } }, { new: true })
      .exec()
  }

  /**
   * キャラクターIDをダイスロールチャンネルに追加する
   * @param channelId DiscordチャンネルID
   * @param characterId キャラクターID
   */
  async addCharacterId(channelId: string, characterId: string): Promise<DiceRollChannel | null> {
    return this.diceRollChannelModel
      .findOneAndUpdate({ discordChannelId: channelId }, { $addToSet: { characterIds: characterId } }, { new: true })
      .exec()
  }

  /**
   * エンベッドIDをダイスロールチャンネルに追加する
   * @param channelId DiscordチャンネルID
   * @param embedId エンベッドID
   */
  async addEmbedId(channelId: string, embedId: string): Promise<DiceRollChannel | null> {
    return this.diceRollChannelModel
      .findOneAndUpdate({ discordChannelId: channelId }, { embedId: embedId }, { new: true })
      .exec()
  }

  /**
   * ダイスロールチャンネルを削除する
   * @param channelId DiscordチャンネルID
   */
  async remove(channelId: string): Promise<void> {
    await this.diceRollChannelModel.deleteOne({ discordChannelId: channelId }).exec()
  }
}
