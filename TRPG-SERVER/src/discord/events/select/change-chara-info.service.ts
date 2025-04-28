import { Injectable } from '@nestjs/common'
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import { changeCharacterInfoConfig, eventSelectButtonType } from '../events.list'
import { AddCharaInfoService } from '../modal/add-chara-info.service'

@Injectable()
export class ChangeCharaInfoService implements discordSelectMenuType {
  constructor(private readonly addCharaInfoService: AddCharaInfoService) {}

  public data = new StringSelectMenuBuilder()
    .setCustomId(changeCharacterInfoConfig.customId)
    .setPlaceholder(changeCharacterInfoConfig.placeholder)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('ステータス').setValue('status'),
      new StringSelectMenuOptionBuilder().setLabel('パラメータ').setValue('parameter'),
      new StringSelectMenuOptionBuilder().setLabel('スキル').setValue('skill')
    )
  async execute(interaction: AnySelectMenuInteraction, characterInfoConfig?: eventSelectButtonType): Promise<void> {
    try {
      // Use the provided config or fallback to the default one
      const config = characterInfoConfig || changeCharacterInfoConfig

      const modal = this.addCharaInfoService.initialSetting(config).data
      const inputCharacterInfo = new TextInputBuilder()
        .setCustomId(`${interaction.customId}-${interaction.values[0]}`)
        .setStyle(TextInputStyle.Paragraph)
        .setLabel('例のように入力')
        .setPlaceholder('HP:13\nMP:30')

      if (changeCharacterInfoConfig.customId.includes(interaction.customId)) {
        // const characterInfo = await getCharacter(interaction.channelId)
        // if(isUndefined(characterInfo)) return
        // inputCharacterInfo.setValue(convertCharacterJsonToString(characterInfo,interaction.values[0] as updatePrimary))
      }

      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(inputCharacterInfo)

      // 応答があればdeleteReplyを試みる（オプショナルチェイニングで安全に）
      if (interaction.replied) {
        await interaction.deleteReply?.()
      }

      modal.addComponents(firstActionRow)
      await interaction.showModal(modal)
    } catch (error) {
      console.error('セレクトメニュー処理中にエラーが発生しました:', error)
      // エラーが発生した場合、まだ応答していなければエラーメッセージを表示
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'エラーが発生しました。もう一度試してください。',
          ephemeral: true
        })
      }
    }
  }
}
