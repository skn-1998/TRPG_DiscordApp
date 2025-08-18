import { Injectable } from '@nestjs/common'
import { ChannelType, TextChannel } from 'discord.js'
import { CharacterService } from 'src/domains/character/character.service'
import { Character } from 'src/domains/character/models/character.model'
import dice from 'src/discord/utils/dice'

/**
 * 統一されたダイス計算処理サービス
 * プリセットボタンと柔軟ダイス計算の両方で使用
 */
@Injectable()
export class DiceCalculationHandlerService {
  constructor(private readonly characterService: CharacterService) {}

  /**
   * キャラクターデータから実際の値を計算してダイスロール実行
   */
  async calculateAndRoll(
    formula: string,
    multiplier: number = 1,
    modifier: number = 0,
    character?: Character
  ): Promise<{
    success: boolean
    targetValue?: number
    diceResult?: any
    description: string
    characterName: string
  }> {
    let characterName = 'プレイヤー'
    if (character) {
      characterName = character.characterName || characterName
    }

    try {
      // 計算式をパースして値を取得
      const calculationResult = this.parseFormula(formula, character)

      // 乗数と修正値を適用
      const targetValue = calculationResult.value * multiplier + modifier

      let description = calculationResult.description
      if (multiplier !== 1) {
        description += ` × ${multiplier}`
      }
      if (modifier !== 0) {
        const sign = modifier >= 0 ? '+' : ''
        description += ` ${sign}${modifier}`
      }
      description += ` = ${targetValue}`

      // ダイスロール実行
      const diceCommand = `1d100<${targetValue}`
      const diceResult = await dice(diceCommand, 'Cthulhu')

      if (!diceResult) {
        return {
          success: false,
          description,
          characterName
        }
      }

      return {
        success: true,
        targetValue,
        diceResult,
        description,
        characterName
      }
    } catch (error) {
      return {
        success: false,
        description: `計算エラー: ${error instanceof Error ? error.message : '不明なエラー'}`,
        characterName
      }
    }
  }

  /**
   * 計算式をパースして数値と説明を取得
   */
  private parseFormula(formula: string, character?: Character): { value: number; description: string } {
    let processedFormula = formula.toLowerCase().trim()
    const substitutions: string[] = []

    // キャラクターデータを使用した計算式の処理
    if (character) {
      const sections = [
        { name: 'status', data: character.status },
        { name: 'skill', data: character.skill },
        { name: 'parameter', data: character.parameter }
      ]

      for (const section of sections) {
        if (!section.data) continue

        for (const [key, value] of Object.entries(section.data)) {
          const patterns = [key.toLowerCase(), key.toLowerCase().replace(/\s+/g, '')]

          for (const pattern of patterns) {
            const regex = new RegExp(`\\b${pattern}\\b`, 'gi')
            if (regex.test(processedFormula)) {
              let numericValue: number = 0

              if (typeof value === 'object' && value && 'value' in value) {
                numericValue = Number(value.value) || 0
              } else {
                numericValue = Number(value) || 0
              }

              if (numericValue > 0) {
                processedFormula = processedFormula.replace(regex, numericValue.toString())
                substitutions.push(`${key}=${numericValue}`)
                break
              }
            }
          }
        }
      }
    }

    // 数式を評価
    try {
      const evaluated = eval(processedFormula.replace(/[^0-9+\-*/.() ]/g, ''))
      if (typeof evaluated === 'number' && isFinite(evaluated)) {
        const description = substitutions.length > 0 ? `${formula} (${substitutions.join(', ')})` : formula

        return { value: evaluated, description }
      }
    } catch (error) {
      // eval失敗時はフォールバック
    }

    // パース失敗時は式をそのまま数値として扱う
    const numericValue = parseInt(formula) || 0
    return { value: numericValue, description: formula }
  }

  /**
   * 親チャンネルにメッセージを送信
   */
  async sendToParentChannel(interaction: any, message: string): Promise<void> {
    try {
      if (interaction.channel?.type === ChannelType.PublicThread) {
        const parentChannelId = interaction.channel.parentId
        if (parentChannelId) {
          const parentChannel = (await interaction.client.channels.fetch(parentChannelId)) as TextChannel
          if (parentChannel && parentChannel.isTextBased()) {
            await parentChannel.send({ content: message })
          }
        }
      }
    } catch (error) {
      console.error('親チャンネルへのメッセージ送信に失敗:', error)
    }
  }

  /**
   * ダイスロール結果に応じた絵文字を取得
   */
  getResultEmoji(
    diceResult: { critical?: boolean; fumble?: boolean; success?: boolean; failure?: boolean },
    result: number
  ): string {
    if (diceResult.critical || result < 5) {
      return '🌟' // クリティカル
    } else if (diceResult.fumble || result > 95) {
      return '💥' // ファンブル
    } else if (diceResult.success) {
      return '✅' // 成功
    } else if (diceResult.failure) {
      return '❌' // 失敗
    } else {
      return '🎲' // 普通のロール
    }
  }
}
