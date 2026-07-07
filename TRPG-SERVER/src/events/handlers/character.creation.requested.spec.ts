import { Test } from '@nestjs/testing'
import { CharacterCreationRequestedHandler } from './character.creation.requested'
import { CharacterCreationCoreService } from '../../domains/character/services/character-creation-core.service'
import { ValidationError, BusinessLogicError } from './_shared/event-handler.base'
import { CharacterCreationRequestedEvent } from '../contracts/unified-event-contracts'

/**
 * CharacterCreationRequestedHandler の現状挙動を固定するユニットテスト
 *
 * ビジネス中核（重複チェック・パラメータ検証・ID採番・作成）は
 * CharacterCreationCoreService（domain）へ移設済みのため、本 spec では
 * 「入力形検証 → featureId ルーティング → creationCore への委譲 →
 * completed イベント発行」の契約を検証する。
 * 移設したビジネス検証は character-creation-core.service.spec.ts が固定する。
 *
 * 注: character.creation.failed の emit は購読者ゼロの dead チェーンとして E-3a で
 *     撤去したため、失敗系は「failed を emit しない＋エラー再スロー」を固定する。
 *
 * 注意:
 * - customValidation（入力形検証の分岐）は protected だが handle() の入口とは独立して
 *   走るため、execute() 経由で全体パイプラインの分岐も併せて固定する。
 */
describe('CharacterCreationRequestedHandler', () => {
  let handler: CharacterCreationRequestedHandler
  let creationCore: {
    createValidated: jest.Mock
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

    creationCore = {
      createValidated: jest.fn().mockResolvedValue({ characterId: 'char_created01' })
    }
    typedEventService = { emit: jest.fn().mockResolvedValue(undefined) }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterCreationRequestedHandler, { provide: CharacterCreationCoreService, useValue: creationCore }]
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
    it('characterId が未設定なら createData と undefined を creationCore に委譲する（ID採番は domain 側）', async () => {
      // Arrange
      const event = buildEvent()

      // Act
      await handler.handle(event)

      // Assert: ビジネス中核は creationCore へ委譲される
      expect(creationCore.createValidated).toHaveBeenCalledTimes(1)
      expect(creationCore.createValidated).toHaveBeenCalledWith(
        expect.objectContaining({ characterName: 'テストキャラ' }),
        undefined
      )
    })

    it('characterId が指定済みなら指定値をそのまま creationCore に渡す', async () => {
      // Arrange
      const event = buildEvent({ characterId: 'char_preset0001' })

      // Act
      await handler.handle(event)

      // Assert
      expect(creationCore.createValidated).toHaveBeenCalledWith(expect.anything(), 'char_preset0001')
    })

    it('成功時に character.creation.completed を emit する', async () => {
      // Arrange
      const created = { characterId: 'char_done00001' }
      creationCore.createValidated.mockResolvedValue(created)
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

    it('description が指定されていれば createData ごと creationCore に渡す', async () => {
      // Arrange
      const description = { note: 'メモ' }
      const event = buildEvent({ createData: { ...baseCreateData(), description } })

      // Act
      await handler.handle(event)

      // Assert
      expect(creationCore.createValidated).toHaveBeenCalledWith(expect.objectContaining({ description }), undefined)
    })
  })

  describe('handle / featureId ルーティング', () => {
    it('requester 未指定なら characterEdit 経路（creationCore が呼ばれる）', async () => {
      await handler.handle(buildEvent())
      expect(creationCore.createValidated).toHaveBeenCalledTimes(1)
    })

    it.each(['characterThread', 'gameSystem', 'diceRoll', 'unknownFeature'])(
      'featureId=%s でも最終的に characterEdit 経路へフォールバックして creationCore に委譲する',
      async (featureId) => {
        // Arrange
        const event = buildEvent({
          requester: { featureId: featureId as any, context: {} }
        })

        // Act
        await handler.handle(event)

        // Assert: いずれの feature も creationCore に到達し成功イベントを emit
        expect(creationCore.createValidated).toHaveBeenCalledTimes(1)
        expect(typedEventService.emit).toHaveBeenCalledWith('character.creation.completed', expect.anything())
      }
    )
  })

  describe('handle / 異常系（failed emit は E-3a で撤去済み）', () => {
    it('作成が失敗したらエラーを再スローし、イベントは一切 emit しない', async () => {
      // Arrange
      const error = new Error('create failed')
      creationCore.createValidated.mockRejectedValue(error)
      const event = buildEvent({ createData: { ...baseCreateData(), gameSystemId: 'coc' } })

      // Act & Assert: 再スローされる（EventHandler 基底のリトライ/統計はこの throw に依存）
      await expect(handler.handle(event)).rejects.toThrow('create failed')

      // Assert: dead な character.creation.failed は emit されない（成功イベントも emit されない）
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('characterId 指定済みイベントの作成失敗でも emit ゼロのまま再スローする', async () => {
      // Arrange
      creationCore.createValidated.mockRejectedValue(new Error('boom'))
      const event = buildEvent({ characterId: 'char_orig00001' })

      // Act & Assert
      await expect(handler.handle(event)).rejects.toThrow('boom')
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })
  })

  describe('customValidation（execute 経由） / 正常系', () => {
    it('正常な event は customValidation を通過し creationCore まで到達する', async () => {
      // Arrange
      const event = buildEvent()

      // Act: execute は内部で例外を握りつぶす設計のため、副作用で通過を確認する
      await handler.execute(event)

      // Assert
      expect(creationCore.createValidated).toHaveBeenCalledTimes(1)
    })
  })

  describe('customValidation（直接呼び出し） / 入力形バリデーション分岐', () => {
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

    it('正しい形式の discordChannelId は入力形検証を通過する（重複チェックは creationCore へ移設済み）', async () => {
      const event = buildEvent({
        createData: { ...baseCreateData(), discordChannelId: '123456789012345678' }
      })

      await expect(callValidation(event)).resolves.toBeUndefined()

      // 回帰ガード: バリデーション段階ではビジネス中核（creationCore）に触れない
      expect(creationCore.createValidated).not.toHaveBeenCalled()
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
