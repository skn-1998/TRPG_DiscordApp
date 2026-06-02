import { Injectable, Logger } from '@nestjs/common'
import { ButtonInteraction, ChannelType } from 'discord.js'
import { CharacterService } from 'src/domains/character/character.service'
import { Character } from 'src/domains/character/models/character.model'
import { ErrorHandler } from 'src/utils/error-handler'
import { DiceCalculationService } from './dice-calculation.service'

/**
 * プリセットダイス処理サービス
 * 旧 preset-dice-handler.service.ts から移行
 */
@Injectable()
export class DicePresetService {
  private readonly logger = new Logger(DicePresetService.name)

  constructor(
    private readonly characterService: CharacterService,
    private readonly diceCalculationService: DiceCalculationService
  ) {
    this.logger.debug('Dice Preset Service initialized')
  }

  /**
   * プリセットダイスロールを処理
   * 旧 preset-dice-handler.service.ts の handlePresetDiceRoll メソッド
   */
  async handlePresetDiceRoll(interaction: ButtonInteraction, customId: string): Promise<void> {
    try {
      // 操作中を示す
      await interaction.deferUpdate()

      // CustomIdをパース: preset-dice*characterId*section*key*value*multiplier
      const parts = customId.split('*')
      if (parts.length < 6) {
        await interaction.followUp({
          content: '❌ プリセットボタンの形式が正しくありません。',
          ephemeral: true
        })
        return
      }

      const [, characterId, , key, , multiplierStr] = parts
      const multiplier = parseInt(multiplierStr) || 1

      // キャラクター情報を取得
      let character: Character | undefined = undefined

      if (characterId) {
        try {
          const foundCharacter = await this.characterService.findOne(characterId)
          character = foundCharacter || undefined
        } catch (error) {
          this.logger.warn(`Character not found: ${characterId}`, error)
        }
      }

      // 統一ハンドラーで計算実行
      const formula = `${key}*${multiplier}`
      const calculationResult = await this.diceCalculationService.calculateAndRoll(
        formula,
        1, // 乗数は既にformula内に含まれる
        0, // 修正値なし
        character
      )

      let resultMessage: string

      if (calculationResult.success && calculationResult.diceResult) {
        const rollResult = calculationResult.diceResult.rands.reduce((acc: number, curr: number[]) => acc + curr[0], 0)
        const resultEmoji = this.diceCalculationService.getResultEmoji(calculationResult.diceResult, rollResult)

        // 結果メッセージを構築
        resultMessage = `${resultEmoji} **${calculationResult.characterName}** のクイックダイス\n`
        resultMessage += `**計算式**: ${calculationResult.description}\n`
        resultMessage += `**ダイスロール**: ${calculationResult.diceResult.text}`
      } else {
        resultMessage = `⚡ **${calculationResult.characterName}** のクイックダイス\n`
        resultMessage += `**計算式**: ${calculationResult.description}\n`
        resultMessage += `**結果**: エラーが発生しました`
      }

      // character-threadの場合は親チャンネルにも送信
      if (interaction.channel?.type === ChannelType.PublicThread) {
        await this.diceCalculationService.sendToParentChannel(interaction, resultMessage)
      }
    } catch (error) {
      await ErrorHandler.handleDiscordError(
        error,
        interaction,
        {
          action: 'preset-dice-roll',
          channelId: interaction.channel?.id
        },
        'プリセットダイスロール処理中にエラーが発生しました。もう一度お試しください。'
      )
    }
  }

  /**
   * プリセットダイスボタンの設定作成
   */
  createPresetButton(
    characterId: string,
    section: string,
    key: string,
    value: number,
    multiplier: number = 1
  ): { customId: string; label: string } {
    const customId = `preset-dice*${characterId}*${section}*${key}*${value}*${multiplier}`
    const label = multiplier > 1 ? `${key} x${multiplier}` : key

    return { customId, label }
  }

  /**
   * プリセットダイス設定の検証
   */
  validatePresetConfig(customId: string): boolean {
    const parts = customId.split('*')
    if (parts.length < 6) return false
    if (parts[0] !== 'preset-dice') return false

    const multiplier = parseInt(parts[5])
    const value = parseInt(parts[4])

    return !isNaN(multiplier) && !isNaN(value) && multiplier > 0 && value >= 0
  }
}
