import { Test, TestingModule } from '@nestjs/testing'
import { getModelToken } from '@nestjs/mongoose'
import { CharacterSheetTemplateRepository } from './character-sheet-template.repository'
import { CHARACTER_SHEET_TEMPLATE_MODEL } from '../models/character-sheet-template.model'
import { CharacterSheetTemplateEntity } from '../models/character-sheet-template.entity'

describe('CharacterSheetTemplateRepository', () => {
  let repository: CharacterSheetTemplateRepository
  let model: any

  const createQuery = (resolveValue: unknown) => {
    const query: any = {}
    query.select = jest.fn().mockReturnValue(query)
    query.lean = jest.fn().mockReturnValue(query)
    query.sort = jest.fn().mockReturnValue(query)
    query.exec = jest.fn().mockResolvedValue(resolveValue)
    return query
  }

  const template: CharacterSheetTemplateEntity = {
    templateId: 'template-1',
    status: 'draft',
    version: '0.1.0',
    schemaVersion: 3,
    name: 'Template',
    tags: [],
    visibility: 'private',
    authorDiscordUserId: 'user-1',
    sections: [],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  beforeEach(async () => {
    model = jest.fn()
    model.findOne = jest.fn()
    model.find = jest.fn()
    model.findOneAndUpdate = jest.fn()
    model.findOneAndDelete = jest.fn()

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterSheetTemplateRepository,
        {
          provide: getModelToken(CHARACTER_SHEET_TEMPLATE_MODEL),
          useValue: model
        }
      ]
    }).compile()

    repository = moduleRef.get(CharacterSheetTemplateRepository)
  })

  it('作成時は save 後に toObject() で plain 化して返す', async () => {
    const toObject = jest.fn().mockReturnValue(template)
    const save = jest.fn().mockResolvedValue({ ...template, toObject })
    model.mockImplementation((arg: unknown) => ({ ...(arg as object), save }))

    const result = await repository.create(template)

    expect(model).toHaveBeenCalledWith(template)
    expect(save).toHaveBeenCalledTimes(1)
    expect(toObject).toHaveBeenCalledTimes(1)
    expect(result).toBe(template)
  })

  it('findById は templateId 条件・明示 select・lean で取得する', async () => {
    const query = createQuery(template)
    model.findOne.mockReturnValue(query)

    const result = await repository.findById('template-1')

    expect(model.findOne).toHaveBeenCalledWith({ templateId: 'template-1' })
    expect(query.select).toHaveBeenCalledWith(
      'templateId status version schemaVersion name gameSystemId tags visibility authorDiscordUserId forkedFrom license sections tables settings draftRevision publishedAt createdAt updatedAt'
    )
    expect(query.lean).toHaveBeenCalledTimes(1)
    expect(result).toBe(template)
  })

  it('findSummariesByAuthor は sections/tables を含まない projection で一覧取得する', async () => {
    const summaries = [{ templateId: 'template-1', name: 'Template' }]
    const query = createQuery(summaries)
    model.find.mockReturnValue(query)

    const result = await repository.findSummariesByAuthor('user-1')

    expect(model.find).toHaveBeenCalledWith({ authorDiscordUserId: 'user-1' })
    expect(query.select).toHaveBeenCalledWith(
      'templateId status version schemaVersion name gameSystemId tags visibility authorDiscordUserId forkedFrom license draftRevision publishedAt createdAt updatedAt -_id'
    )
    expect(query.sort).toHaveBeenCalledWith({ updatedAt: -1 })
    expect(query.lean).toHaveBeenCalledTimes(1)
    expect(result).toBe(summaries)
  })

  it('updateDraft は draftRevision を条件にして $inc する', async () => {
    const query = createQuery({ ...template, draftRevision: 2 })
    model.findOneAndUpdate.mockReturnValue(query)

    const result = await repository.updateDraft('template-1', 'user-1', 1, { name: 'Updated' })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { templateId: 'template-1', authorDiscordUserId: 'user-1', status: 'draft', draftRevision: 1 },
      { $set: { name: 'Updated' }, $inc: { draftRevision: 1 } },
      { new: true }
    )
    expect(query.select).toHaveBeenCalledWith(
      'templateId status version schemaVersion name gameSystemId tags visibility authorDiscordUserId forkedFrom license sections tables settings draftRevision publishedAt createdAt updatedAt'
    )
    expect(result).toEqual({ ...template, draftRevision: 2 })
  })

  it('patchMetadata は published/deprecated の name/tags のみを $set して返す', async () => {
    const query = createQuery({ ...template, name: 'Published Name' })
    model.findOneAndUpdate.mockReturnValue(query)

    await repository.patchMetadata('template-1', 'user-1', { name: 'Published Name' })

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { templateId: 'template-1', authorDiscordUserId: 'user-1', status: { $in: ['published', 'deprecated'] } },
      { $set: { name: 'Published Name' } },
      { new: true }
    )
    expect(query.lean).toHaveBeenCalledTimes(1)
  })

  it('publish は draftRevision が一致する draft のみを published に遷移する', async () => {
    const publishedAt = new Date('2026-07-07T00:00:00.000Z')
    const query = createQuery({ ...template, status: 'published', publishedAt })
    model.findOneAndUpdate.mockReturnValue(query)

    await repository.publish('template-1', 'user-1', 1, publishedAt)

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { templateId: 'template-1', authorDiscordUserId: 'user-1', status: 'draft', draftRevision: 1 },
      { $set: { status: 'published', publishedAt } },
      { new: true }
    )
  })

  it('deprecatePublished は published のみを deprecated に遷移する', async () => {
    const query = createQuery({ ...template, status: 'deprecated' })
    model.findOneAndUpdate.mockReturnValue(query)

    await repository.deprecatePublished('template-1', 'user-1')

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { templateId: 'template-1', authorDiscordUserId: 'user-1', status: 'published' },
      { $set: { status: 'deprecated' } },
      { new: true }
    )
  })

  it('removeDraft は draft のみを物理削除する', async () => {
    const query = createQuery(template)
    model.findOneAndDelete.mockReturnValue(query)

    const result = await repository.removeDraft('template-1', 'user-1')

    expect(model.findOneAndDelete).toHaveBeenCalledWith({
      templateId: 'template-1',
      authorDiscordUserId: 'user-1',
      status: 'draft'
    })
    expect(query.select).toHaveBeenCalledWith(
      'templateId status version schemaVersion name gameSystemId tags visibility authorDiscordUserId forkedFrom license sections tables settings draftRevision publishedAt createdAt updatedAt'
    )
    expect(result).toBe(template)
  })
})
