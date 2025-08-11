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
import { characterEditIds } from './events/character-edit.ids'
import type { eventSelectButtonType } from '../../events/events.list'
import { AddCharaInfoService } from './add-chara-info.service'

@Injectable()
export class ChangeCharaInfoService implements discordSelectMenuType {
  constructor(private readonly addCharaInfoService: AddCharaInfoService) {}

  public data = new StringSelectMenuBuilder()
    .setCustomId(characterEditIds.changeCharacterInfo.customId)
    .setPlaceholder(characterEditIds.changeCharacterInfo.placeholder)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('ステータス').setValue('status'),
      new StringSelectMenuOptionBuilder().setLabel('パラメータ').setValue('parameter'),
      new StringSelectMenuOptionBuilder().setLabel('スキル').setValue('skill')
    )
  async execute(interaction: AnySelectMenuInteraction, characterInfoConfig?: eventSelectButtonType): Promise<void> {
    try {
      // Use the provided config or fallback to the default one
      const config =
        characterInfoConfig ||
        ({
          customId: characterEditIds.changeCharacterInfo.customId,
          placeholder: characterEditIds.changeCharacterInfo.placeholder,
          label: characterEditIds.changeCharacterInfo.label
        } as eventSelectButtonType)

      const modal = this.addCharaInfoService.initialSetting(config).data
      const inputCharacterInfo = new TextInputBuilder()
        .setCustomId(`${interaction.customId}-${interaction.values[0]}`)
        .setStyle(TextInputStyle.Paragraph)
        .setLabel('例のように入力')
        .setPlaceholder('HP:13\nMP:30')

      if (characterEditIds.changeCharacterInfo.customId.includes(interaction.customId)) {
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
