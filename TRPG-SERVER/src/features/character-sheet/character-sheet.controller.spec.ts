import {
  ConflictException,
  ExecutionContext,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException
} from '@nestjs/common'
import { Test, TestingModule } from '@nestjs/testing'
import { JwtAuthGuard } from '../../domains/auth/guards/jwt-auth.guard'
import {
  CHARACTER_INSTANTIATION_USE_CASE,
  CHARACTER_SHEET_OPERATION_USE_CASE,
  CharacterSheetController
} from './character-sheet.controller'
import { CharacterService } from '../../domains/character/character.service'

describe('CharacterSheetController', () => {
  let controller: CharacterSheetController
  let characterService: { findOneForOwner: jest.Mock }
  let operationService: { saveSheet: jest.Mock }
  let instantiationService: { instantiate: jest.Mock }

  const user = { discordUserId: 'user-1', username: 'tester' }
  let guardUser: typeof user | null
  const jwtAuthGuardMock = {
    canActivate: jest.fn((context: ExecutionContext) => {
      const request = context.switchToHttp().getRequest()
      if (guardUser) request.user = guardUser
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
    characterService = { findOneForOwner: jest.fn() }
    operationService = { saveSheet: jest.fn() }
    instantiationService = { instantiate: jest.fn() }

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [CharacterSheetController],
      providers: [
        { provide: CharacterService, useValue: characterService },
        { provide: CHARACTER_SHEET_OPERATION_USE_CASE, useValue: operationService },
        { provide: CHARACTER_INSTANTIATION_USE_CASE, useValue: instantiationService }
      ]
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(jwtAuthGuardMock)
      .compile()

    controller = moduleRef.get(CharacterSheetController)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('PUT /character/:id/sheet は所有者確認後に saveSheet へ委譲する', async () => {
    characterService.findOneForOwner.mockResolvedValue({ characterId: 'character-1' })
    operationService.saveSheet.mockResolvedValue({ revision: 2, noOp: false, appliedChanges: 1 })
    const dto = {
      baseRevision: 1,
      changes: [{ path: { fieldUid: 'uid-name' }, baseValue: 'A', newValue: 'B' }]
    }

    await controller.saveSheet({ id: 'character-1' }, dto, requestFromGuard())

    expect(characterService.findOneForOwner).toHaveBeenCalledWith('character-1', 'user-1')
    expect(operationService.saveSheet).toHaveBeenCalledWith({ characterId: 'character-1', ...dto })
  })

  it('PUT /character/:id/sheet は非所有キャラクターを 404 にして use case を呼ばない', async () => {
    characterService.findOneForOwner.mockResolvedValue(null)

    await expect(
      controller.saveSheet({ id: 'character-1' }, { baseRevision: 1, changes: [] }, requestFromGuard())
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(operationService.saveSheet).not.toHaveBeenCalled()
  })

  it('PUT /character/:id/sheet は use case の conflict payload を保ったまま送出する', async () => {
    characterService.findOneForOwner.mockResolvedValue({ characterId: 'character-1' })
    const conflict = new ConflictException({
      message: 'sheet changes conflict with the current revision',
      characterId: 'character-1',
      conflicts: [{ path: { fieldUid: 'uid-name' }, current: 'C', base: 'A', yours: 'B' }]
    })
    operationService.saveSheet.mockRejectedValue(conflict)

    await expect(
      controller.saveSheet({ id: 'character-1' }, { baseRevision: 1, changes: [] }, requestFromGuard())
    ).rejects.toBe(conflict)
  })

  it('PUT /character/:id/sheet は use case の検査違反を 422 のまま送出する', async () => {
    characterService.findOneForOwner.mockResolvedValue({ characterId: 'character-1' })
    const validationError = new UnprocessableEntityException('field uid-computed is not an input field')
    operationService.saveSheet.mockRejectedValue(validationError)

    await expect(
      controller.saveSheet({ id: 'character-1' }, { baseRevision: 1, changes: [] }, requestFromGuard())
    ).rejects.toBe(validationError)
  })

  it('POST /character/from-template は JWT 所有者を instantiation use case へ渡して characterId と作成時ロール結果を返す', async () => {
    const rollOnCreateResults = [
      {
        uid: 'uid-dex',
        label: 'DEX',
        notation: '3d6*5',
        total: 55,
        details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55'
      }
    ]
    instantiationService.instantiate.mockResolvedValue({
      character: { characterId: 'character-2' },
      rollOnCreateResults
    })

    await expect(
      controller.createFromTemplate(
        { templateId: 'template-1', templateVersion: '1.0.0', characterName: '探索者' },
        requestFromGuard()
      )
    ).resolves.toEqual({ characterId: 'character-2', rollOnCreateResults })
    expect(instantiationService.instantiate).toHaveBeenCalledWith({
      templateId: 'template-1',
      templateVersion: '1.0.0',
      requesterDiscordUserId: 'user-1',
      characterName: '探索者',
      discordUserId: 'user-1',
      discordChannelId: '',
      values: undefined
    })
  })

  it('JWT user が無ければ 401 で feature use case を呼ばない', async () => {
    guardUser = null

    await expect(
      controller.createFromTemplate(
        { templateId: 'template-1', templateVersion: '1.0.0', characterName: '探索者' },
        requestFromGuard()
      )
    ).rejects.toBeInstanceOf(UnauthorizedException)
    expect(instantiationService.instantiate).not.toHaveBeenCalled()
  })
})
