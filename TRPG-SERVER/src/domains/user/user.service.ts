import { Injectable } from '@nestjs/common'
import { User } from './models/user.model'
import { UserRepository } from './repositories/user.repository'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'

/**
 * ユーザーサービス
 */
@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  /**
   * ユーザーを作成する
   * @param createUserDto ユーザー作成DTO
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    return this.userRepository.create(createUserDto)
  }

  /**
   * すべてのユーザーを取得する
   */
  async findAll(): Promise<User[]> {
    return this.userRepository.findAll()
  }

  /**
   * 特定のユーザーを取得する
   * @param discordUserId DiscordユーザーID
   */
  async findOne(discordUserId: string): Promise<User | null> {
    return this.userRepository.findById(discordUserId)
  }

  /**
   * DiscordユーザーIDでユーザーを検索する
   * @param discordUserId DiscordユーザーID
   * @returns ユーザーまたはnull
   */
  async findByDiscordId(discordUserId: string): Promise<User | null> {
    return this.userRepository.findByDiscordId(discordUserId)
  }

  /**
   * ユーザーを更新する
   * @param discordUserId DiscordユーザーID
   * @param updateUserDto 更新データ
   */
  async update(discordUserId: string, updateUserDto: UpdateUserDto): Promise<User | null> {
    return this.userRepository.update(discordUserId, updateUserDto)
  }

  /**
   * キャラクターIDをユーザーに追加する
   * @param discordUserId DiscordユーザーID
   * @param characterId 追加するキャラクターID
   */
  async addCharacterId(discordUserId: string, characterId: string): Promise<User | null> {
    return this.userRepository.addCharacterId(discordUserId, characterId)
  }

  /**
   * キャラクターIDをユーザーから削除する
   * @param discordUserId DiscordユーザーID
   * @param characterId 削除するキャラクターID
   */
  async removeCharacterId(discordUserId: string, characterId: string): Promise<User | null> {
    return this.userRepository.removeCharacterId(discordUserId, characterId)
  }

  /**
   * ユーザーを削除する
   * @param discordUserId DiscordユーザーID
   */
  async remove(discordUserId: string): Promise<void> {
    await this.userRepository.remove(discordUserId)
  }
}
