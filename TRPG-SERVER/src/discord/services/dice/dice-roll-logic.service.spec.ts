import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ChannelType, type ButtonInteraction } from 'discord.js'
import { DiceRollLogicService } from './dice-roll-logic.service'
import { DiceRollService } from '../../../domains/dice-roll/dice-roll.service'
import { CharacterService } from '../../../domains/character/character.service'
import { DiceExecutionService } from '../../../domains/dice-roll/services/dice-execution.service'
import { createMockButtonInteraction } from '@discord-test-utils'
import { DEFAULT_MOCK_USER } from '@discord-test-utils/interactions/base.types'
import dice from '../../../domains/dice-roll/services/bcdice.util'

// dice モジュール(BCDice ローダ)は副作用の境界として丸ごとモックし、
// 出目を固定して handleDiceRoll/handleSkillRoll/handleCustomDiceRoll の分岐を決定的に検証する。
// （E-6e: BCDice 実行コアは DiceExecutionService 経由になったが、実 provider を組み込み
//   境界モックは従来どおり bcdice.util に張ることで、既存 Assert 不変のまま挙動不変を証明する）
jest.mock('../../../domains/dice-roll/services/bcdice.util')

const mockedDice = dice as jest.MockedFunction<typeof dice>

/**
 * DiceRollLogicService はダイス核ロジック。
 * - 比較記法と成功レベルは validateDiceExpression / executeCustomDiceRoll / handleSkillRoll の
 *   公開 API 経由で挙動を網羅する。
 * - 副作用の境界(DiceRollService.createText / CharacterService.findByChannelId / dice())はモックする。
 * - interaction は @discord-test-utils ファクトリを使い、user.id 参照のみ利用する。
 * - かつて存在した実行完了/失敗イベントの emit は購読者ゼロの dead emit として撤去済み（E-3b・2026-07-07）。
 *   TypedEventService は注入ごと削除されたため、本 spec でもモックしない。
 */
describe('DiceRollLogicService', () => {
  let service: DiceRollLogicService
  let diceRollService: jest.Mocked<Pick<DiceRollService, 'createText'>>
  let characterService: jest.Mocked<Pick<CharacterService, 'findByChannelId'>>

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

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiceRollLogicService,
        DiceExecutionService,
        { provide: DiceRollService, useValue: diceRollService },
        { provide: CharacterService, useValue: characterService }
      ]
    }).compile()

    service = moduleRef.get(DiceRollLogicService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
  })

  describe('validateDiceExpression', () => {
    it('基本的なダイス式(1d100)は有効', () => {
      expect(service.validateDiceExpression('1d100')).toEqual({ isValid: true })
    })

    it('修飾子付きダイス式(2d6+3)は有効', () => {
      expect(service.validateDiceExpression('2d6+3')).toEqual({ isValid: true })
    })

    it('末尾比較付きダイス式(1d100<=70)は有効', () => {
      expect(service.validateDiceExpression('1d100<=70')).toEqual({ isValid: true })
    })

    it.each(['1d100<=70.5', '1d100<=9007199254740991', '1d100>=-9007199254740991'])(
      '小数または安全整数境界の目標値 %s は有効',
      (expression) => {
        expect(service.validateDiceExpression(expression)).toEqual({ isValid: true })
      }
    )

    it.each([
      '1d100<=9007199254740991.1',
      '1d100>=-9007199254740991.1',
      '1d100<=9007199254740992',
      '1d100>=-9007199254740992'
    ])('安全整数境界を超える目標値 %s は元メッセージで拒否する', (expression) => {
      expect(service.validateDiceExpression(expression)).toEqual({
        isValid: false,
        error: `未対応のダイス記法です: ${expression}`
      })
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

    it.each(['1d100<70', '@@@'])('未対応記法 %s は元のエラーメッセージを保つ', (expression) => {
      expect(service.validateDiceExpression(expression)).toEqual({
        isValid: false,
        error: `未対応のダイス記法です: ${expression}`
      })
    })

    it('空入力の解析失敗は汎用エラーへ変換する', () => {
      expect(service.validateDiceExpression('   ')).toEqual({
        isValid: false,
        error: 'ダイス式の解析に失敗しました'
      })
    })

    it('大文字や空白を含んでも正規化して有効と判定する', () => {
      expect(service.validateDiceExpression(' 1D100 ')).toEqual({ isValid: true })
    })
  })

  describe('handleDiceRoll', () => {
    const req = { channelId: 'ch-1', diceType: '1d100', reason: '幸運' }

    it('キャラクターが見つからない場合は失敗結果を返し、保存は行わない', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(null)
      const interaction = createMockButtonInteraction()

      // Act
      const result = await service.handleDiceRoll(interaction, req)

      // Assert: 失敗結果
      expect(result.success).toBe(false)
      expect(result.error).toContain('Character not found')
      expect(result.diceType).toBe('1d100')
      // 副作用: createText は呼ばれない（失敗イベントの emit は E-3b で撤去済み）
      expect(diceRollService.createText).not.toHaveBeenCalled()
    })

    it('成功時は rands から total を計算し保存して成功結果を返す', async () => {
      // Arrange: 出目 73
      characterService.findByChannelId.mockResolvedValue(buildCharacter({ gameSystemId: 'coc7' }))
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 73', [[73]]))
      diceRollService.createText.mockResolvedValue({ _id: { toString: () => 'roll-id-1' } } as any)
      const interaction = createMockButtonInteraction()

      // Act
      const result = await service.handleDiceRoll(interaction, req)

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
      // 副作用: 保存（完了イベントの emit は E-3b で撤去済み）
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'ch-1', diceExpression: '1d100', result: 73, gameSystem: 'coc7' })
      )
    })

    it('req.userId が無い場合は interaction.user.id を userId に使う', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 50', [[50]]))
      diceRollService.createText.mockResolvedValue({ _id: { toString: () => 'r' } } as any)
      const interaction = createMockButtonInteraction()

      // Act
      await service.handleDiceRoll(interaction, { channelId: 'ch-1', diceType: '1d100' })

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
      const result = await service.handleDiceRoll(interaction, req)

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
      const result = await service.handleDiceRoll(interaction, req)

      // Assert: executeDiceRoll が throw し失敗結果になる
      expect(result.success).toBe(false)
      expect(result.error).toContain('ダイスロールの実行に失敗しました')
      expect(diceRollService.createText).not.toHaveBeenCalled()
    })
  })

  describe('保存先 channelId の解決（スレッド内は実親チャンネル・2026-06-11 修正）', () => {
    // キャラ登録チャンネルの外で作られたスレッドでも /dice-result（実行チャンネルで検索）と
    // 一致するよう、スレッド内ロールは実親チャンネル ID で保存する。キャラ解決キーは不変。
    const threadInteraction = (parentId: string | null = 'parent-1') =>
      createMockButtonInteraction({
        base: {
          channel: {
            id: 'thread-1',
            name: 'thread',
            type: ChannelType.PublicThread,
            parentId,
            isTextBased: jest.fn().mockReturnValue(true),
            isThread: jest.fn().mockReturnValue(true)
          } as any
        }
      })

    it('handleDiceRoll: キャラ解決は customId キーのまま、保存は実親チャンネルで行う', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 73', [[73]]))
      diceRollService.createText.mockResolvedValue({ _id: { toString: () => 'r' } } as any)

      // Act
      await service.handleDiceRoll(threadInteraction(), { channelId: 'ch-1', diceType: '1d100' })

      // Assert: lookup は 'ch-1'・保存は 'parent-1'
      // （イベント payload の characterization は dead emit 撤去（E-3b）に伴い削除）
      expect(characterService.findByChannelId).toHaveBeenCalledWith('ch-1')
      expect(diceRollService.createText).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'parent-1' }))
    })

    it('handleSkillRoll: スレッド内ロールは実親チャンネルで保存する', async () => {
      // Arrange
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 40', [[40]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      await service.handleSkillRoll(threadInteraction(), 'ch-1', '目星', 50)

      // Assert
      expect(diceRollService.createText).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'parent-1' }))
    })

    it('handleCustomDiceRoll: スレッド内ロールは実親チャンネルで保存する', async () => {
      // Arrange
      mockedDice.mockResolvedValue(diceResult('(2D6) ＞ 7', [[3], [4]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      // Act
      await service.handleCustomDiceRoll(threadInteraction(), 'ch-1', '2d6')

      // Assert
      expect(diceRollService.createText).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'parent-1' }))
    })

    it('parentId が無いスレッドでは lookup キーへフォールバックして保存する', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 50', [[50]]))
      diceRollService.createText.mockResolvedValue({ _id: { toString: () => 'r' } } as any)

      // Act
      await service.handleDiceRoll(threadInteraction(null), { channelId: 'ch-1', diceType: '1d100' })

      // Assert
      expect(diceRollService.createText).toHaveBeenCalledWith(expect.objectContaining({ channelId: 'ch-1' }))
    })
  })

  describe('handleSkillRoll', () => {
    const interaction = () => createMockButtonInteraction()

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

    it.each([
      ['出目1', 1, 'クリティカル成功'],
      ['技能値/5境界', 10, 'エクストリーム成功'],
      ['技能値/5境界の直後', 11, 'ハード成功'],
      ['技能値/2境界', 25, 'ハード成功'],
      ['技能値/2境界の直後', 26, 'レギュラー成功']
    ])('%sを正しい成功レベルへ分類する', async (_caseName, roll, expectedLevel) => {
      mockedDice.mockResolvedValue(diceResult(`(1D100) ＞ ${roll}`, [[roll]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      const result = await service.handleSkillRoll(interaction(), 'ch-1', '回避', 50)

      expect(result.skillSuccess).toBe(true)
      expect(result.successLevel).toBe(expectedLevel)
    })

    it('技能値1・出目1はクリティカル成功にする', async () => {
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 1', [[1]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      const result = await service.handleSkillRoll(interaction(), 'ch-1', '幸運', 1)

      expect(result.skillSuccess).toBe(true)
      expect(result.successLevel).toBe('クリティカル成功')
    })

    it.each([0, -1])('技能値 %i は出目1でも最優先で失敗にし、details と結論を一致させる', async (skillValue) => {
      mockedDice.mockResolvedValue(diceResult('(1D100) ＞ 1', [[1]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      const result = await service.handleSkillRoll(interaction(), 'ch-1', '未修得技能', skillValue)

      const expectedDetails = `(1D100) ＞ 1 ≤ ${skillValue} → 失敗 (失敗)`
      expect(result.skillSuccess).toBe(false)
      expect(result.successLevel).toBe('失敗')
      expect(result.details).toBe(expectedDetails)
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({ resultDetails: expectedDetails })
      )
    })

    it.each([
      ['技能値49・出目95', 49, 95, '失敗'],
      ['技能値49・出目96', 49, 96, 'ファンブル'],
      ['技能値49・出目100', 49, 100, 'ファンブル'],
      ['技能値50・出目95', 50, 95, '失敗'],
      ['技能値50・出目96', 50, 96, '失敗'],
      ['技能値50・出目100', 50, 100, 'ファンブル']
    ])('%sをファンブル境界どおり分類して履歴へ保存する', async (_caseName, skillValue, roll, expectedLevel) => {
      mockedDice.mockResolvedValue(diceResult(`(1D100) ＞ ${roll}`, [[roll]]))
      characterService.findByChannelId.mockResolvedValue(buildCharacter())
      diceRollService.createText.mockResolvedValue({} as any)

      const result = await service.handleSkillRoll(interaction(), 'ch-1', '回避', skillValue)

      const expectedDetails = `(1D100) ＞ ${roll} ≤ ${skillValue} → 失敗 (${expectedLevel})`
      expect(result.skillSuccess).toBe(false)
      expect(result.successLevel).toBe(expectedLevel)
      expect(result.details).toBe(expectedDetails)
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({ resultDetails: expectedDetails })
      )
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
    const interaction = () => createMockButtonInteraction()

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

  describe('palette 用カスタムロールの実行・履歴分離', () => {
    it('executeCustomDiceRoll はロール結果だけを返し履歴保存を行わない', async () => {
      mockedDice.mockResolvedValue(diceResult('(2D6) ＞ 7', [[3], [4]]))

      const result = await service.executeCustomDiceRoll('2d6', '攻撃', '探索者')

      expect(result).toMatchObject({
        success: true,
        total: 7,
        details: '(2D6) ＞ 7',
        diceType: '2d6',
        reason: '攻撃',
        characterName: '探索者',
        isCustomRoll: true
      })
      expect(diceRollService.createText).not.toHaveBeenCalled()
      expect(characterService.findByChannelId).not.toHaveBeenCalled()
    })

    it.each([
      { roll: 42, outcome: '成功' },
      { roll: 85, outcome: '失敗' }
    ])('末尾比較付き palette ロールの出目 $roll を $outcome として返す', async ({ roll, outcome }) => {
      mockedDice.mockResolvedValue(diceResult(`(1D100) ＞ ${roll}`, [[roll]]))

      const result = await service.executeCustomDiceRoll('1d100<=70', 'DEX(70)', '探索者')

      expect(result).toMatchObject({
        success: true,
        total: roll,
        details: `(1D100) ＞ ${roll} ≤ 70 → ${outcome}`,
        diceType: '1d100<=70'
      })
      expect(mockedDice).toHaveBeenCalledWith('1d100', undefined)
    })

    it.each([
      {
        expression: '2d6+3>=10',
        rollExpression: '2d6+3',
        text: '(2D6+3) ＞ 7[3,4]+3 ＞ 10',
        rands: [[3], [4]],
        legacyTotal: 7,
        details: '(2D6+3) ＞ 7[3,4]+3 ＞ 10 ≥ 10 → 成功'
      },
      {
        expression: '(1d6+2)*2<=10',
        rollExpression: '(1d6+2)*2',
        text: '((1D6+2)*2) ＞ (3[3]+2)*2 ＞ 10',
        rands: [[3]],
        legacyTotal: 3,
        details: '((1D6+2)*2) ＞ (3[3]+2)*2 ＞ 10 ≤ 10 → 成功'
      },
      {
        expression: '3d6*5>=50',
        rollExpression: '3d6*5',
        text: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55',
        rands: [[2], [4], [5]],
        legacyTotal: 11,
        details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55 ≥ 50 → 成功'
      }
    ])(
      '$expression は legacy total を保ち、評価済み最終値で比較した結果を返す',
      async ({ expression, rollExpression, text, rands, legacyTotal, details }) => {
        mockedDice.mockResolvedValue(diceResult(text, rands))

        const result = await service.executeCustomDiceRoll(expression, '判定', '探索者')

        expect(mockedDice).toHaveBeenCalledWith(rollExpression, undefined)
        expect(result).toMatchObject({
          success: true,
          total: legacyTotal,
          details,
          diceType: expression
        })
      }
    )

    it('未対応の palette 記法は元の式を含む失敗結果を返す', async () => {
      const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation()

      const result = await service.executeCustomDiceRoll('1d100<70', 'DEX(70)', '探索者')

      expect(result).toMatchObject({
        success: false,
        error: '未対応のダイス記法です: 1d100<70',
        diceType: '1d100<70'
      })
      expect(mockedDice).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith('Unsupported dice notation: 1d100<70')
      expect(warnSpy).toHaveBeenCalledWith('Custom dice roll rejected: 未対応のダイス記法です: 1d100<70')
      expect(errorSpy).not.toHaveBeenCalled()
    })

    it('saveCustomDiceRollHistory は履歴保存失敗を呼び出し側へ送出する', async () => {
      const interaction = createMockButtonInteraction()
      const result = {
        success: true,
        total: 7,
        details: '(2D6) ＞ 7',
        diceType: '2d6',
        reason: '攻撃',
        characterName: '探索者',
        isCustomRoll: true
      }
      diceRollService.createText.mockRejectedValue(new Error('history unavailable'))

      await expect(service.saveCustomDiceRollHistory(interaction, 'ch-1', result, 'coc7')).rejects.toThrow(
        'history unavailable'
      )
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'ch-1',
          diceExpression: '2d6',
          characterName: '探索者',
          gameSystem: 'coc7'
        })
      )
    })
  })
})
