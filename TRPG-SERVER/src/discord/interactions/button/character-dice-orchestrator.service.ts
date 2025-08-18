import { Injectable, Logger } from '@nestjs/common'
import { ButtonInteraction, CacheType, TextChannel, ChannelType } from 'discord.js'
import { discordButtonType } from '../../discord.type'

import { DiceButtonUIService } from './dice-button-ui.service'
import { DiceRollLogicService } from './dice-roll-logic.service'
import { DiceHistoryService } from './dice-history.service'
import { PresetDiceHandlerService } from '../../services/preset-dice-handler.service'

import { DiceRollRequest } from '../../utils/dice-roll.interface'
import { ErrorHandler } from '../../../utils/error-handler'
import { CharacterService } from '../../../domains/character/character.service'

/**
 * キャラクターダイスオーケストレーターサービス
 *
 * 責務：
 * - 分割されたダイスサービス間の協調
 * - ボタンインタラクションのルーティング
 * - 完全なダイスロールフローの管理
 */
@Injectable()
export class CharacterDiceOrchestratorService implements discordButtonType {
  private readonly logger = new Logger(CharacterDiceOrchestratorService.name)

  constructor(
    private readonly diceButtonUI: DiceButtonUIService,
    private readonly diceRollLogic: DiceRollLogicService,
    private readonly diceHistory: DiceHistoryService,
    private readonly characterService: CharacterService,
    private readonly presetDiceHandlerService: PresetDiceHandlerService
  ) {
    this.logger.debug('Character dice orchestrator service initialized')
  }

  // ButtonBuilderのインスタンス（discordButtonTypeインターフェース要件）
  public data = this.diceButtonUI.data

  /**
   * ボタンインタラクションの統合処理
   */
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const customId = interaction.customId

      this.logger.debug(`Processing button interaction: ${customId}`)

      // カスタムダイスロールの場合
      if (customId === 'roll*custom') {
        await this.diceButtonUI.execute(interaction)
        return
      }

      // プリセットダイスロールの場合
      if (customId.startsWith('preset-dice*')) {
        await this.presetDiceHandlerService.handlePresetDiceRoll(interaction, customId)
        return
      }

      // 操作中を示す
      await interaction.deferUpdate()

      // 通常のスキルロールまたはダイスロールの処理
      const rollInfo = customId.replace('roll*', '')
      await this.handleStandardDiceRoll(interaction, rollInfo)
    } catch (error) {
      this.logger.error('Failed to execute button interaction', error)

      const errorContext = {
        operation: 'CharacterDiceOrchestratorService.execute',
        customId: interaction.customId,
        userId: interaction.user.id,
        channelId: interaction.channelId
      }

      await ErrorHandler.handleDiscordError(error, interaction, errorContext)

      // ErrorHandlerが応答を処理するため、追加の応答は不要
    }
  }

  /**
   * 標準的なダイスロール処理
   */
  private async handleStandardDiceRoll(interaction: ButtonInteraction, rollInfo: string): Promise<void> {
    try {
      // channelIdを抽出
      const channelId = this.extractChannelId(rollInfo)
      if (!channelId) {
        throw new Error('Channel ID could not be extracted from button interaction')
      }

      // ダイスタイプと理由を分析
      const { diceType, reason } = this.parseDiceRollInfo(rollInfo, channelId)

      // ダイスロールリクエストを作成
      const request: DiceRollRequest = {
        channelId,
        diceType,
        reason,
        userId: interaction.user.id
      }

      // ダイスロール処理を実行
      const result = await this.diceRollLogic.handleDiceRoll(interaction, request)

      if (result.success === false) {
        // エラー結果を表示
        const errorEmbed = this.diceButtonUI.createErrorEmbed(
          result.error || 'ダイスロールに失敗しました',
          `ダイス: ${result.diceType}`
        )

        await interaction.editReply({ embeds: [errorEmbed] })
        return
      }

      // 成功結果を表示
      await this.displayDiceResult(interaction, result, channelId)

      // 履歴を更新（バックグラウンド）
      await this.updateHistoryInBackground(interaction, channelId, result)
    } catch (error) {
      this.logger.error(`Failed to handle standard dice roll: ${rollInfo}`, error)
      throw error
    }
  }

  /**
   * ダイスロール結果を表示
   */
  private async displayDiceResult(interaction: ButtonInteraction, result: any, channelId: string): Promise<void> {
    try {
      // 結果の色を決定
      let color = 0x0099ff // デフォルト青

      if (result.isSkillRoll) {
        color = result.skillSuccess ? 0x00ff00 : 0xff0000 // 成功=緑、失敗=赤
      } else if (result.total === 1) {
        color = 0xff0000 // ファンブル=赤
      } else if (result.total >= 95) {
        color = 0x00ff00 // クリティカル=緑
      }

      const embed = this.diceButtonUI.createDiceResultEmbed(
        result.characterName || 'Unknown',
        result.diceType || '1d100',
        result.total || 0,
        result.details || '',
        result.reason,
        color
      )

      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      this.logger.error('Failed to display dice result', error)
      throw error
    }
  }

  /**
   * バックグラウンドで履歴を更新
   */
  private async updateHistoryInBackground(
    interaction: ButtonInteraction,
    channelId: string,
    result: any
  ): Promise<void> {
    try {
      // 親チャンネルを取得
      const parentChannel = await this.getParentChannel(interaction)
      if (!parentChannel) {
        this.logger.warn(`Parent channel not found for interaction: ${interaction.channelId}`)
        return
      }

      // 履歴更新（非同期）
      await this.diceHistory.updateDiceRollHistoryAsync(interaction, channelId, parentChannel, {
        total: result.total,
        details: result.details,
        reason: result.reason
      })
    } catch (error) {
      this.logger.error('Failed to update history in background', error)
      // 履歴更新の失敗は全体処理をブロックしない
    }
  }

  /**
   * 親チャンネルを取得
   */
  private async getParentChannel(interaction: ButtonInteraction): Promise<TextChannel | null> {
    try {
      const channel = interaction.channel

      if (!channel) {
        return null
      }

      if (channel.type === ChannelType.GuildText) {
        return channel as TextChannel
      }

      if (channel.isThread()) {
        const parentChannel = channel.parent
        return parentChannel?.type === ChannelType.GuildText ? parentChannel : null
      }

      return null
    } catch (error) {
      this.logger.error('Failed to get parent channel', error)
      return null
    }
  }

  /**
   * channelIdを抽出
   */
  private extractChannelId(rollInfo: string): string | null {
    // rollInfo形式: "1d100*channelId*reason" または "1d100*channelId"
    const parts = rollInfo.split('*')
    return parts.length >= 2 ? parts[1] : null
  }

  /**
   * ダイスロール情報を解析
   */
  private parseDiceRollInfo(rollInfo: string, channelId: string): { diceType: string; reason?: string } {
    const parts = rollInfo.split('*')

    // parts[0] = diceType, parts[1] = channelId, parts[2] = reason (optional)
    const diceType = parts[0] || '1d100'
    const reason = parts.length > 2 ? parts.slice(2).join('*') : undefined

    return { diceType, reason }
  }

  /**
   * スキルロール処理（外部から呼び出し可能）
   */
  async handleSkillRoll(
    interaction: ButtonInteraction,
    channelId: string,
    skillName: string,
    skillValue: number,
    reason?: string
  ): Promise<void> {
    try {
      await interaction.deferUpdate()

      const result = await this.diceRollLogic.handleSkillRoll(interaction, channelId, skillName, skillValue, reason)

      await this.displayDiceResult(interaction, result, channelId)
      await this.updateHistoryInBackground(interaction, channelId, result)
    } catch (error) {
      this.logger.error(`Failed to handle skill roll: ${skillName}`, error)

      const errorEmbed = this.diceButtonUI.createErrorEmbed(
        'スキルロールに失敗しました',
        `スキル: ${skillName}(${skillValue})`
      )

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] })
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
      }
    }
  }

  /**
   * カスタムダイスロール処理（外部から呼び出し可能）
   */
  async handleCustomDiceRoll(
    interaction: ButtonInteraction,
    channelId: string,
    diceExpression: string,
    reason?: string
  ): Promise<void> {
    try {
      // ダイス式の妥当性検証
      const validation = this.diceRollLogic.validateDiceExpression(diceExpression)
      if (!validation.isValid) {
        const errorEmbed = this.diceButtonUI.createErrorEmbed(
          validation.error || 'ダイス式が無効です',
          `入力: ${diceExpression}`
        )

        await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
        return
      }

      await interaction.deferUpdate()

      const result = await this.diceRollLogic.handleCustomDiceRoll(interaction, channelId, diceExpression, reason)

      await this.displayDiceResult(interaction, result, channelId)
      await this.updateHistoryInBackground(interaction, channelId, result)
    } catch (error) {
      this.logger.error(`Failed to handle custom dice roll: ${diceExpression}`, error)

      const errorEmbed = this.diceButtonUI.createErrorEmbed(
        'カスタムダイスロールに失敗しました',
        `ダイス: ${diceExpression}`
      )

      if (interaction.deferred) {
        await interaction.editReply({ embeds: [errorEmbed] })
      } else {
        await interaction.reply({ embeds: [errorEmbed], ephemeral: true })
      }
    }
  }
}
