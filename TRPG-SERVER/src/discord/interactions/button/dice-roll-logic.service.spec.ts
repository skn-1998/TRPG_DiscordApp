import { Test } from '@nestjs/testing'
import type { ButtonInteraction } from 'discord.js'
import { DiceRollLogicService } from './dice-roll-logic.service'
import { DiceRollService } from '../../../domains/dice-roll/dice-roll.service'
import { CharacterService } from '../../../domains/character/character.service'
import { TypedEventService } from '../../../core/events/typed-event.service'
import { createMockButtonInteraction } from '@discord-test-utils'
import { DEFAULT_MOCK_USER } from '@discord-test-utils/interactions/base.types'
import dice from '../../utils/dice'

// dice モジュール(BCDice ローダ)は副作用の境界として丸ごとモックし、
// 出目を固定して handleDiceRoll/handleSkillRoll/handleCustomDiceRoll の分岐を決定的に検証する。
jest.mock('../../utils/dice')

const mockedDice = dice as jest.MockedFunction<typeof dice>

/**
 * DiceRollLogicService はダイス核ロジック。
 * - cleanDiceExpression / determineSuccessLevel は内部 private だが、validateDiceExpression と
 *   handleSkillRoll の公開 API 経由で挙動を網羅する。
 * - 副作用の境界(DiceRollService.createText / CharacterService.findByChannelId /
 *   TypedEventService.emit / dice())はモックする。
 * - interaction は @discord-test-utils ファクトリを使い、user.id 参照のみ利用する。
 */
describe('DiceRollLogicService', () => {
  let service: DiceRollLogicService
  let diceRollService: jest.Mocked<Pick<DiceRollService, 'createText'>>
  let characterService: jest.Mocked<Pick<CharacterService, 'findByChannelId'>>
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'emit'>>

  // BCDice 風の結果を作るヘルパ(rands から total を計算する経路)。
  // 実 Result 型は本サービスが参照する text/rands 以外のフィールドも要求するため、
  // テストでは使用フィールドのみ与えて dice の戻り型へキャストする。
  type DiceReturn = Awaited<ReturnType<typeof dice>>
  const diceResult = (text: string, rands: number[][] = []): DiceReturn => ({ text, rands }) as unknown as DiceReturn

  const buildCharacter = (overrides: Record<string, unknown> = {}) =>
    ({
      characterName: 'テスト探索者',
      gameSystemId: 'coc7',
      ...overrides
    }) as any

  beforeEach(async () => {
    diceRollService = { createText: jest.fn() }
    characterService = { findByChannelId: jest.fn() }
    typedEventService = { emit: jest.fn() }

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiceRollLogicService,
        { provide: DiceRollService, useValue: diceRollService },
        { provide: CharacterService, useValue: characterService },
        { provide: TypedEventService, useValue: typedEventService }
      ]
    }).compile()

    service = moduleRef.get(DiceRollLogicService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validateDiceExpression', () => {
    it('基本的なダイス式(1d100)は有効', () => {
      expect(service.validateDiceExpression('1d100')).toEqual({ isValid: true })
    })

    it('修飾子付きダイス式(2d6+3)は有効', () => {
      expect(service.validateDiceExpression('2d6+3')).toEqual({ isValid: true })
    })

    it('面数 d0 は無効', () => {
      const result = service.validateDiceExpression('1d0')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('ダイスの面数が無効です')
    })

    it('面数 d1000000 は無効', () => {
      const result = service.validateDiceExpression('1d1000000')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('ダイスの面数が無効です')
    })

    it('クリーンアップ後に空文字となる入力は解析失敗エラーになる', () => {
      // 危険文字が除去され空文字になると cleanDiceExpression が throw し、catch で解析失敗を返す
      const result = service.validateDiceExpression('@@@')
      expect(result.isValid).toBe(false)
      expect(result.error).toBe('ダイス式の解析に失敗しました')
    })

    it('大文字や空白を含んでも正規化して有効と判定する', () => {
      expect(service.validateDiceExpression(' 1D100 ')).toEqual({ isValid: true })
    })
  })

  describe('handleDiceRoll', () => {
    const req = { channelId: 'ch-1', diceType: '1d100', reason: '幸運' }

    it('キャラクターが見つからない場合は失敗結果を返し、failed イベントを emit する', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(null)
      const interaction = createMockButtonInteraction()

      // Act
      const result = await service.handleDiceRoll(interaction as ButtonInteraction, req)

      // Assert: 失敗結果
      expect(result.success).toBe(false)
      expect(result.error).toContain('Character not found')
      expect(result.diceType).toBe('1d100')
      // 副作用: createText は呼ばれず failed イベントが emit される
      expect(diceRollService.createText).not.toHaveBeenCalled()
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'diceroll.execute.failed',
        expect.objectContaining({ channelId: 'ch-1', source: 'dice-roll-logic-service' })
      )
    })

    it('成功時は rands から total を計算し保存・completed イベント emit・成功結果を返す', async () => {
      // Arrange: 出目 73
      characterService.findByChannelId.mockResolvedValue(buildCharacter({ gameSystemId: 'coc7' }))
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 73', [[73]]))
      diceRollService.createText.mockResolvedValue({ _id: { toString: () => 'roll-id-1' } } as any)
      const interaction = createMockButtonInteraction()

      // Act
      const result = await service.handleDiceRoll(interaction as ButtonInteraction, req)

      // Assert: 成功結果
      expect(result).toMatchObject({
        success: true,
        total: 73,
        details: '(1D100) ＞ 73',
        diceType: '1d100',
        reason: '幸運',
        characterName: 'テスト探索者',
        rollId: 'roll-id-1'
      })
      // 副作用: 保存と completed イベント
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'ch-1', diceExpression: '1d100', result: 73, gameSystem: 'coc7' })
      )
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'diceroll.execute.completed',
        expect.objectContaining({ channelId: 'ch-1' })
      )
    })

    it('req.userId が無い場合は interaction.user.id を userId に使う', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 50', [[50]]))
      diceRollService.createText.mockResolvedValue({ _id: { toString: () => 'r' } } as any)
      const interaction = createMockButtonInteraction()

      // Act
      await service.handleDiceRoll(interaction as ButtonInteraction, { channelId: 'ch-1', diceType: '1d100' })

      // Assert: ファクトリ既定ユーザーの id が使われる
      expect(diceRollService.createText).toHaveBeenCalledWith(expect.objectContaining({ userId: DEFAULT_MOCK_USER.id }))
    })

    it('rands が無い場合は text の "＞ N" から total を抽出する', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(buildCharacter({ gameSystemId: undefined }))
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 42'))
      diceRollService.createText.mockResolvedValue({ _id: { toString: () => 'r' } } as any)
      const interaction = createMockButtonInteraction()

      // Act
      const result = await service.handleDiceRoll(interaction as ButtonInteraction, req)

      // Assert: text から抽出した 42、gameSystemId 欠落時は 'unknown'
      expect(result.total).toBe(42)
      expect(diceRollService.createText).toHaveBeenCalledWith(expect.objectContaining({ gameSystem: 'unknown' }))
    })

    it('dice の結果が空(textなし)の場合は失敗結果を返す', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      mockedDice.mockResolvedValue(null as any)
      const interaction = createMockButtonInteraction()

      // Act
      const result = await service.handleDiceRoll(interaction as ButtonInteraction, req)

      // Assert: executeDiceRoll が throw し失敗結果になる
      expect(result.success).toBe(false)
      expect(result.error).toContain('ダイスロールの実行に失敗しました')
      expect(diceRollService.createText).not.toHaveBeenCalled()
    })
  })

  describe('handleSkillRoll', () => {
    const interaction = () => createMockButtonInteraction() as ButtonInteraction

    it('出目がスキル値以下なら成功として保存し、successLevel を含む結果を返す', async () => {
      // Arrange: skillValue=50、出目=40 → 成功 / hardSuccess(25)超なのでレギュラー成功
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 40', [[40]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      const result = await service.handleSkillRoll(interaction(), 'ch-1', '目星', 50, '探索')

      // Assert
      expect(result.success).toBe(true)
      expect(result.skillSuccess).toBe(true)
      expect(result.successLevel).toBe('レギュラー成功')
      expect(result.isSkillRoll).toBe(true)
      expect(result.reason).toBe('目星(50) - 探索')
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({ diceExpression: '1d100', result: 40 })
      )
    })

    it('出目がスキル値を超えると失敗(skillSuccess=false, successLevel=失敗)', async () => {
      // Arrange: skillValue=50、出目=60 → 失敗
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 60', [[60]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      const result = await service.handleSkillRoll(interaction(), 'ch-1', '目星', 50)

      // Assert
      expect(result.skillSuccess).toBe(false)
      expect(result.successLevel).toBe('失敗')
      // reason は理由省略時にスキル名(値)のみ
      expect(result.reason).toBe('目星(50)')
    })

    it('出目がスキル値/5以下ならクリティカル成功を判定する', async () => {
      // Arrange: skillValue=50 → criticalSuccess=floor(50/5)=10、出目=10 → クリティカル成功
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 10', [[10]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      const result = await service.handleSkillRoll(interaction(), 'ch-1', '回避', 50)

      // Assert
      expect(result.successLevel).toBe('クリティカル成功')
    })

    it('出目がスキル値/2以下(かつ/5超)ならハード成功を判定する', async () => {
      // Arrange: skillValue=50 → hardSuccess=floor(50/2)=25、出目=20 → ハード成功
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 20', [[20]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      const result = await service.handleSkillRoll(interaction(), 'ch-1', '聞き耳', 50)

      // Assert
      expect(result.successLevel).toBe('ハード成功')
    })

    it('キャラクターが見つからない場合は characterName を Unknown とし gameSystem は coc7 になる', async () => {
      // Arrange
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 30', [[30]]))
      characterService.findByChannelId.mockResolvedValue(null)
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      const result = await service.handleSkillRoll(interaction(), 'ch-1', '図書館', 70)

      // Assert
      expect(result.characterName).toBe('Unknown')
      expect(diceRollService.createText).toHaveBeenCalledWith(expect.objectContaining({ gameSystem: 'coc7' }))
    })

    it('dice 実行で例外が発生したら失敗結果を返し createText は呼ばない', async () => {
      // Arrange
      mockedDice.mockRejectedValue(new Error('loader failed'))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())

      // Act
      const result = await service.handleSkillRoll(interaction(), 'ch-1', '目星', 50)

      // Assert
      expect(result.success).toBe(false)
      expect(result.isSkillRoll).toBe(true)
      expect(result.diceType).toBe('1d100')
      expect(diceRollService.createText).not.toHaveBeenCalled()
    })
  })

  describe('handleCustomDiceRoll', () => {
    const interaction = () => createMockButtonInteraction() as ButtonInteraction

    it('成功時は isCustomRoll=true の結果を返し保存する', async () => {
      // Arrange
      mockedDice.mockResolvedValue(diceResult('(2D6) ＞ 7', [[3], [4]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter({ gameSystemId: 'custom-sys' }))
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      const result = await service.handleCustomDiceRoll(interaction(), 'ch-1', '2d6', '攻撃')

      // Assert
      expect(result.success).toBe(true)
      expect(result.isCustomRoll).toBe(true)
      expect(result.total).toBe(7)
      expect(result.diceType).toBe('2d6')
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({ diceExpression: '2d6', gameSystem: 'custom-sys' })
      )
    })

    it('キャラクター未取得時は Unknown / custom をデフォルトに使う', async () => {
      // Arrange
      mockedDice.mockResolvedValue(diceResult('(1D6) ＞ 4', [[4]]))
      characterService.findByChannelId.mockResolvedValue(null)
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      const result = await service.handleCustomDiceRoll(interaction(), 'ch-1', '1d6')

      // Assert
      expect(result.characterName).toBe('Unknown')
      expect(diceRollService.createText).toHaveBeenCalledWith(expect.objectContaining({ gameSystem: 'custom' }))
    })

    it('dice 実行で例外が発生したら失敗結果(isCustomRoll=true)を返す', async () => {
      // Arrange
      mockedDice.mockResolvedValue(null as any)
      characterService.findByChannelId.mockResolvedValue(buildCharacter())

      // Act
      const result = await service.handleCustomDiceRoll(interaction(), 'ch-1', '2d6')

      // Assert
      expect(result.success).toBe(false)
      expect(result.isCustomRoll).toBe(true)
      expect(result.diceType).toBe('2d6')
      expect(diceRollService.createText).not.toHaveBeenCalled()
    })
  })
})
