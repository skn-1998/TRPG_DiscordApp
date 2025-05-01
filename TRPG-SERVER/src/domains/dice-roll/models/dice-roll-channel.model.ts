import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'

/**
 * ダイスロールチャンネルドキュメント
 */
export type DiceRollChannelDocument = DiceRollChannel & Document

/**
 * ダイスロールチャンネルスキーマ定義
 */
@Schema({ timestamps: true })
export class DiceRollChannel {
  @Prop({ required: true, unique: true })
  discordChannelId: string

  @Prop({ type: [String], default: [] })
  characterIds: string[]

  @Prop({ type: [String], default: [] })
  textIds: string[]

  @Prop({ type: String, default: [] })
  embedId: string

  @Prop({ type: Boolean, default: false })
  isSecret: boolean
}
/**
 * ダイスロールチャンネルスキーマファクトリ
 */
export const DiceRollChannelSchema = SchemaFactory.createForClass(DiceRollChannel)

/**
 * ダイスロールチャンネルモデル名
 */
export const DICE_ROLL_CHANNEL_MODEL = 'DiceRollChannel'

/**
 * コレクション名
 */
export const DICE_ROLL_CHANNEL_COLLECTION = 'trpg-DiceRollChannel'
