import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose'
import { Document } from 'mongoose'
import {
  SheetTemplateForkedFrom,
  SheetTemplateSection,
  SheetTemplateSettings,
  SheetTemplateStatus,
  SheetTemplateTable,
  SheetTemplateVisibility
} from './character-sheet-template.entity'

export type CharacterSheetTemplateDocument = CharacterSheetTemplate & Document

/**
 * シートテンプレートスキーマ定義（persistence 専用）
 *
 * 公開型は character-sheet-template.entity.ts の plain interface を使う。
 */
@Schema({ timestamps: true })
export class CharacterSheetTemplate {
  @Prop({ required: true, unique: true, index: true })
  templateId: string

  @Prop({ required: true, enum: ['draft', 'published', 'deprecated'], default: 'draft', index: true })
  status: SheetTemplateStatus

  @Prop({ required: true })
  version: string

  @Prop({ required: true, default: 3 })
  schemaVersion: 3

  @Prop({ required: true })
  name: string

  @Prop()
  gameSystemId?: string

  @Prop({ type: [String], default: [] })
  tags: string[]

  @Prop({ required: true, enum: ['private', 'unlisted', 'public'], default: 'private', index: true })
  visibility: SheetTemplateVisibility

  @Prop({ required: true, index: true })
  authorDiscordUserId: string

  @Prop({ type: Object })
  forkedFrom?: SheetTemplateForkedFrom

  @Prop()
  license?: string

  @Prop({ type: [Object], default: [] })
  sections: SheetTemplateSection[]

  @Prop({ type: [Object], default: [] })
  tables: SheetTemplateTable[]

  @Prop({ type: Object, default: { rounding: 'floor' } })
  settings: SheetTemplateSettings

  @Prop({ required: true, default: 1 })
  draftRevision: number

  @Prop()
  publishedAt?: Date
}

export const CharacterSheetTemplateSchema = SchemaFactory.createForClass(CharacterSheetTemplate)

export const CHARACTER_SHEET_TEMPLATE_MODEL = 'CharacterSheetTemplate'

export const CHARACTER_SHEET_TEMPLATE_COLLECTION = 'trpg-CharacterSheetTemplate'
