/* eslint-disable indent */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { CharacterAttribute } from '../dto/create-character.dto'

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
  TRPGId: string

  @Prop({ required: false, default: '' })
  discordUserId: string

  @Prop()
  discordChannelId: string

  @Prop({ type: Object, default: {} })
  status: Record<string, CharacterAttribute> | Record<string, unknown>

  @Prop({ type: Object, default: {} })
  skill?: Record<string, CharacterAttribute> | Record<string, unknown>

  @Prop({ type: Object, default: {} })
  parameter?: Record<string, CharacterAttribute> | Record<string, unknown>

  @Prop({ type: Object, default: {} })
  item?: Record<string, CharacterAttribute> | Record<string, unknown>

  @Prop({ type: Object, default: {} })
  description?: Record<string, CharacterAttribute> | Record<string, unknown>
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
