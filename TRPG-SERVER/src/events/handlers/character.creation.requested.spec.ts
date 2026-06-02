import { Test } from '@nestjs/testing'
import { CharacterCreationRequestedHandler } from './character.creation.requested'
import { CharacterService } from '../../domains/character/character.service'
import { CharacterIdService } from '../../domains/character/services/character-id.service'
import { ValidationError, BusinessLogicError } from './_shared/event-handler.base'
import { CharacterCreationRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * CharacterCreationRequestedHandler の現状挙動を固定するユニットテスト
 *
 * 依存（CharacterService / CharacterIdService）は { provide, useValue } でモックし、
 * typedEventService は setTypedEventService 経由でモックを注入する。
 * 「どの依存が・どの引数で呼ばれ・どのイベントを emit するか」を検証する。
 *
 * 注意:
 * - customValidation（バリデーション分岐）は protected だが handle() の入口とは独立して
 *   走るため、execute() 経由で全体パイプラインの分岐も併せて固定する。
 * - 内部 private（validateCocParameters 等）は直接覗かず、customValidation の結果として検証する。
 */
describe('CharacterCreationRequestedHandler', () => {
  let handler: CharacterCreationRequestedHandler
  let characterService: {
    findByChannelId: jest.Mock
    create: jest.Mock
  }
  let characterIdService: {
    generateUniqueCharacterId: jest.Mock
  }
  let typedEventService: { emit: jest.Mock }

  const baseCreateData = () => ({
    characterName: 'テストキャラ',
    gameSystemId: 'generic'
  })

  const buildEvent = (overrides: Partial<CharacterCreationRequestedEvent> = {}): CharacterCreationRequestedEvent =>
    ({
      type: 'character.creation.requested',
      timestamp: new Date('2026-06-02T00:00:00Z'),
      source: 'system',
      createData: baseCreateData(),
      ...overrides
    }) as CharacterCreationRequestedEvent

  beforeEach(async () => {
    jest.clearAllMocks()

    characterService = {
      findByChannelId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ characterId: 'char_created01' })
    }
    characterIdService = {
      generateUniqueCharacterId: jest.fn().mockResolvedValue('char_generated1')
    }
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      providers: [
        CharacterCreationRequestedHandler,
        { provide: CharacterService, useValue: characterService },
        { provide: CharacterIdService, useValue: characterIdService }
      ]
    }).compile()

    handler = moduleRef.get(CharacterCreationRequestedHandler)
    handler.setTypedEventService(typedEventService as any)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getEventName', () => {
    it('character.creation.requested を返す', () => {
      expect(handler.getEventName()).toBe('character.creation.requested')
    })
  })

  describe('handle / 正常系', () => {
    it('characterId が未設定なら CharacterIdService で生成し create に渡す', async () => {
      // Arrange
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert: ID 生成 → create に生成IDが渡る
      expect(characterIdService.generateUniqueCharacterId).toHaveBeenCalledWith('char_')
      expect(characterService.create).toHaveBeenCalledTimes(1)
      expect(characterService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          characterName: 'テストキャラ',
          characterId: 'char_generated1'
        })
      )
    })

    it('characterId が指定済みなら ID 生成せず指定値で create する', async () => {
      // Arrange
      const event = buildEvent({ characterId: 'char_preset0001' })

      // Act
      await handler.handle(event)

      // Assert
      expect(characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
      expect(characterService.create).toHaveBeenCalledWith(expect.objectContaining({ characterId: 'char_preset0001' }))
    })

    it('成功時に character.creation.completed を emit する', async () => {
      // Arrange
      const created = { characterId: 'char_done00001' }
      characterService.create.mockResolvedValue(created)
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert: 成功イベントのみ emit される
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.creation.completed',
        expect.objectContaining({
          character: created,
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })

    it('description が指定されていれば create にそのまま渡す', async () => {
      // Arrange
      const description = { note: 'メモ' }
      const event = buildEvent({ createData: { ...baseCreateData(), description } })

      // Act
      await handler.handle(event)

      // Assert
      expect(characterService.create).toHaveBeenCalledWith(expect.objectContaining({ description }))
    })
  })

  describe('handle / featureId ルーティング', () => {
    it('requester 未指定なら characterEdit 経路（create が呼ばれる）', async () => {
      await handler.handle(buildEvent())
      expect(characterService.create).toHaveBeenCalledTimes(1)
    })

    it.each(['characterThread', 'gameSystem', 'diceRoll', 'unknownFeature'])(
      'featureId=%s でも最終的に characterEdit 経路へフォールバックして create する',
      async (featureId) => {
        // Arrange
        const event = buildEvent({
          requester: { featureId: featureId as any, context: {} }
        })

        // Act
        await handler.handle(event)

        // Assert: いずれの feature も create に到達し成功イベントを emit
        expect(characterService.create).toHaveBeenCalledTimes(1)
        expect(typedEventService.emit).toHaveBeenCalledWith('character.creation.completed', expect.anything())
      }
    )
  })

  describe('handle / 異常系（失敗イベント）', () => {
    it('create が失敗したら character.creation.failed を emit し、エラーを再スローする', async () => {
      // Arrange
      const error = new Error('create failed')
      characterService.create.mockRejectedValue(error)
      const event = buildEvent({ createData: { ...baseCreateData(), gameSystemId: 'coc' } })

      // Act & Assert: 再スローされる
      await expect(handler.handle(event)).rejects.toThrow('create failed')

      // Assert: 失敗イベントが emit される（成功イベントは emit されない）
      expect(typedEventService.emit).toHaveBeenCalledTimes(1)
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.creation.failed',
        expect.objectContaining({
          createData: expect.objectContaining({
            characterName: 'テストキャラ',
            gameSystemId: 'coc'
          }),
          error: 'create failed',
          source: 'system',
          timestamp: expect.any(Date)
        })
      )
    })

    it('失敗イベントの createData.characterId は元イベントの characterId を優先する', async () => {
      // Arrange
      characterService.create.mockRejectedValue(new Error('boom'))
      const event = buildEvent({ characterId: 'char_orig00001' })

      // Act
      await expect(handler.handle(event)).rejects.toThrow('boom')

      // Assert: 既存 characterId が使われ、失敗イベント用の追加 ID 生成は行われない
      // （characterEdit 経路では characterId 指定済みのため generateUnique は未呼び出し）
      expect(characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.creation.failed',
        expect.objectContaining({
          createData: expect.objectContaining({ characterId: 'char_orig00001' })
        })
      )
    })

    it('characterId 未指定で create 失敗時は失敗イベント用に ID を生成して埋める', async () => {
      // Arrange: characterEdit 経路の ID 生成と失敗イベントの ID 生成の2回呼ばれる
      characterService.create.mockRejectedValue(new Error('boom'))
      const event = buildEvent()

      // Act
      await expect(handler.handle(event)).rejects.toThrow('boom')

      // Assert
      expect(characterIdService.generateUniqueCharacterId).toHaveBeenCalled()
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.creation.failed',
        expect.objectContaining({
          createData: expect.objectContaining({ characterId: 'char_generated1' })
        })
      )
    })
  })

  describe('customValidation（execute 経由） / 正常系', () => {
    it('正常な event は customValidation を通過し create まで到達する', async () => {
      // Arrange
      const event = buildEvent()

      // Act: execute は内部で例外を握りつぶす設計のため、副作用で通過を確認する
      await handler.execute(event)

      // Assert
      expect(characterService.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('customValidation（直接呼び出し） / バリデーション分岐', () => {
    // customValidation は protected だが分岐網羅のため型回避で直接呼ぶ
    const callValidation = (event: CharacterCreationRequestedEvent) => (handler as any).customValidation(event)

    // NOTE: customValidation は validation.utils 側の ValidationError を throw する
    //（event-handler.base の ValidationError とは別クラス）。
    //       実装挙動を固定するため name で照合する。
    it('characterName が無いと ValidationError', async () => {
      const event = buildEvent({ createData: { gameSystemId: 'generic' } as any })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('characterName')
      })
    })

    it('characterName が 100 文字超なら ValidationError', async () => {
      const event = buildEvent({
        createData: { characterName: 'あ'.repeat(101), gameSystemId: 'generic' }
      })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('must not exceed 100 characters')
      })
    })

    it('discordChannelId が不正な形式なら ValidationError', async () => {
      const event = buildEvent({
        createData: { ...baseCreateData(), discordChannelId: 'not-a-discord-id' }
      })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('discordChannelId')
      })
    })

    it('discordUserId が不正な形式なら ValidationError', async () => {
      const event = buildEvent({
        createData: { ...baseCreateData(), discordUserId: 'xxx' }
      })
      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'ValidationError',
        message: expect.stringContaining('discordUserId')
      })
    })

    it('discordChannelId が正しい形式なら findByChannelId で重複チェックする', async () => {
      const event = buildEvent({
        createData: { ...baseCreateData(), discordChannelId: '123456789012345678' }
      })

      await callValidation(event)

      expect(characterService.findByChannelId).toHaveBeenCalledWith('123456789012345678')
    })

    it('同一チャンネルに既存キャラがあれば BusinessLogicError(CHARACTER_ALREADY_EXISTS)', async () => {
      characterService.findByChannelId.mockResolvedValue({ characterId: 'char_exists0001' })
      const event = buildEvent({
        createData: { ...baseCreateData(), discordChannelId: '123456789012345678' }
      })

      await expect(callValidation(event)).rejects.toMatchObject({
        name: 'BusinessLogicError',
        code: 'CHARACTER_ALREADY_EXISTS'
      })
    })
  })

  describe('customValidation / ゲームシステム別パラメータ検証', () => {
    const callValidation = (event: CharacterCreationRequestedEvent) => (handler as any).customValidation(event)

    it('coc: 必須能力値が欠けていると ValidationError', async () => {
      const event = buildEvent({
        createData: { ...baseCreateData(), gameSystemId: 'coc', parameter: { STR: 50 } }
      })
      await expect(callValidation(event)).rejects.toThrow(/missing required stats/)
    })

    it('coc: 能力値が範囲外（1-99）だと ValidationError', async () => {
      const event = buildEvent({
        createData: {
          ...baseCreateData(),
          gameSystemId: 'coc',
          parameter: { STR: 100, CON: 50, POW: 50, DEX: 50, APP: 50, SIZ: 50, INT: 50, EDU: 50 }
        }
      })
      await expect(callValidation(event)).rejects.toThrow(/must be between 1-99/)
    })

    it('coc: 全能力値が範囲内なら通過する', async () => {
      const event = buildEvent({
        createData: {
          ...baseCreateData(),
          gameSystemId: 'coc',
          parameter: { STR: 50, CON: 50, POW: 50, DEX: 50, APP: 50, SIZ: 50, INT: 50, EDU: 50 }
        }
      })
      await expect(callValidation(event)).resolves.toBeUndefined()
    })

    it('dnd5e: 能力値が範囲外（3-20）だと ValidationError', async () => {
      const event = buildEvent({
        createData: {
          ...baseCreateData(),
          gameSystemId: 'dnd5e',
          parameter: { STR: 21, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 }
        }
      })
      await expect(callValidation(event)).rejects.toThrow(/must be between 3-20/)
    })

    it('sw2.5: 必須能力値が欠けていると ValidationError', async () => {
      const event = buildEvent({
        createData: { ...baseCreateData(), gameSystemId: 'sw2.5', parameter: { 器用度: 10 } }
      })
      await expect(callValidation(event)).rejects.toThrow(/missing required stats/)
    })

    it('未対応の gameSystemId かつ parameter ありで ValidationError(Unsupported game system)', async () => {
      const event = buildEvent({
        createData: { ...baseCreateData(), gameSystemId: 'unknownSystem', parameter: { foo: 1 } }
      })
      await expect(callValidation(event)).rejects.toThrow(/Unsupported game system/)
    })

    it('parameter が無ければ gameSystemId 不問でパラメータ検証をスキップする', async () => {
      const event = buildEvent({
        createData: { ...baseCreateData(), gameSystemId: 'coc' } // parameter 無し
      })
      await expect(callValidation(event)).resolves.toBeUndefined()
    })

    it('parameter はあるが gameSystemId が無ければパラメータ検証をスキップする', async () => {
      const event = buildEvent({
        createData: { characterName: 'テストキャラ', parameter: { STR: 999 } } as any
      })
      await expect(callValidation(event)).resolves.toBeUndefined()
    })
  })

  describe('isRetryableError / getMaxRetries（オーバーライド）', () => {
    it('BusinessLogicError はリトライ不可', () => {
      const result = (handler as any).isRetryableError(new BusinessLogicError('x'))
      expect(result).toBe(false)
    })

    it('ValidationError はリトライ不可', () => {
      const result = (handler as any).isRetryableError(new ValidationError('x'))
      expect(result).toBe(false)
    })

    it('TimeoutError は親クラス判定でリトライ可', () => {
      const err = new Error('TimeoutError occurred')
      err.name = 'TimeoutError'
      const result = (handler as any).isRetryableError(err)
      expect(result).toBe(true)
    })

    it('最大リトライ回数は 2', () => {
      expect((handler as any).getMaxRetries()).toBe(2)
    })
  })
})
