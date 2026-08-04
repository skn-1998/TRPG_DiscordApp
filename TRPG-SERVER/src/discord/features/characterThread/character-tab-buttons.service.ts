import { Injectable, Logger } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, ThreadChannel, MessageFlags } from 'discord.js'
import { discordButtonType } from '../../discord.type'
import { CHARACTER_TAB_CUSTOM_ID_PATTERN } from './custom-id'
import { CharacterDisplayService } from './services'
import { ErrorContext } from '../../../core/http/error-handler'
import { DiscordErrorReporter } from '../../utils/discord-error-reporter'

@Injectable()
export class CharacterTabButtonsService implements discordButtonType {
  private readonly logger = new Logger(CharacterTabButtonsService.name)

  constructor(private readonly characterDisplayService: CharacterDisplayService) {}

  public data = new ButtonBuilder()
    .setCustomId(CHARACTER_TAB_CUSTOM_ID_PATTERN)
    .setLabel('基本情報')
    .setStyle(ButtonStyle.Primary)

  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      if (!interaction.isButton()) return

      const _temp = interaction.customId.replace(CHARACTER_TAB_CUSTOM_ID_PATTERN, '')
      const channelId = _temp.split('*')[0]
      const tabType = _temp.split('*')[1] || 'basic'

      // スレッドチャンネルであることを確認
      if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
        await interaction.reply({
          content: 'このコマンドはスレッド内でのみ使用できます',
          flags: MessageFlags.Ephemeral
        })
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

      await DiscordErrorReporter.handleDiscordError(
        error,
        interaction,
        context,
        '⚠️ キャラクター情報の表示中にエラーが発生しました。'
      )
    }
  }
}
