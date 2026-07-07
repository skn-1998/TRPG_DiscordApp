import { Injectable, Logger } from '@nestjs/common'
import { ChannelType, TextChannel } from 'discord.js'
import { Character } from 'src/domains/character/models/character.model'
import { DiceCalculationService, DiceCalculationResult, FlexibleDiceResult } from './dice-calculation.service'
import { DiceParserService, ParsedFormula } from './dice-parser.service'
import dice from 'src/discord/utils/dice'

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

  constructor(
    private readonly calculationService: DiceCalculationService,
    private readonly parserService: DiceParserService
  ) {
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
    character?: Character
  ): Promise<DiceCalculationResult> {
    this.logger.debug(`Calculating dice roll: ${formula}`)
    return this.calculationService.calculateAndRoll(formula, multiplier, modifier, character)
  }

  /**
   * 柔軟ダイス計算インターフェース
   * 旧 flexible-dice-calculator.service.ts の parseAndCalculate メソッドの代替
   */
  async parseAndCalculate(
    formula: string,
    multiplier: number = 1,
    modifier: number = 0,
    character?: Character
  ): Promise<FlexibleDiceResult> {
    this.logger.debug(`Parsing and calculating: ${formula}`)
    return this.calculationService.parseAndCalculate(formula, multiplier, modifier, character)
  }

  /**
   * 数式解析インターフェース
   */
  parseFormula(formula: string, character?: Character, multiplier: number = 1, modifier: number = 0): ParsedFormula {
    this.logger.debug(`Parsing formula: ${formula}`)
    return this.parserService.parseFormula(formula, character, multiplier, modifier)
  }

  /**
   * 数式評価インターフェース
   */
  evaluateFormula(formula: string): number {
    return this.parserService.evaluateFormula(formula)
  }

  /**
   * 結果絵文字取得インターフェース
   */
  getResultEmoji(diceResult: any, rollResult: number): string {
    return this.calculationService.getResultEmoji(diceResult, rollResult)
  }

  /**
   * 親チャンネル送信インターフェース
   */
  async sendToParentChannel(interaction: any, message: string): Promise<void> {
    return this.calculationService.sendToParentChannel(interaction, message)
  }

  /**
   * ダイス記法変換インターフェース
   */
  convertToDiceNotation(value: number): string {
    return this.parserService.convertToDiceNotation(value)
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
    if (numDice > 100 || diceSize > 1000 || numDice < 1 || diceSize < 1) {
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

  /**
   * ダイスロール結果に応じた絵文字を取得（基本ダイス記法用）
   * 旧 DiceNotationHandlerService.getResultEmoji の代替
   */
  getBasicResultEmoji(
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

  /**
   * サービス統計情報取得
   */
  getServiceStats(): {
    services: string[]
    features: string[]
    status: string
  } {
    return {
      services: ['DiceCalculationService', 'DiceParserService'],
      features: [
        'Unified dice calculation',
        'Flexible formula parsing',
        'Character parameter substitution',
        'Safe formula evaluation'
      ],
      status: 'active'
    }
  }

  /**
   * レガシーサービス互換メソッド
   * 既存コードの移行期間中に使用
   */

  // DiceCalculationHandlerService互換
  async legacyCalculateAndRoll(
    formula: string,
    multiplier: number = 1,
    modifier: number = 0,
    character?: Character
  ): Promise<DiceCalculationResult> {
    this.logger.warn('Legacy method called: legacyCalculateAndRoll. Please use calculateAndRoll instead.')
    return this.calculateAndRoll(formula, multiplier, modifier, character)
  }

  // FlexibleDiceCalculatorService互換
  async legacyParseAndCalculate(
    formula: string,
    multiplier: number = 1,
    modifier: number = 0,
    character?: Character
  ): Promise<FlexibleDiceResult> {
    this.logger.warn('Legacy method called: legacyParseAndCalculate. Please use parseAndCalculate instead.')
    return this.parseAndCalculate(formula, multiplier, modifier, character)
  }

  // DiceNotationHandlerService互換
  async executeNotation(
    notation: string,
    characterName: string = 'プレイヤー'
  ): Promise<{
    success: boolean
    diceResult?: any
    description: string
    characterName: string
  }> {
    this.logger.warn('Legacy method called: executeNotation. Please use executeBasicNotation instead.')
    return this.executeBasicNotation(notation, characterName)
  }
}
