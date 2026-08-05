import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

/**
 * ユーザードキュメント
 */
export type UserDocument = User & Document

/**
 * ユーザースキーマ定義
 */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  discordUserId: string

  @Prop({ required: true })
  name: string

  @Prop({ required: false })
  avatarHash?: string

  @Prop({ type: [String], default: [] })
  characterIds: string[]

  // Discord OAuth トークン管理フィールド
  @Prop({ required: false })
  discordAccessToken?: string // 暗号化されたアクセストークン

  @Prop({ required: false })
  discordRefreshToken?: string // 暗号化されたリフレッシュトークン

  @Prop({ required: false })
  discordTokenExpiresAt?: Date // トークン有効期限

  @Prop({ required: false })
  discordTokenScope?: string // 取得したスコープ情報（space区切り）
}

/**
 * ユーザースキーマファクトリ
 */
export const UserSchema = SchemaFactory.createForClass(User)

/**
 * ユーザーモデル名
 */
export const USER_MODEL = 'User'
