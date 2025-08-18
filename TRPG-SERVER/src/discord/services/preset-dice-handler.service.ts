import { Injectable } from '@nestjs/common'
import { ButtonInteraction, ChannelType } from 'discord.js'
import { CharacterService } from 'src/domains/character/character.service'
import { Character } from 'src/domains/character/models/character.model'
import { ErrorHandler } from 'src/utils/error-handler'
import { DiceCalculationHandlerService } from './dice-calculation-handler.service'

/**
 * プリセットダイス処理専用サービス
 */
@Injectable()
export class PresetDiceHandlerService {
  constructor(
    private readonly characterService: CharacterService,
    private readonly diceCalculationHandlerService: DiceCalculationHandlerService
  ) {}

  /**
   * プリセットダイスロールを処理
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

      const [, characterId, section, key, value, multiplierStr] = parts
      const multiplier = parseInt(multiplierStr) || 1
      const parameterValue = parseInt(value) || 0

      // キャラクター情報を取得
      let character: Character | undefined = undefined
      let characterName = 'プレイヤー'

      if (characterId) {
        try {
          const foundCharacter = await this.characterService.findOne(characterId)
          character = foundCharacter || undefined
          if (character) {
            characterName = character.characterName || characterName
          }
        } catch (error) {
          console.warn(`Character not found: ${characterId}`, error)
        }
      }

      // 統一ハンドラーで計算実行
      const formula = `${key}*${multiplier}`
      const calculationResult = await this.diceCalculationHandlerService.calculateAndRoll(
        formula,
        1, // 乗数は既にformula内に含まれる
        0, // 修正値なし
        character
      )

      let resultMessage: string

      if (calculationResult.success && calculationResult.diceResult) {
        const rollResult = calculationResult.diceResult.rands.reduce((acc: number, curr: number[]) => acc + curr[0], 0)
        const resultEmoji = this.diceCalculationHandlerService.getResultEmoji(calculationResult.diceResult, rollResult)

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
        await this.diceCalculationHandlerService.sendToParentChannel(interaction, resultMessage)
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
}
