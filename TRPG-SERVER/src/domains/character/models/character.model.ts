/* eslint-disable indent */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { AttributeSection } from '../../../core/types/attribute.types'

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
  gameSystemId: string

  @Prop({ required: false, default: '' })
  discordUserId: string

  @Prop()
  discordChannelId: string

  @Prop()
  discordEditChannelId?: string

  @Prop({ type: Object, default: {} })
  status: AttributeSection

  @Prop({ type: Object, default: {} })
  skill?: AttributeSection

  @Prop({ type: Object, default: {} })
  parameter?: AttributeSection

  @Prop({ type: Object, default: {} })
  item?: AttributeSection

  @Prop({ type: Object, default: {} })
  description?: AttributeSection
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
