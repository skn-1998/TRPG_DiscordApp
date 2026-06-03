import { createMockButtonInteraction } from '@discord-test-utils'
import { CharacterDiceOrchestratorService } from './character-dice-orchestrator.service'
import { DiceButtonUIService } from './dice-button-ui.service'
import { DiceRollLogicService } from '../../services/dice/dice-roll-logic.service'
import { DiceHistoryService } from './dice-history.service'
import { DicePresetService } from '../../services/dice/dice-preset.service'
import { CharacterService } from '../../../domains/character/character.service'
import { ErrorHandler } from '../../../core/http/error-handler'

/**
 * CharacterDiceOrchestratorService はボタンインタラクションのルーティングを担う。
 * 依存サービスはすべて副作用の境界としてモックし、execute の customId 分岐
 * (roll*custom / preset-dice* / 標準) と委譲先の引数、エラー時の ErrorHandler 呼び出しを検証する。
 * 純粋ヘルパ extractChannelId / parseDiceRollInfo は標準ロール経路の request 内容で間接的に検証する。
 */
describe('CharacterDiceOrchestratorService', () => {
  let diceButtonUI: jest.Mocked<Pick<DiceButtonUIService, 'execute' | 'createErrorEmbed' | 'createDiceResultEmbed'>> & {
    data: unknown
  }
  let diceRollLogic: jest.Mocked<Pick<DiceRollLogicService, 'handleDiceRoll'>>
  let diceHistory: jest.Mocked<Pick<DiceHistoryService, 'updateDiceRollHistoryAsync'>>
  let characterService: jest.Mocked<Record<string, jest.Mock>>
  let dicePresetService: jest.Mocked<Pick<DicePresetService, 'handlePresetDiceRoll'>>
  let service: CharacterDiceOrchestratorService

  beforeEach(() => {
    diceButtonUI = {
      data: { custom_id: 'dice-button' },
      execute: jest.fn().mockResolvedValue(undefined),
      createErrorEmbed: jest.fn().mockReturnValue({ title: 'error-embed' }),
      createDiceResultEmbed: jest.fn().mockReturnValue({ title: 'result-embed' })
    }
    diceRollLogic = { handleDiceRoll: jest.fn() }
    diceHistory = { updateDiceRollHistoryAsync: jest.fn().mockResolvedValue(undefined) }
    characterService = {}
    dicePresetService = { handlePresetDiceRoll: jest.fn().mockResolvedValue(undefined) }

    service = new CharacterDiceOrchestratorService(
      diceButtonUI as unknown as DiceButtonUIService,
      diceRollLogic as unknown as DiceRollLogicService,
      diceHistory as unknown as DiceHistoryService,
      characterService as unknown as CharacterService,
      dicePresetService as unknown as DicePresetService
    )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('constructor', () => {
    it('diceButtonUI.data を data プロパティに転写する', () => {
      // Assert
      expect(service.data).toBe(diceButtonUI.data)
    })
  })

  describe('execute', () => {
    it('customId が roll*custom なら diceButtonUI.execute に委譲し他は呼ばない', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({ customId: 'roll*custom' })

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceButtonUI.execute).toHaveBeenCalledWith(interaction)
      expect(dicePresetService.handlePresetDiceRoll).not.toHaveBeenCalled()
      expect(interaction.deferUpdate).not.toHaveBeenCalled()
    })

    it('customId が preset-dice* で始まるなら dicePresetService.handlePresetDiceRoll に委譲する', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({ customId: 'preset-dice*abc' })

      // Act
      await service.execute(interaction)

      // Assert
      expect(dicePresetService.handlePresetDiceRoll).toHaveBeenCalledWith(interaction, 'preset-dice*abc')
      expect(diceButtonUI.execute).not.toHaveBeenCalled()
      expect(interaction.deferUpdate).not.toHaveBeenCalled()
    })

    it('標準ロールでは deferUpdate 後、抽出した channelId/diceType/reason で handleDiceRoll に委譲する', async () => {
      // Arrange: rollInfo = "1d100*ch-7*命中判定"
      const interaction = createMockButtonInteraction({ customId: 'roll*1d100*ch-7*命中判定' })
      diceRollLogic.handleDiceRoll.mockResolvedValue({
        success: true,
        characterName: '探索者',
        diceType: '1d100',
        total: 30,
        details: '[30]',
        reason: '命中判定',
        isSkillRoll: false
      } as never)
      // updateHistoryInBackground 内の getParentChannel は channel:null で早期 return させる
      ;(interaction as unknown as { channel: unknown }).channel = null

      // Act
      await service.execute(interaction)

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled()
      expect(diceRollLogic.handleDiceRoll).toHaveBeenCalledWith(interaction, {
        channelId: 'ch-7',
        diceType: '1d100',
        reason: '命中判定',
        userId: interaction.user.id
      })
      // 成功結果は createDiceResultEmbed → editReply
      expect(diceButtonUI.createDiceResultEmbed).toHaveBeenCalled()
      expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [{ title: 'result-embed' }] })
    })

    it('標準ロールで reason 無し(rollInfo="1d100*ch-7")なら reason は undefined になる', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({ customId: 'roll*1d100*ch-7' })
      diceRollLogic.handleDiceRoll.mockResolvedValue({ success: true, total: 50 } as never)
      ;(interaction as unknown as { channel: unknown }).channel = null

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceRollLogic.handleDiceRoll).toHaveBeenCalledWith(
        interaction,
        expect.objectContaining({ channelId: 'ch-7', diceType: '1d100', reason: undefined })
      )
    })

    it('handleDiceRoll が success:false ならエラー Embed を editReply する', async () => {
      // Arrange
      const interaction = createMockButtonInteraction({ customId: 'roll*1d100*ch-7' })
      diceRollLogic.handleDiceRoll.mockResolvedValue({
        success: false,
        error: 'ロール失敗',
        diceType: '1d100'
      } as never)

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceButtonUI.createErrorEmbed).toHaveBeenCalledWith('ロール失敗', 'ダイス: 1d100')
      expect(interaction.editReply).toHaveBeenCalledWith({ embeds: [{ title: 'error-embed' }] })
    })

    it('channelId が抽出できない rollInfo("1d100") は内部で throw され ErrorHandler が呼ばれる', async () => {
      // Arrange: '*' を含まないので extractChannelId が null → throw
      const spy = jest.spyOn(ErrorHandler, 'handleDiscordError').mockResolvedValue(undefined)
      const interaction = createMockButtonInteraction({ customId: 'roll*1d100' })

      // Act
      await service.execute(interaction)

      // Assert
      expect(diceRollLogic.handleDiceRoll).not.toHaveBeenCalled()
      expect(spy).toHaveBeenCalledWith(
        expect.any(Error),
        interaction,
        expect.objectContaining({
          operation: 'CharacterDiceOrchestratorService.execute',
          customId: 'roll*1d100',
          userId: interaction.user.id
        })
      )
    })

    it('委譲先が例外を投げた場合 ErrorHandler.handleDiscordError に委譲する', async () => {
      // Arrange
      const spy = jest.spyOn(ErrorHandler, 'handleDiscordError').mockResolvedValue(undefined)
      const interaction = createMockButtonInteraction({ customId: 'roll*custom' })
      diceButtonUI.execute.mockRejectedValue(new Error('boom'))

      // Act
      await service.execute(interaction)

      // Assert
      expect(spy).toHaveBeenCalledWith(expect.any(Error), interaction, expect.any(Object))
    })
  })
})
