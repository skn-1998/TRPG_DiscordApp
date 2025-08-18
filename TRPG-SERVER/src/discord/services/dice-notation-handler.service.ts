import { Injectable } from '@nestjs/common'
import { ChannelType, TextChannel } from 'discord.js'
import dice from 'src/discord/utils/dice'

/**
 * ダイス記法専用処理サービス
 * 1d100, 2d6+3, 3d10-2などの標準的なダイス記法を処理
 */
@Injectable()
export class DiceNotationHandlerService {
  /**
   * ダイス記法を解析して実行
   */
  async executeNotation(
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
    const dicePattern = /^(\d+)d(\d+)([\+\-]\d+)*$/

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
