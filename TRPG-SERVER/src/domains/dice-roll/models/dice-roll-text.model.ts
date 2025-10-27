import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

/**
 * ダイスロールテキストドキュメント
 */
export type DiceRollTextDocument = DiceRollText & Document

/**
 * ダイスロールテキストスキーマ定義
 */
@Schema({ timestamps: true })
export class DiceRollText {
  @Prop({ required: true, unique: true })
  textId: string

  @Prop({ required: true })
  discordChannelId: string

  @Prop({ required: false })
  characterId: string

  @Prop({ required: true })
  result: number

  @Prop({ required: true })
  diceRoll: string

  @Prop({ required: true })
  text: string

  @Prop({ required: false })
  gameSystemId: string

  @Prop({ type: Boolean, default: false })
  isSecret: boolean

  @Prop({ type: Date, default: Date.now })
  createdAt: Date

  // 新しいフィールド（オプション・後方互換性）
  @Prop({ required: false })
  userId?: string

  @Prop({ required: false })
  diceExpression?: string

  @Prop({ required: false })
  resultDetails?: string

  @Prop({ required: false })
  reason?: string

  @Prop({ required: false })
  characterName?: string

  @Prop({ required: false })
  gameSystem?: string

  // MongoDB _id プロパティの追加
  _id?: any
}

/**
 * ダイスロールテキストスキーマファクトリ
 */
export const DiceRollTextSchema = SchemaFactory.createForClass(DiceRollText)

/**
 * ダイスロールテキストモデル名
 */
export const DICE_ROLL_TEXT_MODEL = 'DiceRollText'

/**
 * コレクション名
 */
export const DICE_ROLL_TEXT_COLLECTION = 'trpg-DiceRollText'
