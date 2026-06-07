import { ChannelType } from 'discord.js'
import { createMockModalInteraction } from '@discord-test-utils'
import { CustomDiceModalService } from './custom-dice-modal.service'
import { CharacterService } from 'src/domains/character/character.service'
import { DiceOrchestratorService } from 'src/discord/services/dice/dice-orchestrator.service'
import { ErrorHandler } from 'src/core/http/error-handler'

// このモーダルサービスは「customId 解析 → フィールド取得 → 種別分岐(custom/param)
// → DiceOrchestrator へ委譲 → 結果整形 → channel 種別で送信先を分岐」する。
// 副作用境界（CharacterService / DiceOrchestratorService / ErrorHandler）はモックし、
// 純粋な分岐・整形・委譲引数を検証する。
type CharacterServiceMock = { findOne: jest.Mock }
type DiceOrchestratorMock = {
  calculateAndRoll: jest.Mock
  executeBasicNotation: jest.Mock
  getResultEmoji: jest.Mock
  getBasicResultEmoji: jest.Mock
  sendToParentChannel: jest.Mock
  sendToParentChannelBasic: jest.Mock
}

describe('CustomDiceModalService', () => {
  let characterService: CharacterServiceMock
  let diceOrchestrator: DiceOrchestratorMock
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
    characterService = { findOne: jest.fn() }
    diceOrchestrator = {
      calculateAndRoll: jest.fn(),
      executeBasicNotation: jest.fn().mockResolvedValue(successResult),
      getResultEmoji: jest.fn().mockReturnValue('🎯'),
      getBasicResultEmoji: jest.fn().mockReturnValue('🎲'),
      sendToParentChannel: jest.fn().mockResolvedValue(undefined),
      sendToParentChannelBasic: jest.fn().mockResolvedValue(undefined)
    }
    service = new CustomDiceModalService(
      characterService as unknown as CharacterService,
      diceOrchestrator as unknown as DiceOrchestratorService
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
        description: '1D100',
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
      expect(replyArg.content).toContain('エラーが発生しました')
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
        expect.objectContaining({ content: expect.stringContaining('親チャンネル'), ephemeral: true })
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

    it('フィールド取得など外側で例外が出たとき ErrorHandler.handleDiscordError に委譲する', async () => {
      // Arrange: getTextInputValue 自体を投げさせ、外側 catch を発火
      const spy = jest.spyOn(ErrorHandler, 'handleDiscordError').mockResolvedValue(undefined)
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
