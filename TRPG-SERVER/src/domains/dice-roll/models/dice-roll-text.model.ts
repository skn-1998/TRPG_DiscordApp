/* eslint-disable indent */
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
  TRPGId: string

  @Prop({ type: Boolean, default: false })
  isSecret: boolean

  @Prop({ type: Date, default: Date.now })
  createdAt: Date
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
