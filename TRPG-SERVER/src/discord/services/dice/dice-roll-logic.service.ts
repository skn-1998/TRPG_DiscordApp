import { Injectable, Logger } from '@nestjs/common'
import { ButtonInteraction, ChannelType } from 'discord.js'
import { DiceRollService } from '../../../domains/dice-roll/dice-roll.service'
import { CharacterService } from '../../../domains/character/character.service'
import {
  DiceExecutionService,
  UnsupportedDiceNotationError
} from '../../../domains/dice-roll/services/dice-execution.service'
import { resolveSaveChannelId } from '../../../domains/dice-roll/services/dice-save-key.util'
import { DiceRollRequest, DiceRollResult } from '../../utils/dice-roll.interface'
import { DiceRollTextInputDto } from '../../../domains/dice-roll/dto/create-dice-roll-text.dto'

/**
 * ダイスロールロジックサービス
 *
 * 責務：
 * - ダイスロール処理の実行（BCDice 実行コアは DiceExecutionService へ委譲・E-6e）
 * - ロール種別ごとの結果組み立て（スキル判定・カスタムロール）
 * - 履歴保存（保存キー解決は dice-save-key.util の純関数へ委譲・E-6e）
 */
@Injectable()
export class DiceRollLogicService {
  private readonly logger = new Logger(DiceRollLogicService.name)

  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly characterService: CharacterService,
    private readonly diceExecutionService: DiceExecutionService
  ) {
    this.logger.debug('Dice roll logic service initialized')
  }

  /**
   * ダイスロール処理を実行
   */
  async handleDiceRoll(interaction: ButtonInteraction, req: DiceRollRequest): Promise<DiceRollResult> {
    try {
      this.logger.debug(`Processing dice roll: ${req.diceType} for channel: ${req.channelId}`)

      // キャラクター情報を取得
      const character = await this.characterService.findByChannelId(req.channelId)
      if (!character) {
        throw new Error(`Character not found for channel: ${req.channelId}`)
      }

      // ダイスロールを実行
      const rollResult = await this.executeDiceRoll(req.diceType, req.reason)

      // ダイスロール結果をDBに保存
      const diceRollData: DiceRollTextInputDto = {
        channelId: this.resolveSaveChannelId(interaction, req.channelId),
        userId: req.userId || interaction.user.id,
        diceExpression: req.diceType,
        result: rollResult.total,
        resultDetails: rollResult.details,
        reason: req.reason,
        characterName: character.characterName,
        gameSystem: character.gameSystemId || 'unknown'
      }

      const savedRoll = await this.diceRollService.createText(diceRollData)

      const result: DiceRollResult = {
        success: true,
        total: rollResult.total,
        details: rollResult.details,
        diceType: req.diceType,
        reason: req.reason,
        characterName: character.characterName,
        rollId: savedRoll._id?.toString()
      }

      this.logger.debug(`Dice roll completed: ${result.total} (${result.details})`)
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (error instanceof UnsupportedDiceNotationError) {
        this.logger.warn(`Dice roll rejected: ${errorMessage}`)
      } else {
        this.logger.error(`Dice roll failed: ${errorMessage}`, error)
      }

      return {
        success: false,
        error: errorMessage,
        diceType: req.diceType,
        reason: req.reason
      }
    }
  }

  /**
   * ダイスロールを実行（BCDice 実行コア DiceExecutionService へ委譲・E-6e で domains/dice-roll に移設）
   */
  private async executeDiceRoll(diceExpression: string, _reason?: string): Promise<{ total: number; details: string }> {
    return this.diceExecutionService.executeDiceRoll(diceExpression)
  }

  /**
   * スキルロールを処理
   */
  async handleSkillRoll(
    interaction: ButtonInteraction,
    channelId: string,
    skillName: string,
    skillValue: number,
    reason?: string
  ): Promise<DiceRollResult> {
    try {
      // CoC7形式のスキル判定（1d100 <= skillValue）
      const rollResult = await this.executeDiceRoll('1d100')
      const successLevel = this.determineSuccessLevel(rollResult.total, skillValue)
      const isSuccess = successLevel !== '失敗' && successLevel !== 'ファンブル'

      const enhancedReason = reason ? `${skillName}(${skillValue}) - ${reason}` : `${skillName}(${skillValue})`

      // 結果の詳細を作成
      const details = `${rollResult.details} ≤ ${skillValue} → ${isSuccess ? '成功' : '失敗'} (${successLevel})`

      // キャラクター情報を取得
      const character = await this.characterService.findByChannelId(channelId)
      const characterName = character?.characterName || 'Unknown'

      // データベースに保存
      const diceRollData: DiceRollTextInputDto = {
        channelId: this.resolveSaveChannelId(interaction, channelId),
        userId: interaction.user.id,
        diceExpression: '1d100',
        result: rollResult.total,
        resultDetails: details,
        reason: enhancedReason,
        characterName,
        gameSystem: character?.gameSystemId || 'coc7'
      }

      await this.diceRollService.createText(diceRollData)

      return {
        success: true,
        total: rollResult.total,
        details,
        diceType: '1d100',
        reason: enhancedReason,
        characterName,
        isSkillRoll: true,
        skillSuccess: isSuccess,
        successLevel
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Skill roll failed: ${errorMessage}`, error)

      return {
        success: false,
        error: errorMessage,
        diceType: '1d100',
        reason: `${skillName}(${skillValue})`,
        isSkillRoll: true
      }
    }
  }

  /**
   * 成功レベルを判定（CoC7準拠）
   */
  private determineSuccessLevel(roll: number, skillValue: number): string {
    if (skillValue < 1) return '失敗'
    if (roll === 1) return 'クリティカル成功'

    // ファンブルは技能値以下でも失敗扱いになり得るため、通常成功より先に判定する。
    const isFumble = skillValue < 50 ? roll >= 96 : roll === 100
    if (isFumble) return 'ファンブル'

    const extremeSuccess = Math.floor(skillValue / 5)
    const hardSuccess = Math.floor(skillValue / 2)

    if (roll <= extremeSuccess) return 'エクストリーム成功'
    if (roll <= hardSuccess) return 'ハード成功'
    if (roll <= skillValue) return 'レギュラー成功'

    return '失敗'
  }

  /**
   * カスタムダイスロールを処理
   */
  async handleCustomDiceRoll(
    interaction: ButtonInteraction,
    channelId: string,
    diceExpression: string,
    reason?: string
  ): Promise<DiceRollResult> {
    try {
      const rollResult = await this.executeDiceRoll(diceExpression, reason)

      // キャラクター情報を取得
      const character = await this.characterService.findByChannelId(channelId)
      const characterName = character?.characterName || 'Unknown'

      // データベースに保存
      const diceRollData: DiceRollTextInputDto = {
        channelId: this.resolveSaveChannelId(interaction, channelId),
        userId: interaction.user.id,
        diceExpression,
        result: rollResult.total,
        resultDetails: rollResult.details,
        reason,
        characterName,
        gameSystem: character?.gameSystemId || 'custom'
      }

      await this.diceRollService.createText(diceRollData)

      return {
        success: true,
        total: rollResult.total,
        details: rollResult.details,
        diceType: diceExpression,
        reason,
        characterName,
        isCustomRoll: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (error instanceof UnsupportedDiceNotationError) {
        this.logger.warn(`Custom dice roll rejected: ${errorMessage}`)
      } else {
        this.logger.error(`Custom dice roll failed: ${errorMessage}`, error)
      }

      return {
        success: false,
        error: errorMessage,
        diceType: diceExpression,
        reason,
        isCustomRoll: true
      }
    }
  }

  /**
   * カスタムロールを実行し、投稿可能な結果を組み立てる。
   * 履歴保存は行わないため、呼び出し側はロール成功と永続化失敗を別々に扱える。
   */
  async executeCustomDiceRoll(
    diceExpression: string,
    reason?: string,
    characterName: string = 'Unknown'
  ): Promise<DiceRollResult> {
    try {
      const rollResult = await this.executeDiceRoll(diceExpression, reason)

      return {
        success: true,
        total: rollResult.total,
        details: rollResult.details,
        diceType: diceExpression,
        reason,
        characterName,
        isCustomRoll: true
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (error instanceof UnsupportedDiceNotationError) {
        this.logger.warn(`Custom dice roll rejected: ${errorMessage}`)
      } else {
        this.logger.error(`Custom dice roll failed: ${errorMessage}`, error)
      }

      return {
        success: false,
        error: errorMessage,
        diceType: diceExpression,
        reason,
        isCustomRoll: true
      }
    }
  }

  /** カスタムロール成功結果を履歴へ保存する。保存失敗は呼び出し側へ送出する。 */
  async saveCustomDiceRollHistory(
    interaction: ButtonInteraction,
    channelId: string,
    result: DiceRollResult,
    gameSystem: string = 'custom'
  ): Promise<void> {
    if (
      !result.success ||
      result.total === undefined ||
      result.details === undefined ||
      result.diceType === undefined ||
      result.characterName === undefined
    ) {
      throw new TypeError('A successful custom dice roll result is required')
    }

    const diceRollData: DiceRollTextInputDto = {
      channelId: this.resolveSaveChannelId(interaction, channelId),
      userId: interaction.user.id,
      diceExpression: result.diceType,
      result: result.total,
      resultDetails: result.details,
      reason: result.reason,
      characterName: result.characterName,
      gameSystem
    }

    await this.diceRollService.createText(diceRollData)
  }

  /**
   * 履歴の保存先 channelId を解決する
   *
   * 「スレッド内は実親チャンネル・スレッド外は lookup キー」の意味論は
   * domains/dice-roll/services/dice-save-key.util の純関数へ移設した（E-6e）。
   * ここでは interaction → context への変換だけを行う。
   */
  private resolveSaveChannelId(interaction: ButtonInteraction, lookupChannelId: string): string {
    const channel = interaction.channel
    if (channel && (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread)) {
      return resolveSaveChannelId({ channelId: lookupChannelId, parentId: channel.parentId, isThread: true })
    }
    return resolveSaveChannelId({ channelId: lookupChannelId, isThread: false })
  }

  /**
   * ダイス式の妥当性を検証
   */
  validateDiceExpression(expression: string): { isValid: boolean; error?: string } {
    try {
      const cleaned = this.diceExecutionService.cleanDiceExpression(expression)

      // 危険な値をチェック
      if (cleaned.includes('d0') || cleaned.includes('d1000000')) {
        return {
          isValid: false,
          error: 'ダイスの面数が無効です'
        }
      }

      return { isValid: true }
    } catch (error) {
      if (error instanceof UnsupportedDiceNotationError) {
        return {
          isValid: false,
          error: error.message
        }
      }
      return {
        isValid: false,
        error: 'ダイス式の解析に失敗しました'
      }
    }
  }
}
