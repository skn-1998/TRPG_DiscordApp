import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

/**
 * キャラクタードキュメント
 */
export type CharacterDocument = Character & Document

/**
 * キャラクタースキーマ定義
 */
@Schema({ timestamps: true })
export class Character {
  @Prop({ required: true, unique: true })
  characterId: string

  @Prop({ required: true })
  characterName: string

  @Prop({ required: false, default: '' })
  TRPGName: string

  @Prop({ required: false, default: '' })
  discordUserId: string

  @Prop()
  discordChannelId: string

  @Prop({ type: Object, default: {} })
  status: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  skill: Record<string, unknown>

  @Prop({ type: Object, default: {} })
  parameter: Record<string, unknown>

  @Prop()
  messageID?: string
}

/**
 * 更新可能なプライマリフィールド
 */
export type UpdatePrimary = 'status' | 'parameter' | 'skill'

/**
 * キャラクタースキーマファクトリ
 */
export const CharacterSchema = SchemaFactory.createForClass(Character)

/**
 * キャラクターモデル名
 */
export const CHARACTER_MODEL = 'Character'

/**
 * コレクション名
 */
export const CHARACTER_COLLECTION = 'trpg-Character'
