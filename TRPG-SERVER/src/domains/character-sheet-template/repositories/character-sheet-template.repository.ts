import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { SYSTEM_TEMPLATE_AUTHOR } from '../character-sheet-template.constants'
import { CharacterSheetTemplateEntity, CharacterSheetTemplateSummary } from '../models/character-sheet-template.entity'
import {
  CHARACTER_SHEET_TEMPLATE_MODEL,
  CharacterSheetTemplateDocument
} from '../models/character-sheet-template.model'

const FULL_TEMPLATE_SELECT =
  'templateId status version schemaVersion name gameSystemId tags visibility authorDiscordUserId forkedFrom license sections tables settings draftRevision publishedAt createdAt updatedAt'

const SUMMARY_TEMPLATE_SELECT =
  'templateId status version schemaVersion name gameSystemId tags visibility authorDiscordUserId forkedFrom license draftRevision publishedAt createdAt updatedAt -_id'

@Injectable()
export class CharacterSheetTemplateRepository {
  constructor(
    @InjectModel(CHARACTER_SHEET_TEMPLATE_MODEL)
    private readonly templateModel: Model<CharacterSheetTemplateDocument>
  ) {}

  async create(entity: CharacterSheetTemplateEntity): Promise<CharacterSheetTemplateEntity> {
    const created = new this.templateModel(entity)
    const saved = await created.save()
    return saved.toObject()
  }

  async findById(templateId: string): Promise<CharacterSheetTemplateEntity | null> {
    return this.templateModel.findOne({ templateId }).select(FULL_TEMPLATE_SELECT).lean().exec()
  }

  async findListedSummariesForRequester(requesterDiscordUserId: string): Promise<CharacterSheetTemplateSummary[]> {
    // system 所有の published だけを一覧で配布する読み取り特例。mutation は所有者限定のまま変更しない。
    return this.templateModel
      .find({
        $or: [
          { authorDiscordUserId: requesterDiscordUserId },
          { authorDiscordUserId: SYSTEM_TEMPLATE_AUTHOR, status: 'published' }
        ]
      })
      .select(SUMMARY_TEMPLATE_SELECT)
      .sort({ updatedAt: -1 })
      .lean()
      .exec()
  }

  async updateDraft(
    templateId: string,
    authorDiscordUserId: string,
    draftRevision: number,
    updateData: Partial<CharacterSheetTemplateEntity>
  ): Promise<CharacterSheetTemplateEntity | null> {
    return this.templateModel
      .findOneAndUpdate(
        { templateId, authorDiscordUserId, status: 'draft', draftRevision },
        { $set: updateData, $inc: { draftRevision: 1 } },
        { new: true }
      )
      .select(FULL_TEMPLATE_SELECT)
      .lean()
      .exec()
  }

  async patchMetadata(
    templateId: string,
    authorDiscordUserId: string,
    updateData: Pick<Partial<CharacterSheetTemplateEntity>, 'name' | 'tags'>
  ): Promise<CharacterSheetTemplateEntity | null> {
    return this.templateModel
      .findOneAndUpdate(
        { templateId, authorDiscordUserId, status: { $in: ['published', 'deprecated'] } },
        { $set: updateData },
        { new: true }
      )
      .select(FULL_TEMPLATE_SELECT)
      .lean()
      .exec()
  }

  async publish(
    templateId: string,
    authorDiscordUserId: string,
    draftRevision: number,
    publishedAt: Date
  ): Promise<CharacterSheetTemplateEntity | null> {
    return this.templateModel
      .findOneAndUpdate(
        { templateId, authorDiscordUserId, status: 'draft', draftRevision },
        { $set: { status: 'published', publishedAt } },
        { new: true }
      )
      .select(FULL_TEMPLATE_SELECT)
      .lean()
      .exec()
  }

  async deprecatePublished(
    templateId: string,
    authorDiscordUserId: string
  ): Promise<CharacterSheetTemplateEntity | null> {
    return this.templateModel
      .findOneAndUpdate(
        { templateId, authorDiscordUserId, status: 'published' },
        { $set: { status: 'deprecated' } },
        { new: true }
      )
      .select(FULL_TEMPLATE_SELECT)
      .lean()
      .exec()
  }

  async removeDraft(templateId: string, authorDiscordUserId: string): Promise<CharacterSheetTemplateEntity | null> {
    return this.templateModel
      .findOneAndDelete({ templateId, authorDiscordUserId, status: 'draft' })
      .select(FULL_TEMPLATE_SELECT)
      .lean()
      .exec()
  }
}
