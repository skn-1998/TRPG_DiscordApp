import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { CharacterSheetTemplateController } from './character-sheet-template.controller'
import { CharacterSheetTemplateService } from './character-sheet-template.service'
import { CharacterSheetTemplateEntity } from './models/character-sheet-template.entity'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

describe('CharacterSheetTemplateController', () => {
  let controller: CharacterSheetTemplateController
  let service: jest.Mocked<CharacterSheetTemplateService>

  const user = { discordUserId: 'user-1', username: 'tester' }
  let guardUser: typeof user | null
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

  const jwtAuthGuardMock = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest()
      if (guardUser) {
        request.user = guardUser
      }
      return true
    })
  }

  const requestFromGuard = () => {
    const request = {} as any
    jwtAuthGuardMock.canActivate({
      switchToHttp: () => ({ getRequest: () => request })
    } as unknown as ExecutionContext)
    return request
  }

  beforeEach(async () => {
    guardUser = user
    jwtAuthGuardMock.canActivate.mockClear()

    const serviceMock = {
      create: jest.fn(),
      findSummaries: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      publish: jest.fn(),
      remove: jest.fn()
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetTemplateController],
      providers: [{ provide: CharacterSheetTemplateService, useValue: serviceMock }]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtAuthGuardMock)
      .compile()

    controller = moduleRef.get(CharacterSheetTemplateController)
    service = moduleRef.get(CharacterSheetTemplateService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('POST /sheet-templates は JWT の discordUserId を author として service に渡す', async () => {
    service.create.mockResolvedValue(template)

    const dto = { name: 'Template', authorDiscordUserId: 'client-user' } as any
    const result = await controller.create(dto, requestFromGuard())

    expect(service.create).toHaveBeenCalledWith(dto, 'user-1')
    expect(result).toBe(template)
  })

  it('GET /sheet-templates は自分の summary 一覧だけを取得する', async () => {
    const summaries = [{ templateId: 'template-1', name: 'Template' }] as any
    service.findSummaries.mockResolvedValue(summaries)

    await expect(controller.findSummaries(requestFromGuard())).resolves.toBe(summaries)
    expect(service.findSummaries).toHaveBeenCalledWith('user-1')
  })

  it('GET /sheet-templates/:id は所有者チェックを service に委譲する', async () => {
    service.findOne.mockResolvedValue(template)

    await expect(controller.findOne({ id: 'template-1' }, requestFromGuard())).resolves.toBe(template)
    expect(service.findOne).toHaveBeenCalledWith('template-1', 'user-1')
  })

  it('PUT /sheet-templates/:id は draftRevision 付き body を service に渡す', async () => {
    const dto = { draftRevision: 1, name: 'Updated' }
    service.update.mockResolvedValue({ ...template, name: 'Updated' })

    await controller.update({ id: 'template-1' }, dto, requestFromGuard())

    expect(service.update).toHaveBeenCalledWith('template-1', dto, 'user-1')
  })

  it('POST /sheet-templates/:id/publish は publish に委譲する', async () => {
    const published = { ...template, status: 'published' as const, visibility: 'public' as const }
    service.publish.mockResolvedValue(published)

    await expect(controller.publish({ id: 'template-1' }, requestFromGuard())).resolves.toBe(published)
    expect(service.publish).toHaveBeenCalledWith('template-1', 'user-1')
  })

  it('DELETE /sheet-templates/:id は remove に委譲する', async () => {
    const removed = { templateId: 'template-1', status: 'draft' as const, deleted: true as const }
    service.remove.mockResolvedValue(removed)

    await expect(controller.remove({ id: 'template-1' }, requestFromGuard())).resolves.toBe(removed)
    expect(service.remove).toHaveBeenCalledWith('template-1', 'user-1')
  })

  it('user が無い場合は 401', async () => {
    guardUser = null
    await expect(controller.findSummaries(requestFromGuard())).rejects.toBeInstanceOf(UnauthorizedException)
    expect(service.findSummaries).not.toHaveBeenCalled()
  })
})
