import { Injectable, Logger } from '@nestjs/common'
import { ButtonInteraction, ChannelType } from 'discord.js'
import { DiceRollService } from '../../../domains/dice-roll/dice-roll.service'
import { CharacterService } from '../../../domains/character/character.service'
import dice from '../../utils/dice'
import { DiceRollRequest, DiceRollResult } from '../../utils/dice-roll.interface'
import { DiceRollTextInputDto } from '../../../domains/dice-roll/dto/create-dice-roll-text.dto'

/**
 * ダイスロールロジックサービス
 *
 * 責務：
 * - ダイスロール処理の実行
 * - ダイス計算ロジック
 * - 結果の検証・フォーマット
 */
@Injectable()
export class DiceRollLogicService {
  private readonly logger = new Logger(DiceRollLogicService.name)

  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly characterService: CharacterService
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
      this.logger.error(`Dice roll failed: ${errorMessage}`, error)

      return {
        success: false,
        error: errorMessage,
        diceType: req.diceType,
        reason: req.reason
      }
    }
  }

  /**
   * ダイスロールを実行（内部実装）
   */
  private async executeDiceRoll(diceExpression: string, _reason?: string): Promise<{ total: number; details: string }> {
    try {
      // ダイス式をクリーンアップ
      const cleanExpression = this.cleanDiceExpression(diceExpression)

      // ダイスロールを実行
      const result = await dice(cleanExpression)

      if (!result || !result.text) {
        throw new Error(`Invalid dice roll result for: ${cleanExpression}`)
      }

      // BCDiceの結果からtotalを取得
      // 方法1: randsから合計を計算（最も正確）
      let total = 0
      if (result.rands && Array.isArray(result.rands)) {
        total = result.rands.reduce((acc: number, curr: number[]) => acc + (curr[0] || 0), 0)
      }

      // 方法2: randsがない場合はtextから抽出
      // BCDiceの形式: "(1D100) ＞ 73" または "(2D6) ＞ 7[3,4]"
      if (total === 0 && result.text) {
        // "＞" または ">" の後の数字を取得
        const match = result.text.match(/[＞>]\s*(\d+)/)
        if (match && match[1]) {
          total = parseInt(match[1], 10)
        }
      }

      this.logger.debug(`Dice roll result: ${cleanExpression} = ${total} (${result.text})`)

      return {
        total,
        details: result.text || `${cleanExpression} = ${total}`
      }
    } catch (error) {
      this.logger.error(`Failed to execute dice roll: ${diceExpression}`, error)
      throw new Error(`ダイスロールの実行に失敗しました: ${diceExpression}`)
    }
  }

  /**
   * ダイス式をクリーンアップ
   */
  private cleanDiceExpression(expression: string): string {
    // 基本的なクリーンアップ
    let cleaned = expression.toLowerCase().trim()

    // 危険な文字を除去
    cleaned = cleaned.replace(/[^0-9d+\-*/() ]/gi, '')

    // 空白を除去
    cleaned = cleaned.replace(/\s+/g, '')

    // 基本的な検証
    if (!cleaned.match(/^\d*d\d+([+\-*/]\d+)*$/)) {
      // 複雑な式の場合の追加検証
      if (!cleaned.match(/^[\d+\-*/()d]+$/)) {
        throw new Error(`無効なダイス式: ${expression}`)
      }
    }

    return cleaned
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
      const isSuccess = rollResult.total <= skillValue
      const successLevel = this.determineSuccessLevel(rollResult.total, skillValue)

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
    if (roll > skillValue) return '失敗'

    const criticalSuccess = Math.floor(skillValue / 5) || 1
    const extremeSuccess = Math.floor(skillValue / 5) || 1
    const hardSuccess = Math.floor(skillValue / 2) || 1

    if (roll <= criticalSuccess) return 'クリティカル成功'
    if (roll <= extremeSuccess) return 'エクストリーム成功'
    if (roll <= hardSuccess) return 'ハード成功'

    return 'レギュラー成功'
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
      this.logger.error(`Custom dice roll failed: ${errorMessage}`, error)

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
   * 履歴の保存先 channelId を解決する
   *
   * キャラ解決キー（customId 由来 = character.discordChannelId）と保存キーを分離する。
   * スレッド内のロールは、結果メッセージの投稿先（実親チャンネル）と同じキーで保存し、
   * /dice-result（実行チャンネルで検索）と一致させる。キャラ登録チャンネルの外で
   * 作成されたスレッドでも履歴が実親チャンネルから引けるようにするための分離。
   * スレッド外は従来どおり lookup キー（customId 由来）で保存する。
   */
  private resolveSaveChannelId(interaction: ButtonInteraction, lookupChannelId: string): string {
    const channel = interaction.channel
    if (channel && (channel.type === ChannelType.PublicThread || channel.type === ChannelType.PrivateThread)) {
      return channel.parentId ?? lookupChannelId
    }
    return lookupChannelId
  }

  /**
   * ダイス式の妥当性を検証
   */
  validateDiceExpression(expression: string): { isValid: boolean; error?: string } {
    try {
      const cleaned = this.cleanDiceExpression(expression)

      // 基本的なダイス式パターンをチェック
      const basicPattern = /^\d*d\d+([+\-*/]\d+)*$/
      const complexPattern = /^[\d+\-*/()d]+$/

      if (!basicPattern.test(cleaned) && !complexPattern.test(cleaned)) {
        return {
          isValid: false,
          error: 'ダイス式の形式が正しくありません。例: 1d100, 2d6+3'
        }
      }

      // 危険な値をチェック
      if (cleaned.includes('d0') || cleaned.includes('d1000000')) {
        return {
          isValid: false,
          error: 'ダイスの面数が無効です'
        }
      }

      return { isValid: true }
    } catch {
      return {
        isValid: false,
        error: 'ダイス式の解析に失敗しました'
      }
    }
  }
}
