// DicePresetService は DI（CharacterService / DiceCalculationService）を受け取り、
// ButtonInteraction を捌く。検証対象は次の 3 つ。
//   - createPresetButton / validatePresetConfig: 純ロジック（モックなし）
//   - handlePresetDiceRoll: customId パース分岐・calculationResult 成否の文言・
//     PublicThread 時のみ親送信
// 副作用境界は CharacterService / DiceCalculationService / ErrorHandler / interaction I/O。
// ChannelType を実値で使うためグローバル discord.js スタブを実物に差し替える。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))
jest.mock('src/utils/error-handler')

import { Test } from '@nestjs/testing'
import { ChannelType, type ButtonInteraction } from 'discord.js'
import { CharacterService } from 'src/domains/character/character.service'
import { ErrorHandler } from 'src/utils/error-handler'
import { createMockButtonInteraction } from '@discord-test-utils'
import { DiceCalculationService } from './dice-calculation.service'
import { DicePresetService } from './dice-preset.service'

const mockedErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>

describe('DicePresetService', () => {
  let service: DicePresetService
  let characterService: jest.Mocked<Pick<CharacterService, 'findOne'>>
  let diceCalculationService: jest.Mocked<
    Pick<DiceCalculationService, 'calculateAndRoll' | 'getResultEmoji' | 'sendToParentChannel'>
  >

  beforeEach(async () => {
    characterService = { findOne: jest.fn() }
    diceCalculationService = {
      calculateAndRoll: jest.fn(),
      getResultEmoji: jest.fn().mockReturnValue('🎲'),
      sendToParentChannel: jest.fn().mockResolvedValue(undefined)
    }

    const moduleRef = await Test.createTestingModule({
      providers: [
        DicePresetService,
        { provide: CharacterService, useValue: characterService },
        { provide: DiceCalculationService, useValue: diceCalculationService }
      ]
    }).compile()

    service = moduleRef.get(DicePresetService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  /**
   * ファクトリ生成のボタン interaction をベースに channel 種別を差し込む。
   */
  function buildInteraction(channelType: number = ChannelType.GuildText): ButtonInteraction {
    const base = createMockButtonInteraction({ customId: 'preset-dice' })
    const interaction = base as unknown as Record<string, unknown>
    interaction.channel = { id: 'ch-1', type: channelType }
    return base
  }

  describe('createPresetButton', () => {
    it('customId とラベルを生成する（multiplier=1 のときラベルは key のみ）', () => {
      // Act
      const result = service.createPresetButton('char-1', 'status', 'hp', 12)

      // Assert
      expect(result).toEqual({
        customId: 'preset-dice*char-1*status*hp*12*1',
        label: 'hp'
      })
    })

    it('multiplier が 1 より大きいときラベルに「xN」を付与する', () => {
      const result = service.createPresetButton('char-1', 'param', 'str', 5, 3)

      expect(result.customId).toBe('preset-dice*char-1*param*str*5*3')
      expect(result.label).toBe('str x3')
    })
  })

  describe('validatePresetConfig', () => {
    it('正しい形式の customId は true を返す', () => {
      expect(service.validatePresetConfig('preset-dice*char-1*status*hp*12*2')).toBe(true)
    })

    it('要素数が 6 未満なら false を返す', () => {
      expect(service.validatePresetConfig('preset-dice*char-1*status*hp*12')).toBe(false)
    })

    it('先頭が preset-dice でなければ false を返す', () => {
      expect(service.validatePresetConfig('other-dice*char-1*status*hp*12*2')).toBe(false)
    })

    it('multiplier が 0 以下なら false を返す（境界値）', () => {
      expect(service.validatePresetConfig('preset-dice*char-1*status*hp*12*0')).toBe(false)
    })

    it('value が数値でなければ false を返す', () => {
      expect(service.validatePresetConfig('preset-dice*char-1*status*hp*abc*2')).toBe(false)
    })

    it('value が 0 は許容される（境界値）', () => {
      expect(service.validatePresetConfig('preset-dice*char-1*status*hp*0*1')).toBe(true)
    })
  })

  describe('handlePresetDiceRoll', () => {
    it('customId の要素数が 6 未満なら警告を followUp して中断する', async () => {
      // Arrange
      const interaction = buildInteraction()

      // Act
      await service.handlePresetDiceRoll(interaction, 'preset-dice*char-1*status')

      // Assert
      expect(interaction.deferUpdate).toHaveBeenCalled()
      expect(interaction.followUp).toHaveBeenCalledWith({
        content: '❌ プリセットボタンの形式が正しくありません。',
        ephemeral: true
      })
      expect(diceCalculationService.calculateAndRoll).not.toHaveBeenCalled()
    })

    it('計算成功時はキャラクター名・計算式・ダイス結果を含むメッセージを構築する', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue({
        characterId: 'char-1',
        characterName: 'アリス'
      } as never)
      diceCalculationService.calculateAndRoll.mockResolvedValue({
        success: true,
        characterName: 'アリス',
        description: 'hp*2',
        diceResult: { rands: [[7]], text: '(2D6) ＞ 7' }
      } as never)

      const interaction = buildInteraction(ChannelType.GuildText)

      // Act
      await service.handlePresetDiceRoll(interaction, 'preset-dice*char-1*status*hp*12*2')

      // Assert: 計算式は key*multiplier で組み立てられる
      expect(diceCalculationService.calculateAndRoll).toHaveBeenCalledWith(
        'hp*2',
        1,
        0,
        expect.objectContaining({
          characterName: 'アリス'
        })
      )
      // GuildText なので親送信なし
      expect(diceCalculationService.sendToParentChannel).not.toHaveBeenCalled()
    })

    it('計算失敗時はエラー文言を含むメッセージを構築する', async () => {
      // Arrange
      diceCalculationService.calculateAndRoll.mockResolvedValue({
        success: false,
        characterName: 'プレイヤー',
        description: 'hp*1'
      } as never)
      const interaction = buildInteraction(ChannelType.GuildText)

      // Act
      await service.handlePresetDiceRoll(interaction, 'preset-dice**status*hp*12*1')

      // Assert: emoji 取得（成功経路）は呼ばれない
      expect(diceCalculationService.getResultEmoji).not.toHaveBeenCalled()
      expect(diceCalculationService.sendToParentChannel).not.toHaveBeenCalled()
    })

    it('PublicThread の場合のみ親チャンネルへ結果を送信する', async () => {
      // Arrange
      characterService.findOne.mockResolvedValue(undefined as never)
      diceCalculationService.calculateAndRoll.mockResolvedValue({
        success: true,
        characterName: 'プレイヤー',
        description: 'hp*1',
        diceResult: { rands: [[3]], text: '(1D6) ＞ 3' }
      } as never)
      const interaction = buildInteraction(ChannelType.PublicThread)

      // Act
      await service.handlePresetDiceRoll(interaction, 'preset-dice*char-1*status*hp*12*1')

      // Assert
      expect(diceCalculationService.sendToParentChannel).toHaveBeenCalledTimes(1)
      expect(diceCalculationService.sendToParentChannel).toHaveBeenCalledWith(
        interaction,
        expect.stringContaining('クイックダイス')
      )
    })

    it('characterId が空のときは findOne を呼ばずプレイヤー名で続行する', async () => {
      // Arrange
      diceCalculationService.calculateAndRoll.mockResolvedValue({
        success: true,
        characterName: 'プレイヤー',
        description: 'hp*1',
        diceResult: { rands: [[5]], text: '(1D6) ＞ 5' }
      } as never)
      const interaction = buildInteraction(ChannelType.GuildText)

      // Act
      await service.handlePresetDiceRoll(interaction, 'preset-dice**status*hp*12*1')

      // Assert
      expect(characterService.findOne).not.toHaveBeenCalled()
      expect(diceCalculationService.calculateAndRoll).toHaveBeenCalledWith('hp*1', 1, 0, undefined)
    })

    it('処理中に例外が発生したら ErrorHandler.handleDiscordError に委譲する', async () => {
      // Arrange: deferUpdate で例外を発生させる
      const interaction = buildInteraction()
      ;(interaction.deferUpdate as jest.Mock).mockRejectedValue(new Error('defer failed'))

      // Act
      await service.handlePresetDiceRoll(interaction, 'preset-dice*char-1*status*hp*12*1')

      // Assert
      expect(mockedErrorHandler.handleDiscordError).toHaveBeenCalledTimes(1)
      const [errorArg, interactionArg, contextArg] = mockedErrorHandler.handleDiscordError.mock.calls[0]
      expect(errorArg).toBeInstanceOf(Error)
      expect(interactionArg).toBe(interaction)
      expect(contextArg).toEqual(expect.objectContaining({ action: 'preset-dice-roll' }))
    })
  })
})
