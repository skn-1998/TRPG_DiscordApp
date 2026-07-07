import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import { AttributeSection } from '../../../core/types/attribute.types'

/**
 * キャラクタードキュメント
 */
export type CharacterDocument = Character & Document

/**
 * キャラクタースキーマ定義（persistence 専用・E-6d）
 *
 * ⚠ この @Schema クラスは Mongoose の永続化定義であり、domains/character 内部
 * （repository / module の schema 登録）でのみ import すること。
 * 公開型としては plain interface の `CharacterEntity`（character.entity.ts）を使う。
 * フィールドを増減する場合は CharacterEntity と同期させること。
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
  discordThreadId?: string

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
