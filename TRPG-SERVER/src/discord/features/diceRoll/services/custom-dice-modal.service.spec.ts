import { ChannelType, MessageFlags } from 'discord.js'
import { createMockModalInteraction } from '@discord-test-utils'
import { CustomDiceModalService } from './custom-dice-modal.service'
import { CharacterService } from 'src/domains/character/character.service'
import { DiceOrchestratorService } from 'src/discord/services/dice/dice-orchestrator.service'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { DiscordErrorReporter } from 'src/discord/utils/discord-error-reporter'

// このモーダルサービスは「customId 解析 → キャラ解決（channelId 優先 → characterId fallback）
// → フィールド取得 → 種別分岐(custom/param) → DiceOrchestrator へ委譲 → 履歴保存（createText）
// → 結果整形 → channel 種別で送信先を分岐」する。
// 副作用境界（CharacterService / DiceOrchestratorService / DiceRollService / DiscordErrorReporter）はモックし、
// 純粋な分岐・整形・委譲引数を検証する。
type CharacterServiceMock = { findOne: jest.Mock; findByChannelId: jest.Mock }
type DiceOrchestratorMock = {
  calculateAndRoll: jest.Mock
  executeBasicNotation: jest.Mock
  getResultEmoji: jest.Mock
  sendToParentChannel: jest.Mock
  sendToParentChannelBasic: jest.Mock
}
type DiceRollServiceMock = { createText: jest.Mock }

describe('CustomDiceModalService', () => {
  let characterService: CharacterServiceMock
  let diceOrchestrator: DiceOrchestratorMock
  let diceRollService: DiceRollServiceMock
  let service: CustomDiceModalService

  // 成功時の diceResult。rands は [[出目]] の配列で reduce 対象。
  const successResult = {
    success: true,
    characterName: 'プレイヤー',
    description: '1D100',
    diceResult: { text: '(1D100) ＞ 50', rands: [[50]] }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    characterService = {
      findOne: jest.fn().mockResolvedValue(null),
      findByChannelId: jest.fn().mockResolvedValue(null)
    }
    diceOrchestrator = {
      calculateAndRoll: jest.fn(),
      executeBasicNotation: jest.fn().mockResolvedValue(successResult),
      getResultEmoji: jest.fn().mockReturnValue('🎲'),
      sendToParentChannel: jest.fn().mockResolvedValue(undefined),
      sendToParentChannelBasic: jest.fn().mockResolvedValue(undefined)
    }
    diceRollService = { createText: jest.fn().mockResolvedValue({}) }
    service = new CustomDiceModalService(
      characterService as unknown as CharacterService,
      diceOrchestrator as unknown as DiceOrchestratorService,
      diceRollService as unknown as DiceRollService
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('execute - カスタムダイス（通常チャンネル）', () => {
    it('dice-command を executeBasicNotation に渡し、結果を reply する', async () => {
      // Arrange
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '' }
      })

      // Act
      await service.execute(interaction)

      // Assert: カスタムダイスは characterName 既定値 'プレイヤー' で委譲
      expect(diceOrchestrator.executeBasicNotation).toHaveBeenCalledWith('1d100', 'プレイヤー')
      expect(diceOrchestrator.calculateAndRoll).not.toHaveBeenCalled()
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('カスタムダイスロール') })
      )
    })

    it('コメントがある場合は【コメント】を結果メッセージ先頭に付与する', async () => {
      // Arrange
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '幸運判定' }
      })

      // Act
      await service.execute(interaction)

      // Assert
      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0]
      expect(replyArg.content).toContain('【幸運判定】')
    })

    it('calculationResult が失敗のときエラー文言を含む結果を reply する', async () => {
      // Arrange
      diceOrchestrator.executeBasicNotation.mockResolvedValue({
        success: false,
        characterName: 'プレイヤー',
        description: '無効なダイス記法: 1D100',
        diceResult: null
      })
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '' }
      })

      // Act
      await service.execute(interaction)

      // Assert
      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0]
      expect(replyArg.content).toContain('無効なダイス記法: 1D100')
    })
  })

  describe('execute - パラメータベース（param-dice-modal）', () => {
    it('dice-formula と multiplier/modifier を解析し calculateAndRoll に渡す', async () => {
      // Arrange: characterId 付き customId。findOne でキャラを返す。
      characterService.findOne.mockResolvedValue({ characterName: '探索者A' })
      diceOrchestrator.calculateAndRoll.mockResolvedValue({
        success: true,
        characterName: '探索者A',
        description: '1D100*2+3',
        diceResult: { text: '(1D100) ＞ 50', rands: [[50]] }
      })
      const interaction = createMockModalInteraction({
        customId: 'param-dice-modal*char-123',
        fields: {
          'dice-formula': '1d100',
          'dice-comment': '',
          multiplier: '2',
          modifier: '+3'
        }
      })

      // Act
      await service.execute(interaction)

      // Assert: キャラ取得 → 計算委譲（multiplier=2, modifier=3, character 渡し）
      expect(characterService.findOne).toHaveBeenCalledWith('char-123')
      expect(diceOrchestrator.calculateAndRoll).toHaveBeenCalledWith('1d100', 2, 3, { characterName: '探索者A' })
      expect(diceOrchestrator.executeBasicNotation).not.toHaveBeenCalled()
      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0]
      expect(replyArg.content).toContain('柔軟ダイスロール')
    })

    it('multiplier/modifier が空欄なら既定値(1, 0)で計算する', async () => {
      // Arrange
      diceOrchestrator.calculateAndRoll.mockResolvedValue({
        success: true,
        characterName: 'プレイヤー',
        description: '1D100',
        diceResult: { text: '(1D100) ＞ 50', rands: [[50]] }
      })
      const interaction = createMockModalInteraction({
        customId: 'param-dice-modal*char-1',
        fields: { 'dice-formula': '1d100', 'dice-comment': '', multiplier: '', modifier: '' }
      })
      characterService.findOne.mockResolvedValue(null)

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceOrchestrator.calculateAndRoll).toHaveBeenCalledWith('1d100', 1, 0, undefined)
    })

    it.each(['2abc', '0.5'])('整数でない乗数 %s は計算せず既存のエラー応答経路へ渡す', async (multiplier) => {
      // Arrange
      const errorReporter = jest.spyOn(DiscordErrorReporter, 'handleDiscordError').mockResolvedValue(undefined)
      const interaction = createMockModalInteraction({
        customId: 'param-dice-modal*char-1',
        fields: { 'dice-formula': '1d100', 'dice-comment': '', multiplier, modifier: '' }
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceOrchestrator.calculateAndRoll).not.toHaveBeenCalled()
      expect(errorReporter).toHaveBeenCalledWith(
        expect.any(Error),
        interaction,
        expect.objectContaining({ action: 'flexible-dice-modal' }),
        'エラーが発生しました。もう一度お試しください。'
      )
    })

    it.each(['2d6', 'abc+1'])('未対応文字を含む式 %s は理由を利用者へ返し、履歴へ保存しない', async (formula) => {
      // Arrange
      diceOrchestrator.calculateAndRoll.mockResolvedValue({
        success: false,
        characterName: 'プレイヤー',
        description: `未対応のダイス記法です: ${formula}`
      })
      const interaction = createMockModalInteraction({
        customId: 'param-dice-modal*char-1',
        fields: { 'dice-formula': formula, 'dice-comment': '', multiplier: '', modifier: '' }
      })

      // Act
      await service.execute(interaction)

      // Assert
      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0]
      expect(diceOrchestrator.calculateAndRoll).toHaveBeenCalledWith(formula, 1, 0, undefined)
      expect(replyArg.content).toContain(`**計算式**: ${formula}`)
      expect(replyArg.content).toContain(`**結果**: 未対応のダイス記法です: ${formula}`)
      expect(diceRollService.createText).not.toHaveBeenCalled()
    })
  })

  describe('execute - BCDice 判定フラグ', () => {
    it('custom/param の両経路で同じ BCDice 結果を同じ判定入口へ渡す', async () => {
      // Arrange
      diceOrchestrator.getResultEmoji.mockReturnValue('🎲')
      const multipleDiceResult = {
        ...successResult,
        diceResult: { text: '(2D6) ＞ 3,4', rands: [[3], [4]] }
      }
      diceOrchestrator.executeBasicNotation.mockResolvedValue(multipleDiceResult)
      diceOrchestrator.calculateAndRoll.mockResolvedValue({
        ...multipleDiceResult,
        targetValue: 5
      })
      const customInteraction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '2d6', 'dice-comment': '' }
      })
      const parameterInteraction = createMockModalInteraction({
        customId: 'param-dice-modal*char-1',
        fields: { 'dice-formula': '5', 'dice-comment': '', multiplier: '', modifier: '' }
      })

      // Act
      await service.execute(customInteraction)
      await service.execute(parameterInteraction)

      // Assert
      expect(diceOrchestrator.getResultEmoji).toHaveBeenNthCalledWith(1, multipleDiceResult.diceResult)
      expect(diceOrchestrator.getResultEmoji).toHaveBeenNthCalledWith(2, multipleDiceResult.diceResult)
      expect((customInteraction.reply as jest.Mock).mock.calls[0][0].content).toContain('🎲')
      expect((parameterInteraction.reply as jest.Mock).mock.calls[0][0].content).toContain('🎲')
    })
  })

  describe('execute - キャラ解決と履歴保存（2026-06-10 不具合修正）', () => {
    // live 送出元 FlexibleDiceSelectHandler は custom-dice-modal*{channelId} を送る
    it('custom-dice-modal*{channelId} は findByChannelId でキャラ解決し、キャラ名で委譲・履歴保存する', async () => {
      // Arrange
      characterService.findByChannelId.mockResolvedValue({
        characterName: '探索者A',
        discordChannelId: 'channel-789',
        gameSystemId: 'coc7'
      })
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal*channel-789',
        fields: { 'dice-command': '1d100', 'dice-comment': '幸運判定' }
      })

      // Act
      await service.execute(interaction)

      // Assert: channelId として解決（旧実装は findOne に渡して常に失敗→'プレイヤー' になっていた）
      expect(characterService.findByChannelId).toHaveBeenCalledWith('channel-789')
      expect(diceOrchestrator.executeBasicNotation).toHaveBeenCalledWith('1d100', '探索者A')
      // Assert: 親チャンネル ID（customId 由来）で履歴保存される
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'channel-789',
          userId: '123456789012345678',
          diceExpression: '1D100',
          result: 50,
          resultDetails: '(1D100) ＞ 50',
          reason: '幸運判定',
          characterName: '探索者A',
          gameSystem: 'coc7'
        })
      )
    })

    it('旧 param 系（characterId 埋め込み）は findOne へフォールバックし、キャラの discordChannelId で保存する', async () => {
      // Arrange: findByChannelId は不一致 → findOne で解決
      characterService.findByChannelId.mockResolvedValue(null)
      characterService.findOne.mockResolvedValue({
        characterName: '探索者B',
        discordChannelId: 'channel-1',
        gameSystemId: 'coc7'
      })
      diceOrchestrator.calculateAndRoll.mockResolvedValue({
        success: true,
        characterName: '探索者B',
        description: '1D100*2+3',
        diceResult: { text: '(1D100) ＞ 40', rands: [[40]] }
      })
      const interaction = createMockModalInteraction({
        customId: 'param-dice-modal*char-123',
        fields: { 'dice-formula': '1d100', 'dice-comment': '', multiplier: '2', modifier: '+3' }
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(characterService.findByChannelId).toHaveBeenCalledWith('char-123')
      expect(characterService.findOne).toHaveBeenCalledWith('char-123')
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'channel-1',
          diceExpression: '1D100*2+3',
          result: 40,
          characterName: '探索者B'
        })
      )
    })

    it('id なし（bare customId）の通常チャンネルでは interaction.channelId で履歴保存する', async () => {
      // Arrange: createBaseInteractionMock の既定 channelId は '555666777888999000'
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '' }
      })

      // Act
      await service.execute(interaction)

      // Assert: キャラ解決は行わず（id なし）、現在チャンネルへフォールバック保存
      expect(characterService.findByChannelId).not.toHaveBeenCalled()
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: '555666777888999000', gameSystem: 'custom' })
      )
    })

    it('スレッド内の送信は実親チャンネル ID で履歴保存する（キャラ登録チャンネルより優先・2026-06-11 修正）', async () => {
      // Arrange: キャラ登録チャンネル(channel-789)と実親(parent-1)が異なるケース
      characterService.findByChannelId.mockResolvedValue({
        characterName: '探索者A',
        discordChannelId: 'channel-789',
        gameSystemId: 'coc7'
      })
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal*channel-789',
        fields: { 'dice-command': '1d100', 'dice-comment': '' },
        base: {
          channel: {
            id: 'thread-1',
            name: 'thread',
            type: ChannelType.PublicThread,
            parentId: 'parent-1',
            isTextBased: jest.fn().mockReturnValue(true),
            isThread: jest.fn().mockReturnValue(true)
          } as any
        }
      })

      // Act
      await service.execute(interaction)

      // Assert: 結果メッセージの投稿先（実親）と同じキーで保存される
      expect(diceRollService.createText).toHaveBeenCalledWith(
        expect.objectContaining({ channelId: 'parent-1', characterName: '探索者A' })
      )
    })

    it('ロール失敗時は履歴保存しない', async () => {
      // Arrange
      diceOrchestrator.executeBasicNotation.mockResolvedValue({
        success: false,
        characterName: 'プレイヤー',
        description: '無効なダイス記法: 1D100',
        diceResult: null
      })
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '' }
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceRollService.createText).not.toHaveBeenCalled()
    })

    it('履歴保存が失敗してもロール結果の reply は行う（保存失敗で UX を壊さない）', async () => {
      // Arrange
      diceRollService.createText.mockRejectedValue(new Error('db-down'))
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '' }
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('カスタムダイスロール') })
      )
    })
  })

  describe('execute - チャンネル種別による送信先分岐', () => {
    it('PublicThread ではカスタムダイスを親チャンネルへ送り、ephemeral 案内を reply する', async () => {
      // Arrange: channel.type を PublicThread に上書き
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '' },
        base: {
          channel: {
            id: 'thread-1',
            name: 'thread',
            type: ChannelType.PublicThread,
            isTextBased: jest.fn().mockReturnValue(true),
            isThread: jest.fn().mockReturnValue(true)
          }
        }
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceOrchestrator.sendToParentChannelBasic).toHaveBeenCalledWith(interaction, expect.any(String))
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('親チャンネル'), flags: MessageFlags.Ephemeral })
      )
    })

    it('PublicThread でパラメータベースなら sendToParentChannel を使う', async () => {
      // Arrange
      diceOrchestrator.calculateAndRoll.mockResolvedValue({
        success: true,
        characterName: 'プレイヤー',
        description: '1D100',
        diceResult: { text: '(1D100) ＞ 50', rands: [[50]] }
      })
      characterService.findOne.mockResolvedValue(null)
      const interaction = createMockModalInteraction({
        customId: 'param-dice-modal*char-1',
        fields: { 'dice-formula': '1d100', 'dice-comment': '', multiplier: '', modifier: '' },
        base: {
          channel: {
            id: 'thread-1',
            name: 'thread',
            type: ChannelType.PublicThread,
            isTextBased: jest.fn().mockReturnValue(true),
            isThread: jest.fn().mockReturnValue(true)
          }
        }
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceOrchestrator.sendToParentChannel).toHaveBeenCalledWith(interaction, expect.any(String))
      expect(diceOrchestrator.sendToParentChannelBasic).not.toHaveBeenCalled()
    })
  })

  describe('execute - 異常系', () => {
    it('計算ハンドラーが例外を投げたとき計算エラー文言で reply する', async () => {
      // Arrange: executeBasicNotation が reject
      diceOrchestrator.executeBasicNotation.mockRejectedValue(new Error('calc-boom'))
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '' }
      })

      // Act
      await service.execute(interaction)

      // Assert
      const replyArg = (interaction.reply as jest.Mock).mock.calls[0][0]
      expect(replyArg.content).toContain('計算エラーが発生しました')
    })

    it('フィールド取得など外側で例外が出たとき DiscordErrorReporter.handleDiscordError に委譲する', async () => {
      // Arrange: getTextInputValue 自体を投げさせ、外側 catch を発火
      const spy = jest.spyOn(DiscordErrorReporter, 'handleDiscordError').mockResolvedValue(undefined)
      const interaction = createMockModalInteraction({
        customId: 'custom-dice-modal',
        fields: { 'dice-command': '1d100', 'dice-comment': '' }
      })
      ;(interaction.fields.getTextInputValue as jest.Mock).mockImplementation(() => {
        throw new Error('field-boom')
      })

      // Act
      await service.execute(interaction)

      // Assert
      expect(spy).toHaveBeenCalledWith(
        expect.any(Error),
        interaction,
        expect.objectContaining({ action: 'flexible-dice-modal' }),
        expect.any(String)
      )
    })
  })
})
