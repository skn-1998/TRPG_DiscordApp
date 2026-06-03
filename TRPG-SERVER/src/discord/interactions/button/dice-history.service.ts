import { Injectable, Logger } from '@nestjs/common'
import { ButtonInteraction, TextChannel, EmbedBuilder, Colors } from 'discord.js'
import { DiceRollService } from '../../../domains/dice-roll/dice-roll.service'
import { DiceRollPaginationService } from '../../components/pagination/dice-roll-pagination.service'
import { BackgroundTaskErrorHandler } from '../../../core/http/error-handler'

/**
 * ダイス履歴管理サービス
 *
 * 責務：
 * - ダイスロール履歴の管理
 * - 履歴の表示・更新
 * - ページネーション処理
 */
@Injectable()
export class DiceHistoryService {
  private readonly logger = new Logger(DiceHistoryService.name)

  // 最小更新間隔（ミリ秒）
  private readonly MIN_UPDATE_INTERVAL = 2000

  // 最後のEmbed更新時間を記録するMap
  private readonly lastEmbedUpdateTime = new Map<string, number>()

  // ページネーション処理のロック管理
  private readonly locks = new Map<string, boolean>()

  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly paginationService: DiceRollPaginationService
  ) {
    this.logger.debug('Dice history service initialized')
  }

  /**
   * ダイスロール履歴を更新（非同期）
   */
  async updateDiceRollHistoryAsync(
    interaction: ButtonInteraction,
    channelId: string,
    parentChannel: TextChannel,
    diceResult: { total: number; details: string; reason?: string }
  ): Promise<void> {
    try {
      const currentTime = Date.now()
      const lastUpdateTime = this.lastEmbedUpdateTime.get(channelId) || 0

      // 更新間隔チェック
      if (currentTime - lastUpdateTime < this.MIN_UPDATE_INTERVAL) {
        this.logger.debug(`Skipping embed update due to rate limit for channel: ${channelId}`)
        return
      }

      this.lastEmbedUpdateTime.set(channelId, currentTime)

      // バックグラウンドで履歴更新を実行
      this.performBackgroundHistoryUpdate(channelId, parentChannel, diceResult).catch((error) => {
        BackgroundTaskErrorHandler.handleBackgroundError(error, 'updateDiceRollHistoryAsync', { channelId, diceResult })
      })
    } catch (error) {
      this.logger.error(`Failed to update dice roll history: ${channelId}`, error)
    }
  }

  /**
   * バックグラウンドでの履歴更新処理
   */
  private async performBackgroundHistoryUpdate(
    channelId: string,
    parentChannel: TextChannel,
    _diceResult: { total: number; details: string; reason?: string }
  ): Promise<void> {
    try {
      // ロック確認
      if (this.locks.get(channelId)) {
        this.logger.debug(`History update already in progress for channel: ${channelId}`)
        return
      }

      this.locks.set(channelId, true)

      try {
        // 最新のダイスロール履歴を取得
        const recentRolls = await this.diceRollService.findTextsByChannelId(channelId)

        if (!recentRolls || recentRolls.length === 0) {
          this.logger.debug(`No dice roll history found for channel: ${channelId}`)
          return
        }

        // ページネーション表示を更新
        const embeds = await this.paginationService.createPaginatedEmbeds(channelId)
        if (embeds && embeds.length > 0) {
          // 最初のページを表示
          const controls = await this.paginationService.createPaginationControls(
            'temp-message-id', // 実際のメッセージIDが必要な場合は適切に設定
            channelId,
            embeds.length
          )
          await parentChannel.send({ embeds: [embeds[0]], components: controls })
        }

        this.logger.debug(`Dice roll history updated for channel: ${channelId}`)
      } finally {
        this.locks.delete(channelId)
      }
    } catch (error) {
      this.logger.error(`Background history update failed for channel: ${channelId}`, error)
      this.locks.delete(channelId)
      throw error
    }
  }

  /**
   * ページネーション付きダイスロール履歴を作成
   */
  async createPaginatedDiceRoll(channelId: string, parentChannel: TextChannel, page: number = 1): Promise<void> {
    try {
      const diceRolls = await this.diceRollService.findTextsByChannelId(channelId)

      if (!diceRolls || diceRolls.length === 0) {
        const embed = this.createNoHistoryEmbed()
        await parentChannel.send({ embeds: [embed] })
        return
      }

      // ページネーション表示を作成
      const embeds = await this.paginationService.createPaginatedEmbeds(channelId)
      if (embeds && embeds.length > 0) {
        // 指定されたページを表示（デフォルトは最初のページ）
        const pageIndex = Math.max(0, Math.min(page - 1, embeds.length - 1))
        const controls = await this.paginationService.createPaginationControls(
          'temp-message-id', // 実際のメッセージIDが必要な場合は適切に設定
          channelId,
          embeds.length
        )
        await parentChannel.send({ embeds: [embeds[pageIndex]], components: controls })
      }

      this.logger.debug(`Paginated dice roll created for channel: ${channelId}, page: ${page}`)
    } catch (error) {
      this.logger.error(`Failed to create paginated dice roll: ${channelId}`, error)

      const errorEmbed = this.createErrorEmbed('履歴の取得に失敗しました')
      await parentChannel.send({ embeds: [errorEmbed] })
    }
  }

  /**
   * 履歴なしの場合のエンベッドを作成
   */
  private createNoHistoryEmbed(): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle('📊 ダイスロール履歴')
      .setDescription('まだダイスロールの履歴がありません。\nダイスロールを実行すると、ここに表示されます。')
      .setColor(Colors.Blue)
      .setTimestamp()
  }

  /**
   * エラー表示用エンベッドを作成
   */
  private createErrorEmbed(message: string): EmbedBuilder {
    return new EmbedBuilder().setTitle('❌ エラー').setDescription(message).setColor(Colors.Red).setTimestamp()
  }

  /**
   * 履歴データをフォーマット
   */
  formatDiceRollHistory(rolls: any[]): string {
    if (!rolls || rolls.length === 0) {
      return 'ダイスロール履歴がありません'
    }

    return rolls
      .map((roll, index) => {
        const timestamp = new Date(roll.createdAt).toLocaleTimeString('ja-JP', {
          hour: '2-digit',
          minute: '2-digit'
        })

        const reason = roll.reason ? ` (${roll.reason})` : ''
        const character = roll.characterName || 'Unknown'

        return (
          `${index + 1}. **${character}** ${timestamp}\n` +
          `   ${roll.diceExpression} → **${roll.result}**${reason}\n` +
          `   ${roll.resultDetails || ''}`
        )
      })
      .join('\n\n')
  }

  /**
   * 履歴の統計情報を取得
   */
  async getHistoryStatistics(channelId: string): Promise<{
    totalRolls: number
    averageResult: number
    lastRollTime: Date | null
  }> {
    try {
      const allRolls = await this.diceRollService.findTextsByChannelId(channelId)

      if (!allRolls || allRolls.length === 0) {
        return {
          totalRolls: 0,
          averageResult: 0,
          lastRollTime: null
        }
      }

      const totalRolls = allRolls.length
      const totalResults = allRolls.reduce((sum, roll) => sum + (roll.result || 0), 0)
      const averageResult = Math.round((totalResults / totalRolls) * 100) / 100
      const lastRollTime = allRolls[0]?.createdAt || null

      return {
        totalRolls,
        averageResult,
        lastRollTime
      }
    } catch (error) {
      this.logger.error(`Failed to get history statistics for channel: ${channelId}`, error)
      return {
        totalRolls: 0,
        averageResult: 0,
        lastRollTime: null
      }
    }
  }

  /**
   * 古い履歴をクリーンアップ
   */
  async cleanupOldHistory(channelId: string, keepCount: number = 1000): Promise<number> {
    try {
      const deletedCount = await this.diceRollService.deleteOldRolls(channelId, keepCount)

      if (deletedCount > 0) {
        this.logger.log(`Cleaned up ${deletedCount} old dice rolls for channel: ${channelId}`)
      }

      return deletedCount
    } catch (error) {
      this.logger.error(`Failed to cleanup old history for channel: ${channelId}`, error)
      return 0
    }
  }

  /**
   * 履歴エクスポート用データを作成
   */
  async exportHistory(channelId: string, format: 'json' | 'csv' = 'json'): Promise<string> {
    try {
      const allRolls = await this.diceRollService.findTextsByChannelId(channelId)

      if (!allRolls || allRolls.length === 0) {
        return format === 'json' ? '[]' : 'No data'
      }

      if (format === 'csv') {
        const headers = 'Date,Character,Dice,Result,Details,Reason\n'
        const rows = allRolls
          .map(
            (roll) =>
              `"${new Date(roll.createdAt).toISOString()}","${roll.characterName || ''}","${roll.diceExpression}","${roll.result}","${roll.resultDetails || ''}","${roll.reason || ''}"`
          )
          .join('\n')

        return headers + rows
      } else {
        return JSON.stringify(allRolls, null, 2)
      }
    } catch (error) {
      this.logger.error(`Failed to export history for channel: ${channelId}`, error)
      throw error
    }
  }

  /**
   * 更新間隔制限をクリア
   */
  clearUpdateInterval(channelId: string): void {
    this.lastEmbedUpdateTime.delete(channelId)
    this.locks.delete(channelId)
  }
}
