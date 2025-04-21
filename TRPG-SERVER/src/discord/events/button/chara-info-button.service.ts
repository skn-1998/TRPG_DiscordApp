import { Injectable } from '@nestjs/common'
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  StringSelectMenuBuilder,
  TextChannel
} from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import {
  addCharacterInfoConfig,
  changeCharacterInfoConfig,
  eventSelectButtonType
} from '../events.list'
import { ChangeCharaInfoService } from '../select/change-chara-info.service'

@Injectable()
export class CharaInfoButtonService implements discordButtonType {
  constructor(
    private readonly changeCharaInfoService: ChangeCharaInfoService
  ) {}

  initialSetting(config: eventSelectButtonType, buttonStyle: ButtonStyle) {
    this._buttonConfig = config
    this._buttonStyle = buttonStyle
    return this
  }
  private _buttonStyle: ButtonStyle
  private _buttonConfig: eventSelectButtonType
  get data(): ButtonBuilder {
    return new ButtonBuilder()
      .setCustomId(this._buttonConfig.customId)
      .setLabel(this._buttonConfig.label)
      .setStyle(this._buttonStyle)
  }
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      const select = this.changeCharaInfoService.data
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        select
      )
      
      // deferUpdateの代わりにupdateで直接応答する
      await interaction.update({ content: '選択してください', components: [row] })
    } catch (error) {
      console.error('ボタン処理中にエラーが発生しました:', error)
      // エラーが発生した場合、まだ応答していなければエラーメッセージを表示
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ 
          content: 'エラーが発生しました。もう一度試してください。', 
          ephemeral: true 
        })
      }
    }
  }

  async createButton(channel: TextChannel): Promise<void> {
    const addCharacterInfoButtonBuilder = new ButtonBuilder()
      .setCustomId(addCharacterInfoConfig.customId)
      .setLabel(addCharacterInfoConfig.label)
      .setStyle(ButtonStyle.Primary)
    
    const changeCharacterInfoButtonBuilder = new ButtonBuilder()
      .setCustomId(changeCharacterInfoConfig.customId)
      .setLabel(changeCharacterInfoConfig.label)
      .setStyle(ButtonStyle.Secondary)
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents([
      addCharacterInfoButtonBuilder,
      changeCharacterInfoButtonBuilder
    ])

    await channel.send({ components: [row] })
  }
}
