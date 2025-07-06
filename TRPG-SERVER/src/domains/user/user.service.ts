import { Injectable } from '@nestjs/common'
import { User } from './models/user.model'
import { UserRepository } from './repositories/user.repository'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { CryptoUtil } from '../../utils/crypto.util'

/**
 * ユーザーサービス
 */
@Injectable()
export class UserService {
  validateToken(_authorization: string) {
    throw new Error('Method not implemented.')
  }
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
    return await this.userRepository.findByDiscordId(discordUserId)
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

  /**
   * ユーザーのDiscordトークン情報を更新する
   * @param discordUserId DiscordユーザーID
   * @param tokenData トークンデータ
   */
  async updateDiscordTokens(
    discordUserId: string,
    tokenData: {
      accessToken: string
      refreshToken: string
      expiresAt: Date
      scope: string
    }
  ): Promise<User | null> {
    return this.userRepository.updateDiscordTokens(discordUserId, tokenData)
  }

  /**
   * ユーザーのDiscordアクセストークンを取得する
   * @param discordUserId DiscordユーザーID
   * @returns アクセストークンまたはnull
   */
  async getDiscordAccessToken(discordUserId: string): Promise<string | null> {
    const user = await this.userRepository.findByDiscordId(discordUserId)

    if (!user || !user.discordAccessToken) {
      return null
    }

    // トークン有効期限をチェック
    if (user.discordTokenExpiresAt && user.discordTokenExpiresAt < new Date()) {
      // トークンが期限切れの場合はnullを返す
      return null
    }

    try {
      // 暗号化されたトークンを復号化
      return CryptoUtil.decrypt(user.discordAccessToken)
    } catch (error) {
      // 復号化に失敗した場合はnullを返す
      return null
    }
  }
}
