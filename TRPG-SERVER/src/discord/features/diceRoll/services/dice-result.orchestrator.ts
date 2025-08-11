import { Injectable, Logger } from '@nestjs/common'
import { CommandInteraction } from 'discord.js'
import {
  DiceRollPaginationService,
  PaginatedDiceRoll
} from '../../../components/pagination/dice-roll-pagination.service'

@Injectable()
export class DiceResultOrchestrator {
  private readonly logger = new Logger(DiceResultOrchestrator.name)

  constructor(private readonly diceRollPaginationService: DiceRollPaginationService) {}

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return

    // 遅延応答
    await interaction.deferReply()

    const channelId = interaction.channelId
    if (!channelId) {
      await interaction.editReply({ content: '⚠️ チャンネル情報を取得できませんでした。' })
      return
    }

    // オプション取得
    const characterOption = interaction.options.getString('character')

    this.logger.debug('ダイスロール履歴取得(Orchestrator)', { channelId, characterOption })

    // ページ作成
    const pages = await this.diceRollPaginationService.createPaginatedEmbeds(channelId, characterOption || undefined)

    if (!pages || pages.length === 0) {
      await interaction.editReply({ content: 'ダイスロール履歴がありません。' })
      return
    }

    // 一旦メッセージ送信してIDを取得
    const reply = await interaction.editReply({ embeds: [pages[0]], components: [] })
    const messageId = reply.id

    // 状態保存
    const paginationState: PaginatedDiceRoll = {
      pages,
      totalPages: pages.length,
      currentPage: 0,
      characterId: characterOption || undefined,
      messageId
    }
    this.diceRollPaginationService.savePaginationState(channelId, messageId, paginationState)

    // コントロール生成して更新
    const controls = await this.diceRollPaginationService.createPaginationControls(messageId, channelId, pages.length)

    await interaction.editReply({ embeds: [pages[0]], components: controls })
  }
}
