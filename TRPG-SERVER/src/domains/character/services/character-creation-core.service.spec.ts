import { Test } from '@nestjs/testing'
import {
  CharacterCreationCoreService,
  CharacterCreationBusinessError,
  CharacterCreationValidationError,
  CharacterCreationCoreInput
} from './character-creation-core.service'
import { CharacterService } from '../character.service'
import { CharacterIdService } from './character-id.service'

/**
 * CharacterCreationCoreService のユニットテスト
 *
 * CharacterCreationRequestedHandler（events 層）から移設したビジネス中核
 * （重複チェック → パラメータ構造検証 → ID 採番 → 作成委譲）の挙動を固定する。
 * テストケースは移設元 character.creation.requested.spec.ts の意味論を踏襲する。
 */
describe('CharacterCreationCoreService', () => {
  let service: CharacterCreationCoreService
  let characterService: {
    findByChannelId: jest.Mock
    create: jest.Mock
  }
  let characterIdService: {
    generateUniqueCharacterId: jest.Mock
  }

  const baseCreateData = (): CharacterCreationCoreInput => ({
    characterName: 'テストキャラ',
    gameSystemId: 'generic'
  })

  beforeEach(async () => {
    jest.clearAllMocks()

    characterService = {
      findByChannelId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ characterId: 'char_created01' })
    }
    characterIdService = {
      generateUniqueCharacterId: jest.fn().mockResolvedValue('char_generated1')
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterCreationCoreService,
        { provide: CharacterService, useValue: characterService },
        { provide: CharacterIdService, useValue: characterIdService }
      ]
    }).compile()

    service = moduleRef.get(CharacterCreationCoreService)
  })

  describe('createValidated / 重複チェック', () => {
    it('discordChannelId があれば findByChannelId で重複チェックする', async () => {
      await service.createValidated({ ...baseCreateData(), discordChannelId: '123456789012345678' })

      expect(characterService.findByChannelId).toHaveBeenCalledWith('123456789012345678')
      expect(characterService.create).toHaveBeenCalledTimes(1)
    })

    it('同一チャンネルに既存キャラがあれば BusinessLogicError(CHARACTER_ALREADY_EXISTS) を throw し create しない', async () => {
      characterService.findByChannelId.mockResolvedValue({ characterId: 'char_exists0001' })

      await expect(
        service.createValidated({ ...baseCreateData(), discordChannelId: '123456789012345678' })
      ).rejects.toMatchObject({
        name: 'BusinessLogicError',
        code: 'CHARACTER_ALREADY_EXISTS',
        message: expect.stringContaining('123456789012345678')
      })

      expect(characterService.create).not.toHaveBeenCalled()
    })

    it('重複エラーはドメイン定義の CharacterCreationBusinessError インスタンスである', async () => {
      characterService.findByChannelId.mockResolvedValue({ characterId: 'char_exists0001' })

      await expect(
        service.createValidated({ ...baseCreateData(), discordChannelId: '123456789012345678' })
      ).rejects.toBeInstanceOf(CharacterCreationBusinessError)
    })

    it('discordChannelId が無ければ重複チェックをスキップする', async () => {
      await service.createValidated(baseCreateData())

      expect(characterService.findByChannelId).not.toHaveBeenCalled()
      expect(characterService.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('createValidated / ゲームシステム別パラメータ検証', () => {
    it('coc: 必須能力値が欠けていると ValidationError', async () => {
      await expect(
        service.createValidated({ ...baseCreateData(), gameSystemId: 'coc', parameter: { STR: 50 } })
      ).rejects.toThrow(/missing required stats/)
      expect(characterService.create).not.toHaveBeenCalled()
    })

    it('coc: 能力値が範囲外（1-99）だと ValidationError', async () => {
      await expect(
        service.createValidated({
          ...baseCreateData(),
          gameSystemId: 'coc',
          parameter: { STR: 100, CON: 50, POW: 50, DEX: 50, APP: 50, SIZ: 50, INT: 50, EDU: 50 }
        })
      ).rejects.toThrow(/must be between 1-99/)
    })

    it('coc: 全能力値が範囲内なら通過して create する', async () => {
      await service.createValidated({
        ...baseCreateData(),
        gameSystemId: 'coc',
        parameter: { STR: 50, CON: 50, POW: 50, DEX: 50, APP: 50, SIZ: 50, INT: 50, EDU: 50 }
      })
      expect(characterService.create).toHaveBeenCalledTimes(1)
    })

    it('dnd5e: 能力値が範囲外（3-20）だと ValidationError', async () => {
      await expect(
        service.createValidated({
          ...baseCreateData(),
          gameSystemId: 'dnd5e',
          parameter: { STR: 21, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
        })
      ).rejects.toThrow(/must be between 3-20/)
    })

    it('sw2.5: 必須能力値が欠けていると ValidationError', async () => {
      await expect(
        service.createValidated({ ...baseCreateData(), gameSystemId: 'sw2.5', parameter: { 器用度: 10 } })
      ).rejects.toThrow(/missing required stats/)
    })

    it('未対応の gameSystemId かつ parameter ありで ValidationError(Unsupported game system)', async () => {
      await expect(
        service.createValidated({ ...baseCreateData(), gameSystemId: 'unknownSystem', parameter: { foo: 1 } })
      ).rejects.toThrow(/Unsupported game system/)
    })

    it('検証エラーは name=ValidationError のドメイン定義エラーである', async () => {
      const promise = service.createValidated({
        ...baseCreateData(),
        gameSystemId: 'coc',
        parameter: { STR: 50 }
      })
      await expect(promise).rejects.toBeInstanceOf(CharacterCreationValidationError)
      await expect(promise).rejects.toMatchObject({ name: 'ValidationError' })
    })

    it('parameter が無ければ gameSystemId 不問でパラメータ検証をスキップする', async () => {
      await service.createValidated({ ...baseCreateData(), gameSystemId: 'coc' }) // parameter 無し
      expect(characterService.create).toHaveBeenCalledTimes(1)
    })

    it('parameter はあるが gameSystemId が無ければパラメータ検証をスキップする', async () => {
      await service.createValidated({ characterName: 'テストキャラ', parameter: { STR: 999 } })
      expect(characterService.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('createValidated / characterId 採番', () => {
    it('characterId 未指定なら char_ プレフィックスで採番し create に渡す', async () => {
      await service.createValidated(baseCreateData())

      expect(characterIdService.generateUniqueCharacterId).toHaveBeenCalledWith('char_')
      expect(characterService.create).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'char_generated1' }))
    })

    it('characterId 指定済みなら採番せず指定値で create する', async () => {
      await service.createValidated(baseCreateData(), 'char_preset0001')

      expect(characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
      expect(characterService.create).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'char_preset0001' }))
    })

    it('createData に紛れ込んだ characterId は無視され引数・採番 ID が優先される（型上は受け取らない・実行時ガード）', async () => {
      // CharacterCreationCoreInput は characterId を持たない（誤用防止）。実行時に余剰プロパティで
      // 渡って来ても spread 後の明示 characterId 指定が勝つことを固定する。
      await service.createValidated({ ...baseCreateData(), characterId: 'short-id-01' } as CharacterCreationCoreInput)

      expect(characterService.create).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'char_generated1' }))
    })
  })

  describe('createValidated / create 委譲', () => {
    it('createData を展開して create に委譲し、作成結果をそのまま返す', async () => {
      const created = { characterId: 'char_done00001' }
      characterService.create.mockResolvedValue(created)

      const result = await service.createValidated({
        ...baseCreateData(),
        discordUserId: '234567890123456789'
      })

      expect(characterService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          characterName: 'テストキャラ',
          gameSystemId: 'generic',
          discordUserId: '234567890123456789'
        })
      )
      expect(result).toBe(created)
    })

    it('description が指定されていれば create にそのまま渡す', async () => {
      const description = { note: 'メモ' }
      await service.createValidated({ ...baseCreateData(), description })

      expect(characterService.create).toHaveBeenCalledWith(expect.objectContaining({ description }))
    })

    it('description が無ければ undefined で create に渡す', async () => {
      await service.createValidated(baseCreateData())

      expect(characterService.create).toHaveBeenCalledWith(expect.objectContaining({ description: undefined }))
    })

    it('create の失敗はそのまま伝播する', async () => {
      characterService.create.mockRejectedValue(new Error('create failed'))

      await expect(service.createValidated(baseCreateData())).rejects.toThrow('create failed')
    })
  })
})
