import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { Repository } from 'src/core/interfaces/repository.interface'
import { User, USER_MODEL, UserDocument } from '../models/user.model'

/**
 * ユーザーリポジトリの実装
 */
@Injectable()
export class UserRepository implements Repository<User, string> {
  constructor(
    @InjectModel(USER_MODEL)
    private readonly userModel: Model<UserDocument>
  ) {}

  /**
   * ユーザーを作成する
   * @param entity ユーザーデータ
   */
  async create(entity: Partial<User>): Promise<User> {
    const createdUser = new this.userModel(entity)
    return createdUser.save()
  }

  /**
   * IDによってユーザーを検索する
   * @param id DiscordユーザーID
   */
  async findById(id: string): Promise<User | null> {
    return this.userModel.findOne({ discordUserId: id }).exec()
  }

  /**
   * DiscordユーザーIDでユーザーを検索する
   * @param discordUserId DiscordユーザーID
   */
  async findByDiscordId(discordUserId: string): Promise<User | null> {
    return this.userModel.findOne({ discordUserId }).exec()
  }

  /**
   * 条件に一致するすべてのユーザーを検索する
   * @param filter フィルター条件
   */
  async findAll(filter?: Partial<User>): Promise<User[]> {
    return this.userModel.find(filter || {}).exec()
  }

  /**
   * ユーザーを更新する
   * @param id DiscordユーザーID
   * @param updateData 更新するデータ
   */
  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    return this.userModel.findOneAndUpdate({ discordUserId: id }, updateData, { new: true }).exec()
  }

  /**
   * ユーザーを削除する
   * @param id DiscordユーザーID
   */
  async remove(id: string): Promise<void> {
    await this.userModel.deleteOne({ discordUserId: id }).exec()
  }

  /**
   * キャラクターIDをユーザーに追加する
   * @param userId DiscordユーザーID
   * @param characterId 追加するキャラクターID
   */
  async addCharacterId(userId: string, characterId: string): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate({ discordUserId: userId }, { $addToSet: { characterIds: characterId } }, { new: true })
      .exec()
  }

  /**
   * キャラクターIDをユーザーから削除する
   * @param userId DiscordユーザーID
   * @param characterId 削除するキャラクターID
   */
  async removeCharacterId(userId: string, characterId: string): Promise<User | null> {
    return this.userModel
      .findOneAndUpdate({ discordUserId: userId }, { $pull: { characterIds: characterId } }, { new: true })
      .exec()
  }
}
