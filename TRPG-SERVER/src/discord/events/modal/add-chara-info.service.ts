import { Injectable } from '@nestjs/common'
import { CacheType, ChannelType, ModalBuilder, ModalSubmitInteraction, TextChannel } from 'discord.js'
import { discordModalType } from 'src/discord/discord.type'
import { eventSelectButtonType } from '../events.list'
import _, { isEmpty, isNull, isUndefined } from 'lodash'
import { convertCharacterInfoToJson, filterAndFormatInput } from 'src/discord/utils/convertToJSON'
import { DiscordIntegrationService } from '../../application/discord-integration.service'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AddCharaInfoService implements discordModalType {
  private _characterInfoConfig: eventSelectButtonType

  constructor(
    private readonly discordIntegration: DiscordIntegrationService,
    private readonly configService: ConfigService
  ) {}

  initialSetting(config: eventSelectButtonType) {
    this._characterInfoConfig = config
    return this
  }

  get data(): ModalBuilder {
    return new ModalBuilder().setCustomId(this._characterInfoConfig.customId).setTitle('キャラクター情報追加')
  }

  async execute(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    const channel = interaction.channel

    // Phase 3: 簡潔なイベント駆動パターン
    try {
      await interaction.deferUpdate()

      // 入力値の基本検証
      if (_.isNull(channel) || channel?.type !== ChannelType.GuildText) {
        console.error('Invalid channel')
        return
      }

      const regex = /status|skill|parameter/
      const inputValue = interaction.fields.components[0].components[0].value
      const updateField = interaction.fields.components[0].components[0].customId.match(regex)?.shift()

      if (_.isUndefined(updateField)) {
        console.error('Invalid update field')
        return
      }

      const formattedInput = filterAndFormatInput(inputValue)

      if (isEmpty(formattedInput)) {
        // エラーフィードバック - チャンネルの型チェックを安全に行う
        if (
          interaction.channel &&
          interaction.channel.type === ChannelType.GuildText &&
          'send' in interaction.channel
        ) {
          const errorMessage = await interaction.channel.send({
            content: '送信した値のフォーマットが不適切です'
          })
          setTimeout(() => errorMessage?.delete().catch(console.error), 5000)
        }
        return
      }

      // イベント駆動によるキャラクター更新リクエスト
      const updateData = {
        [updateField]: convertCharacterInfoToJson(formattedInput)
      }

      await this.discordIntegration.requestCharacterUpdate(channel.id, updateData, interaction.user.id)

      console.log(`[PHASE3] Character update requested for channel: ${channel.id}`)
    } catch (error) {
      console.error('Error in AddCharaInfoService:', error)

      // エラー時のフィードバック - チャンネルの型チェックを安全に行う
      if (interaction.channel && interaction.channel.type === ChannelType.GuildText && 'send' in interaction.channel) {
        const errorMessage = await interaction.channel.send({
          content: 'キャラクター情報の更新中にエラーが発生しました'
        })
        setTimeout(() => errorMessage?.delete().catch(console.error), 5000)
      }
    }
  }
}
