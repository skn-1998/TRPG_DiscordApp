import { Injectable, Logger } from '@nestjs/common'
import { ChannelType, TextChannel } from 'discord.js'
import { CharacterEntity } from 'src/domains/character/models/character.entity'
import { DiceCalculationService, DiceCalculationResult, MAX_DICE_COUNT } from './dice-calculation.service'
import dice from 'src/domains/dice-roll/services/bcdice.util'

/**
 * ダイス処理オーケストレーター
 *
 * 既存のダイス関連サービスを統合し、統一されたインターフェースを提供
 * 旧 dice-calculation-handler.service.ts, flexible-dice-calculator.service.ts の統合
 * 旧 dice-notation-handler.service.ts の統合（基本ダイス記法処理）
 */
@Injectable()
export class DiceOrchestratorService {
  private readonly logger = new Logger(DiceOrchestratorService.name)

  constructor(private readonly calculationService: DiceCalculationService) {
    this.logger.debug('Dice Orchestrator Service initialized')
  }

  /**
   * 統一されたダイス計算インターフェース
   * 旧 dice-calculation-handler.service.ts の calculateAndRoll メソッドの代替
   */
  async calculateAndRoll(
    formula: string,
    multiplier: number = 1,
    modifier: number = 0,
    character?: CharacterEntity
  ): Promise<DiceCalculationResult> {
    this.logger.debug(`Calculating dice roll: ${formula}`)
    return this.calculationService.calculateAndRoll(formula, multiplier, modifier, character)
  }

  /**
   * 結果絵文字取得インターフェース
   */
  getResultEmoji(diceResult: any): string {
    return this.calculationService.getResultEmoji(diceResult)
  }

  /**
   * 親チャンネル送信インターフェース
   */
  async sendToParentChannel(interaction: any, message: string): Promise<void> {
    return this.calculationService.sendToParentChannel(interaction, message)
  }

  /**
   * 基本ダイス記法処理
   * 旧 DiceNotationHandlerService.executeNotation の代替
   * 1d100, 2d6+3, 3d10-2などの標準的なダイス記法を処理
   */
  async executeBasicNotation(
    notation: string,
    characterName: string = 'プレイヤー'
  ): Promise<{
    success: boolean
    diceResult?: any
    description: string
    characterName: string
  }> {
    try {
      // ダイス記法の正規化
      const normalizedNotation = this.normalizeDiceNotation(notation)

      // ダイス記法の妥当性チェック
      if (!this.validateDiceNotation(normalizedNotation)) {
        return {
          success: false,
          description: `無効なダイス記法: ${notation}`,
          characterName
        }
      }

      // ダイスロール実行
      const diceResult = await dice(normalizedNotation, 'Cthulhu')

      if (!diceResult) {
        return {
          success: false,
          description: `ダイスロール実行失敗: ${normalizedNotation}`,
          characterName
        }
      }

      return {
        success: true,
        diceResult,
        description: normalizedNotation,
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
   * ダイス記法を正規化
   * 例: "2D100+10" -> "2d100+10", "1d100 " -> "1d100"
   */
  private normalizeDiceNotation(notation: string): string {
    return notation
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '') // スペースを削除
      .replace(/d+/g, 'd') // 複数のdを1つに統一
  }

  /**
   * ダイス記法の妥当性をチェック
   * 算術式用の DiceCalculationService.evaluateFormula とは別入口の別検証で、`2d6` はここでは受け入れる。
   */
  private validateDiceNotation(notation: string): boolean {
    // 基本的なダイス記法のパターン
    // 例: 1d100, 2d6+3, 3d10-5, 1d20+2-1
    const dicePattern = /^(\d+)d(\d+)([+-]\d+)*$/

    if (!dicePattern.test(notation)) {
      return false
    }

    const match = notation.match(/^(\d+)d(\d+)/)
    if (!match) return false

    const numDice = parseInt(match[1], 10)
    const diceSize = parseInt(match[2], 10)

    // 制限値チェック（サーバー負荷対策）
    if (numDice > MAX_DICE_COUNT || diceSize > 1000 || numDice < 1 || diceSize < 1) {
      return false
    }

    return true
  }

  /**
   * 親チャンネルにメッセージを送信（基本ダイス記法用）
   * 旧 DiceNotationHandlerService.sendToParentChannel の代替
   */
  async sendToParentChannelBasic(interaction: any, message: string): Promise<void> {
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
      this.logger.error('親チャンネルへのメッセージ送信に失敗:', error)
    }
  }

  // TODO: 第5群の死蔵一掃で削除する - 本番 import は 0 件で、現在の利用者は同 spec のみ。
  /**
   * 旧・基本ダイス記法用 API。判定規則は統一入口へ委譲する。
   */
  getBasicResultEmoji(diceResult: any): string {
    return this.calculationService.getResultEmoji(diceResult)
  }
}
