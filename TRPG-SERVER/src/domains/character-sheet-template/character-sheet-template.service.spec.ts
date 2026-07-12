import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { v4 as uuidv4 } from 'uuid'
import { CharacterSheetTemplateService } from './character-sheet-template.service'
import { CharacterSheetTemplateRepository } from './repositories/character-sheet-template.repository'
import { TEMPLATE_VALIDATION_PORT, TemplateValidationPort } from './validation/template-validation.port'
import { CharacterSheetTemplateEntity } from './models/character-sheet-template.entity'

jest.mock('uuid', () => ({ v4: jest.fn() }))

describe('CharacterSheetTemplateService', () => {
  let service: CharacterSheetTemplateService
  let repository: jest.Mocked<CharacterSheetTemplateRepository>
  let validationPort: jest.Mocked<TemplateValidationPort>

  const template: CharacterSheetTemplateEntity = {
    templateId: 'template-1',
    status: 'draft',
    version: '0.1.0',
    schemaVersion: 3,
    name: 'Template',
    tags: [],
    visibility: 'private',
    authorDiscordUserId: 'user-1',
    sections: [
      {
        id: 'main',
        fields: [{ id: 'hp', uid: 'uid-hp', label: 'HP', type: 'scalar' }]
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  beforeEach(async () => {
    const repositoryMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findSummariesByAuthor: jest.fn(),
      updateDraft: jest.fn(),
      patchMetadata: jest.fn(),
      publish: jest.fn(),
      deprecatePublished: jest.fn(),
      removeDraft: jest.fn()
    }

    const validationPortMock = {
      validateForSave: jest.fn(),
      validateForPublish: jest.fn()
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterSheetTemplateService,
        { provide: CharacterSheetTemplateRepository, useValue: repositoryMock },
        { provide: TEMPLATE_VALIDATION_PORT, useValue: validationPortMock }
      ]
    }).compile()

    service = moduleRef.get(CharacterSheetTemplateService)
    repository = moduleRef.get(CharacterSheetTemplateRepository)
    validationPort = moduleRef.get(TEMPLATE_VALIDATION_PORT)
    ;(uuidv4 as jest.Mock).mockReturnValue('generated-template-id')
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('draft 作成時は authorDiscordUserId を JWT 由来値で固定し、保存前検証を通す', async () => {
    repository.create.mockImplementation(async (entity) => entity)

    const result = await service.create(
      {
        name: 'New Template',
        sections: template.sections,
        settings: { rounding: 'round' }
      },
      'user-1'
    )

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'generated-template-id',
        status: 'draft',
        version: '0.1.0',
        schemaVersion: 3,
        name: 'New Template',
        authorDiscordUserId: 'user-1',
        visibility: 'private',
        draftRevision: 1,
        settings: { rounding: 'round' }
      })
    )
    expect(validationPort.validateForSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Template' }))
    expect(result.authorDiscordUserId).toBe('user-1')
  })

  it('一覧は自分のサマリー取得に委譲する', async () => {
    const summaries = [{ templateId: 'template-1', name: 'Template' }] as any
    repository.findSummariesByAuthor.mockResolvedValue(summaries)

    await expect(service.findSummaries('user-1')).resolves.toBe(summaries)
    expect(repository.findSummariesByAuthor).toHaveBeenCalledWith('user-1')
  })

  it('単体取得は所有者のみ許可する', async () => {
    repository.findById.mockResolvedValue(template)

    await expect(service.findOne('template-1', 'other-user')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('存在しないテンプレートは 404', async () => {
    repository.findById.mockResolvedValue(null)

    await expect(service.findOne('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('draft autosave は draftRevision 不一致を 409 にする', async () => {
    repository.findById.mockResolvedValue(template)

    await expect(service.update('template-1', { draftRevision: 0, name: 'Updated' }, 'user-1')).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(repository.updateDraft).not.toHaveBeenCalled()
  })

  it('draft autosave は構造を検証して draftRevision をインクリメントする repository に委譲する', async () => {
    const updated = { ...template, name: 'Updated', draftRevision: 2 }
    repository.findById.mockResolvedValue(template)
    repository.updateDraft.mockResolvedValue(updated)

    const result = await service.update('template-1', { draftRevision: 1, name: 'Updated' }, 'user-1')

    expect(validationPort.validateForSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Updated' }))
    expect(repository.updateDraft).toHaveBeenCalledWith('template-1', 'user-1', 1, { name: 'Updated' })
    expect(result).toBe(updated)
  })

  it('published への構造変更は 409', async () => {
    repository.findById.mockResolvedValue({ ...template, status: 'published' })

    await expect(service.update('template-1', { sections: [], draftRevision: 1 }, 'user-1')).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(repository.patchMetadata).not.toHaveBeenCalled()
  })

  it('published は name/tags のメタ patch のみ許可する', async () => {
    const published = { ...template, status: 'published' as const, visibility: 'public' as const }
    const patched = { ...published, name: 'Patched', tags: ['coc'] }
    repository.findById.mockResolvedValue(published)
    repository.patchMetadata.mockResolvedValue(patched)

    const result = await service.update('template-1', { name: 'Patched', tags: ['coc'] }, 'user-1')

    expect(repository.patchMetadata).toHaveBeenCalledWith('template-1', 'user-1', {
      name: 'Patched',
      tags: ['coc']
    })
    expect(result).toBe(patched)
  })

  it('publish は validateForPublish 後に published へ遷移する', async () => {
    const published = { ...template, status: 'published' as const, visibility: 'public' as const }
    repository.findById.mockResolvedValue({ ...template, visibility: 'public' })
    repository.publish.mockResolvedValue(published)

    const result = await service.publish('template-1', 'user-1')

    expect(validationPort.validateForPublish).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'template-1' })
    )
    expect(repository.publish).toHaveBeenCalledWith('template-1', 'user-1', 1, expect.any(Date))
    expect(result).toBe(published)
  })

  it('publish は validateForPublish 後に draftRevision 競合が起きたら 409', async () => {
    repository.findById.mockResolvedValue({ ...template, visibility: 'public' })
    repository.publish.mockResolvedValue(null)

    await expect(service.publish('template-1', 'user-1')).rejects.toBeInstanceOf(ConflictException)

    expect(validationPort.validateForPublish).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'template-1' })
    )
    expect(repository.publish).toHaveBeenCalledWith('template-1', 'user-1', 1, expect.any(Date))
  })

  it('draft delete は物理削除結果を返す', async () => {
    repository.findById.mockResolvedValue(template)
    repository.removeDraft.mockResolvedValue(template)

    await expect(service.remove('template-1', 'user-1')).resolves.toEqual({
      templateId: 'template-1',
      status: 'draft',
      deleted: true
    })
    expect(repository.removeDraft).toHaveBeenCalledWith('template-1', 'user-1')
  })

  it('published delete は deprecated へ遷移する', async () => {
    const published = { ...template, status: 'published' as const, visibility: 'public' as const }
    const deprecated = { ...published, status: 'deprecated' as const }
    repository.findById.mockResolvedValue(published)
    repository.deprecatePublished.mockResolvedValue(deprecated)

    await expect(service.remove('template-1', 'user-1')).resolves.toBe(deprecated)
    expect(repository.deprecatePublished).toHaveBeenCalledWith('template-1', 'user-1')
  })

  it('Zod 構造検証に失敗した作成は 400', async () => {
    await expect(service.create({ name: 'Broken', version: 'not-semver' }, 'user-1')).rejects.toBeInstanceOf(
      BadRequestException
    )
    expect(repository.create).not.toHaveBeenCalled()
  })
})
