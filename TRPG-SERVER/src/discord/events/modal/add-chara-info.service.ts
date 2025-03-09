import { Injectable } from '@nestjs/common'
import { CacheType, ChannelType, EmbedBuilder, ModalBuilder, ModalSubmitInteraction } from 'discord.js'
import { discordModalType } from 'src/discord/discord.type'
import { eventSelectButtonType } from '../events.list'
import _, { initial, isEmpty, isNull, isUndefined } from 'lodash'
import { convertCharacterInfoToJson, convertCharacterJsonToString, filterAndFormatInput } from 'src/discord/utils/convertToJSON'
import { CharacterService } from 'src/DB/character/character.service'
import { UpdatePrimary } from 'src/DB/character/models/character.model'

@Injectable()
export class AddCharaInfoService implements discordModalType {
  private _characterInfoConfig: eventSelectButtonType
  constructor() {
    
  }
  initialSetting(config: eventSelectButtonType) {
    this._characterInfoConfig = config
    return this
  }
  get data(): ModalBuilder {
    return new ModalBuilder()
      .setCustomId(this._characterInfoConfig.customId)
      .setTitle('キャラクター情報追加')
  }
  async execute(interaction: ModalSubmitInteraction<CacheType>): Promise<void> {
    const channel = interaction.channel
    const characterService = new CharacterService();

    await interaction.deferUpdate()
    const regex = /status|skill|parameter/
    const createCharaInfo = filterAndFormatInput(
      interaction.fields.components[0].components[0].value
    )
    const updatePrimary =
      interaction.fields.components[0].components[0].customId
        .match(regex)
        ?.shift()
    console.log(
      interaction.fields.components[0].components[0].customId.match(regex)
    )
    if (_.isUndefined(updatePrimary))
      return console.error('updatePrimary isUndefined')

    // console.log(createCharaInfo)
    if (_.isNull(channel)) return console.error('channel is null')

    if (isEmpty(createCharaInfo)) {
      const sendErrMessage = await interaction.channel?.send({
        content: '送信した値のフォーマットが不適切です'
      })

      setTimeout(() => {
        if (!sendErrMessage?.deletable) return
        sendErrMessage?.delete().catch(console.error)
      }, 5000)
      return
    }
    if (channel?.type !== ChannelType.GuildText) return console.log('')
    await characterService.update(
      channel.id,
      convertCharacterInfoToJson(createCharaInfo),
    )
    console.log(await characterService.findOne(channel.id))
    if (isNull(interaction.channelId)) return
    const characterInfo = await characterService.findOne(interaction.id)
    if (isUndefined(characterInfo)) return
    const characterInfoText = [
      convertCharacterJsonToString(characterInfo, 'status'),
      convertCharacterJsonToString(characterInfo, 'parameter'),
      convertCharacterJsonToString(characterInfo, 'skill')
    ].join('/n')
    const embed = new EmbedBuilder()
      .setTitle(channel.name)
      .setDescription(characterInfoText)
    if (characterInfo.messageID) {
      const message = await channel.messages.fetch(characterInfo.messageID)
      if (message.editable) {
        message.edit({ embeds: [embed] })
      } else {
      }
    } else {
      await interaction.channel?.send({ embeds: [embed] })
    }
  }
}


