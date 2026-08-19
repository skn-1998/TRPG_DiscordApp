import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { v4 as uuidv4 } from 'uuid'
import { CharacterSheetTemplateService } from './character-sheet-template.service'
import { CharacterSheetTemplateRepository } from './repositories/character-sheet-template.repository'
import { TEMPLATE_VALIDATION_PORT, TemplateValidationPort } from './validation/template-validation.port'
import {
  CharacterSheetTemplateEntity,
  CharacterSheetTemplateSummary,
  SheetTemplateStatus,
  SheetTemplateVisibility
} from './models/character-sheet-template.entity'

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

  const summary = (
    templateId: string,
    authorDiscordUserId: string,
    status: SheetTemplateStatus,
    visibility: SheetTemplateVisibility
  ): CharacterSheetTemplateSummary => ({
    templateId,
    status,
    version: '1.0.0',
    schemaVersion: 3,
    name: templateId,
    tags: [],
    visibility,
    authorDiscordUserId,
    draftRevision: 1
  })

  beforeEach(async () => {
    const repositoryMock = {
      create: jest.fn(),
      findById: jest.fn(),
      findListedSummariesForRequester: jest.fn(),
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

  it('自分所有の draft を新しい要求者所有 draft として fork できる', async () => {
    repository.findById.mockResolvedValue(template)
    repository.create.mockImplementation(async (entity) => entity)

    const result = await service.fork('template-1', 'user-1')

    expect(result.templateId).not.toBe(template.templateId)
    expect(result).toMatchObject({
      status: 'draft',
      draftRevision: 1,
      authorDiscordUserId: 'user-1'
    })
  })

  it.each(['published', 'deprecated'] as const)('自分所有の status=%s も fork できる', async (status) => {
    repository.findById.mockResolvedValue({ ...template, status })
    repository.create.mockImplementation(async (entity) => entity)

    const result = await service.fork('template-1', 'user-1')

    expect(result.templateId).not.toBe(template.templateId)
    expect(result).toMatchObject({
      status: 'draft',
      draftRevision: 1,
      authorDiscordUserId: 'user-1'
    })
  })

  it('published かつ public の複製元でも fork 生成物は private にする', async () => {
    repository.findById.mockResolvedValue({ ...template, status: 'published', visibility: 'public' })
    repository.create.mockImplementation(async (entity) => entity)

    const result = await service.fork('template-1', 'user-1')

    expect(result.visibility).toBe('private')
  })

  it('fork 生成物は名前を加工し version とテンプレート定義を複製元から継承する', async () => {
    const source: CharacterSheetTemplateEntity = {
      ...template,
      version: '2.3.4',
      name: 'CoC Template',
      gameSystemId: 'Cthulhu7th',
      tags: ['coc', 'horror'],
      license: 'CC-BY-4.0',
      tables: [{ id: 'damage-bonus', resultType: 'number', rows: [] }],
      settings: { rounding: 'ceil', locale: 'ja' }
    }
    repository.findById.mockResolvedValue(source)
    repository.create.mockImplementation(async (entity) => entity)

    const result = await service.fork('template-1', 'user-1')

    expect(result).toMatchObject({
      name: 'CoC Template のコピー',
      version: source.version,
      gameSystemId: source.gameSystemId,
      tags: source.tags,
      license: source.license,
      sections: source.sections,
      tables: source.tables,
      settings: source.settings
    })
  })

  it('fork 生成物の forkedFrom に複製元の templateId と version を記録する', async () => {
    repository.findById.mockResolvedValue({ ...template, version: '1.2.3' })
    repository.create.mockImplementation(async (entity) => entity)

    const result = await service.fork('template-1', 'user-1')

    expect(result.forkedFrom).toStrictEqual({ templateId: 'template-1', version: '1.2.3' })
  })

  it('system 所有 published を非所有者が fork できる', async () => {
    repository.findById.mockResolvedValue({
      ...template,
      status: 'published',
      authorDiscordUserId: 'system'
    })
    repository.create.mockImplementation(async (entity) => entity)

    const result = await service.fork('template-1', 'user-1')

    expect(result).toMatchObject({ authorDiscordUserId: 'user-1', status: 'draft' })
  })

  it('system 所有 deprecated の fork は 409 にする', async () => {
    repository.findById.mockResolvedValue({
      ...template,
      status: 'deprecated',
      authorDiscordUserId: 'system'
    })

    await expect(service.fork('template-1', 'user-1')).rejects.toBeInstanceOf(ConflictException)
    expect(repository.create).not.toHaveBeenCalled()
  })

  it.each(['draft', 'published', 'deprecated'] as const)(
    '第三者所有の status=%s は fork を 403 にする',
    async (status) => {
      repository.findById.mockResolvedValue({ ...template, status, authorDiscordUserId: 'other-user' })

      await expect(service.fork('template-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException)
      expect(repository.create).not.toHaveBeenCalled()
    }
  )

  it('存在しない templateId の fork は 404 にする', async () => {
    repository.findById.mockResolvedValue(null)

    await expect(service.fork('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException)
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('fork の保存前検証に失敗した場合は repository.create を呼ばない', async () => {
    repository.findById.mockResolvedValue(template)
    validationPort.validateForSave.mockRejectedValue(new BadRequestException('invalid template'))

    await expect(service.fork('template-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException)
    expect(repository.create).not.toHaveBeenCalled()
  })

  it('fork は複製元に対する update 系 repository 操作を行わない', async () => {
    repository.findById.mockResolvedValue(template)
    repository.create.mockImplementation(async (entity) => entity)

    await service.fork('template-1', 'user-1')

    expect(repository.updateDraft).not.toHaveBeenCalled()
    expect(repository.patchMetadata).not.toHaveBeenCalled()
    expect(repository.publish).not.toHaveBeenCalled()
    expect(repository.deprecatePublished).not.toHaveBeenCalled()
    expect(repository.removeDraft).not.toHaveBeenCalled()
  })

  it('一覧は自分の全テンプレートと system published のサマリー取得に委譲する', async () => {
    const summaries = [
      summary('own-private', 'user-1', 'draft', 'private'),
      summary('system-published', 'system', 'published', 'private')
    ]
    repository.findListedSummariesForRequester.mockResolvedValue(summaries)

    const result = await service.findSummaries('user-1')

    expect(result).toBe(summaries)
    expect(repository.findListedSummariesForRequester).toHaveBeenCalledWith('user-1')
  })

  it('単体取得は所有者のみ許可する', async () => {
    repository.findById.mockResolvedValue(template)

    await expect(service.findOne('template-1', 'other-user')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('findOne は system published でも非所有者を 403 にする', async () => {
    repository.findById.mockResolvedValue({
      ...template,
      status: 'published',
      authorDiscordUserId: 'system'
    })

    await expect(service.findOne('template-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException)
  })

  it('存在しないテンプレートは 404', async () => {
    repository.findById.mockResolvedValue(null)

    await expect(service.findOne('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException)
  })

  it.each([
    ['resolveForCreate', 'published'],
    ['resolvePinnedRevision', 'published'],
    ['resolvePinnedRevision', 'deprecated']
  ] as const)('%s は status=%s / version 一致を受理する', async (method, status) => {
    const resolved = { ...template, status, version: '1.0.0' }
    repository.findById.mockResolvedValue(resolved)

    await expect(service[method]('template-1', '1.0.0', 'user-1')).resolves.toBe(resolved)
    expect(repository.findById).toHaveBeenCalledWith('template-1')
  })

  it.each([
    ['resolveForCreate', 'published'],
    ['resolvePinnedRevision', 'published'],
    ['resolvePinnedRevision', 'deprecated']
  ] as const)('%s は system 所有の status=%s / version 一致を非所有者にも許可する', async (method, status) => {
    const resolved = { ...template, status, version: '1.0.0', authorDiscordUserId: 'system' }
    repository.findById.mockResolvedValue(resolved)

    await expect(service[method]('template-1', '1.0.0', 'user-1')).resolves.toBe(resolved)
    expect(repository.findById).toHaveBeenCalledWith('template-1')
  })

  it.each(['resolveForCreate', 'resolvePinnedRevision'] as const)(
    '%s は存在しないテンプレートを 404 にする',
    async (method) => {
      repository.findById.mockResolvedValue(null)

      await expect(service[method]('missing', '1.0.0', 'user-1')).rejects.toBeInstanceOf(NotFoundException)
    }
  )

  it.each(['resolveForCreate', 'resolvePinnedRevision'] as const)(
    '%s は第三者所有テンプレートを従来どおり 403 にする',
    async (method) => {
      repository.findById.mockResolvedValue({ ...template, status: 'published', version: '1.0.0' })

      await expect(service[method]('template-1', '1.0.0', 'other-user')).rejects.toBeInstanceOf(ForbiddenException)
    }
  )

  it.each([
    ['resolveForCreate', 'draft', '1.0.0', 'sheet template for create must be published at the requested version'],
    ['resolveForCreate', 'deprecated', '1.0.0', 'sheet template for create must be published at the requested version'],
    ['resolveForCreate', 'published', '0.9.0', 'sheet template for create must be published at the requested version'],
    [
      'resolvePinnedRevision',
      'draft',
      '1.0.0',
      'pinned sheet template revision must be published or deprecated at the requested version'
    ],
    [
      'resolvePinnedRevision',
      'published',
      '0.9.0',
      'pinned sheet template revision must be published or deprecated at the requested version'
    ]
  ] as const)(
    '%s は status=%s / requested version=%s を固有メッセージの 409 にする',
    async (method, status, version, message) => {
      repository.findById.mockResolvedValue({ ...template, status, version: '1.0.0' })
      const resolution = service[method]('template-1', version, 'user-1')

      await expect(resolution).rejects.toMatchObject({ message })
      await expect(resolution).rejects.toBeInstanceOf(ConflictException)
    }
  )

  it.each([
    ['resolveForCreate', 'draft'],
    ['resolveForCreate', 'deprecated'],
    ['resolvePinnedRevision', 'draft']
  ] as const)('%s は system 所有でも status=%s を 409 にする', async (method, status) => {
    repository.findById.mockResolvedValue({
      ...template,
      status,
      version: '1.0.0',
      authorDiscordUserId: 'system'
    })

    await expect(service[method]('template-1', '1.0.0', 'user-1')).rejects.toBeInstanceOf(ConflictException)
  })

  it('draft autosave は draftRevision 不一致を 409 にする', async () => {
    repository.findById.mockResolvedValue(template)

    await expect(service.update('template-1', { draftRevision: 0, name: 'Updated' }, 'user-1')).rejects.toBeInstanceOf(
      ConflictException
    )
    expect(repository.updateDraft).not.toHaveBeenCalled()
  })

  it('system 所有 draft の更新は非所有者を 403 にする', async () => {
    repository.findById.mockResolvedValue({ ...template, authorDiscordUserId: 'system' })

    await expect(service.update('template-1', { draftRevision: 1, name: 'Updated' }, 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException
    )
    expect(repository.updateDraft).not.toHaveBeenCalled()
  })

  it.each(['published', 'deprecated'] as const)(
    'system 所有 %s の metadata patch は非所有者を 403 にする',
    async (status) => {
      repository.findById.mockResolvedValue({ ...template, status, authorDiscordUserId: 'system' })

      await expect(service.update('template-1', { name: 'Patched', tags: ['coc'] }, 'user-1')).rejects.toBeInstanceOf(
        ForbiddenException
      )
      expect(repository.patchMetadata).not.toHaveBeenCalled()
    }
  )

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

  it('system 所有 draft の publish は非所有者を 403 にする', async () => {
    repository.findById.mockResolvedValue({ ...template, authorDiscordUserId: 'system', visibility: 'public' })

    await expect(service.publish('template-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(validationPort.validateForPublish).not.toHaveBeenCalled()
    expect(repository.publish).not.toHaveBeenCalled()
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

  it('system 所有 draft の物理削除は非所有者を 403 にする', async () => {
    repository.findById.mockResolvedValue({ ...template, authorDiscordUserId: 'system' })

    await expect(service.remove('template-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(repository.removeDraft).not.toHaveBeenCalled()
  })

  it('system 所有 published の delete は非所有者を 403 にする', async () => {
    repository.findById.mockResolvedValue({
      ...template,
      status: 'published',
      authorDiscordUserId: 'system'
    })

    await expect(service.remove('template-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(repository.removeDraft).not.toHaveBeenCalled()
    expect(repository.deprecatePublished).not.toHaveBeenCalled()
  })

  it('system 所有 deprecated の remove は非所有者を 403 にする', async () => {
    repository.findById.mockResolvedValue({
      ...template,
      status: 'deprecated',
      authorDiscordUserId: 'system'
    })

    await expect(service.remove('template-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenException)
    expect(repository.removeDraft).not.toHaveBeenCalled()
    expect(repository.deprecatePublished).not.toHaveBeenCalled()
  })

  it('published delete は deprecated へ遷移する', async () => {
    const published = { ...template, status: 'published' as const, visibility: 'public' as const }
    const deprecated = { ...published, status: 'deprecated' as const }
    repository.findById.mockResolvedValue(published)
    repository.deprecatePublished.mockResolvedValue(deprecated)

    await expect(service.remove('template-1', 'user-1')).resolves.toBe(deprecated)
    expect(repository.deprecatePublished).toHaveBeenCalledWith('template-1', 'user-1')
  })

  it('Zod 構造検証に失敗した作成は全メッセージを順序どおり配列で 400 にする', async () => {
    let caught: unknown
    try {
      await service.create({ name: '', version: 'not-semver' }, 'user-1')
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(BadRequestException)
    expect((caught as BadRequestException).getResponse()).toStrictEqual({
      message: [
        'Invalid string: must match pattern /^\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$/',
        'Too small: expected string to have >=1 characters'
      ],
      error: 'Bad Request',
      statusCode: 400
    })
    expect(repository.create).not.toHaveBeenCalled()
  })
})
