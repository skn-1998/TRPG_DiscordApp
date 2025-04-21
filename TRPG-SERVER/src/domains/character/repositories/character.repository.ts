import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Repository } from 'src/core/interfaces/repository.interface';
import { 
  Character, 
  CHARACTER_MODEL, 
  CharacterDocument, 
  UpdatePrimary 
} from '../models/character.model';

/**
 * キャラクターリポジトリの実装
 */
@Injectable()
export class CharacterRepository implements Repository<Character, string> {
  constructor(
    @InjectModel(CHARACTER_MODEL)
    private readonly characterModel: Model<CharacterDocument>,
  ) {}

  /**
   * キャラクターを作成する
   * @param entity キャラクターデータ
   */
  async create(entity: Partial<Character>): Promise<Character> {
    const createdCharacter = new this.characterModel(entity);
    return createdCharacter.save();
  }

  /**
   * IDによってキャラクターを検索する
   * @param id キャラクターID
   */
  async findById(id: string): Promise<Character | null> {
    return this.characterModel.findOne({ characterId: id }).exec();
  }

  /**
   * ChannelIDによってキャラクターを検索する
   * @param channelId DiscordチャンネルID
   */
  async findByChannelId(channelId: string): Promise<Character | null> {
    return this.characterModel.findOne({ discordChannelId: channelId }).exec();
  }

  /**
   * 条件に一致するすべてのキャラクターを検索する
   * @param filter フィルター条件
   */
  async findAll(filter?: Partial<Character>): Promise<Character[]> {
    return this.characterModel.find(filter || {}).exec();
  }

  /**
   * ユーザーが所有するすべてのキャラクターを検索する
   * @param discordUserId DiscordユーザーID
   */
  async findByUserId(discordUserId: string): Promise<Character[]> {
    return this.characterModel.find({ discordUserId }).exec();
  }

  /**
   * キャラクターを更新する
   * @param id キャラクターID
   * @param updateData 更新するデータ
   */
  async update(id: string, updateData: Partial<Character>): Promise<Character | null> {
    return this.characterModel
      .findOneAndUpdate({ characterId: id }, updateData, { new: true })
      .exec();
  }

  /**
   * チャンネルIDによってキャラクターを更新する
   * @param channelId DiscordチャンネルID
   * @param updateData 更新するデータ
   */
  async updateByChannelId(channelId: string, updateData: Partial<Character>): Promise<Character | null> {
    return this.characterModel
      .findOneAndUpdate({ discordChannelId: channelId }, updateData, { new: true })
      .exec();
  }

  /**
   * 特定のフィールドを更新する
   * @param id キャラクターID
   * @param field 更新するフィールド
   * @param data 更新するデータ
   */
  async updateField(
    id: string, 
    field: UpdatePrimary, 
    data: Record<string, unknown>
  ): Promise<Character | null> {
    const updateData = { [field]: data };
    return this.update(id, updateData);
  }

  /**
   * チャンネルIDによって特定のフィールドを更新する
   * @param channelId DiscordチャンネルID
   * @param field 更新するフィールド
   * @param data 更新するデータ
   */
  async updateFieldByChannelId(
    channelId: string, 
    field: UpdatePrimary, 
    data: Record<string, unknown>
  ): Promise<Character | null> {
    const updateData = { [field]: data };
    return this.updateByChannelId(channelId, updateData);
  }

  /**
   * キャラクターを削除する
   * @param id キャラクターID
   */
  async remove(id: string): Promise<void> {
    await this.characterModel.deleteOne({ characterId: id }).exec();
  }

  /**
   * チャンネルIDによってキャラクターを削除する
   * @param channelId DiscordチャンネルID
   */
  async removeByChannelId(channelId: string): Promise<void> {
    await this.characterModel.deleteOne({ discordChannelId: channelId }).exec();
  }
} 