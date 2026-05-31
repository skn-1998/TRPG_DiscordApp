import { Injectable, Logger } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ThreadChannel } from 'discord.js'
import { discordButtonType } from '../../discord.type'
import { TypedEventService } from '../../../core/events/typed-event.service'
import { CharacterDisplayService, TabType } from './services'
import { ErrorHandler, ErrorContext } from '../../../utils/error-handler'

@Injectable()
export class CharacterTabButtonsService implements discordButtonType {
  private readonly logger = new Logger(CharacterTabButtonsService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly characterDisplayService: CharacterDisplayService
  ) {}

  public data = new ButtonBuilder().setCustomId('character-tab*').setLabel('基本情報').setStyle(ButtonStyle.Primary)

  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      if (!interaction.isButton()) return

      const _temp = interaction.customId.replace('character-tab*', '')
      const channelId = _temp.split('*')[0]
      const tabType = _temp.split('*')[1] || 'basic'

      // スレッドチャンネルであることを確認
      if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
        await interaction.reply({ content: 'このコマンドはスレッド内でのみ使用できます', ephemeral: true })
        return
      }

      // 応答中であることを示す
      await interaction.deferReply()

      this.logger.log(`キャラクタータブ情報取得開始: channelId=${channelId}, tabType=${tabType}`)

      // CharacterDisplayServiceを使用してEmbedを作成
      const embed = await this.characterDisplayService.createCharacterEmbed(
        channelId,
        this.characterDisplayService.isValidTabType(tabType) ? tabType : 'basic'
      )

      if (embed) {
        await interaction.editReply({ embeds: [embed] })
        this.logger.log(`キャラクタータブ表示完了: channelId=${channelId}, tabType=${tabType}`)
      } else {
        await interaction.editReply({ content: 'キャラクター情報が見つかりませんでした。' })
        this.logger.warn(`キャラクター検索失敗: channelId=${channelId}`)
      }
    } catch (error) {
      const context: ErrorContext = {
        channelId: interaction.channel?.id,
        action: 'character-tab-display'
      }

      await ErrorHandler.handleDiscordError(
        error,
        interaction,
        context,
        '⚠️ キャラクター情報の表示中にエラーが発生しました。'
      )
    }
  }
}
