import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

/**
 * ユーザードキュメント
 */
export type UserDocument = User & Document;

/**
 * ユーザースキーマ定義
 */
@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
    discordUserId: string

  @Prop({ required: true })
    name: string

  @Prop({ type: [String], default: [] })
    characterIds: string[]
}

/**
 * ユーザースキーマファクトリ
 */
export const UserSchema = SchemaFactory.createForClass(User)

/**
 * ユーザーモデル名
 */
export const USER_MODEL = 'User'

/**
 * コレクション名
 */
export const USER_COLLECTION = 'trpg-usertable' 