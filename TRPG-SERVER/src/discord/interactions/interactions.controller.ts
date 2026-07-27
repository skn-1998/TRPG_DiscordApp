// 本 controller はルートデコレータ無しの未配線。
// InteractionsService.routeInteraction が正本。削除はバックログ。

import { Controller, Logger } from '@nestjs/common'
import { ButtonInteraction, ModalSubmitInteraction, AnySelectMenuInteraction, MessageFlags } from 'discord.js'
import { InteractionRegistryService } from './registry/interaction-registry.service'
import { respondEphemeralError } from '../utils/interaction-error-response.util'

/**
 * Discord Interactions Controller
 *
 * 目的: Discord.js インタラクション処理の統合管理
 * 責務: ボタン、モーダル、セレクトメニューのインタラクション処理
 *
 * 🆕 Registry方式に移行済み
 * - 従来のif文による分岐を廃止
 * - InteractionRegistryServiceによる自動ルーティング
 * - events/フォルダと統一されたアーキテクチャ
 */
@Controller('interactions')
export class InteractionsController {
  private readonly logger = new Logger(InteractionsController.name)

  constructor(private readonly interactionRegistry: InteractionRegistryService) {}

  /**
   * インタラクションハンドラー - 外部から呼び出される
   *
   * InteractionRegistryServiceに委譲し、自動ルーティングを行う
   */
  async handleInteraction(
    interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
  ): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (interaction.replied || interaction.deferred) {
      this.logger.warn(`インタラクション(ID: ${interaction.id})は既に応答済みです。処理をスキップします。`)
      return
    }

    this.logger.log(
      `インタラクション処理開始: Type=${interaction.type}, ID=${interaction.id}, CustomID=${interaction.customId}`
    )

    try {
      // InteractionRegistryServiceに委譲
      const handled = await this.interactionRegistry.route(interaction)

      if (!handled) {
        this.logger.warn(`未登録のインタラクション: ${interaction.customId}`)

        // 未登録のインタラクションにはエフェメラルで応答
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '⚠️ このインタラクションは現在処理できません。',
            flags: MessageFlags.Ephemeral
          })
        }
      }
    } catch (error) {
      this.logger.error(`インタラクション処理中にエラーが発生: ${interaction.customId}`, error)

      try {
        // components 層の deferred は deferUpdate 由来か deferReply 由来か判別不能。
        // editReply は deferUpdate 由来の公開メッセージ（キャラシート embed 等）をエラー文言で破壊するため、
        // 最後の砦は followUp に固定する（deferReply 由来の placeholder 残置は許容する劣化）。
        await respondEphemeralError(interaction, '❌ 処理中にエラーが発生しました。', {
          deferredStrategy: 'followUp'
        })
      } catch (replyError) {
        this.logger.warn('エラー応答の送信に失敗', replyError)
      }
    }
  }
}
