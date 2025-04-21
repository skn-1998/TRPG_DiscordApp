import { Injectable } from '@nestjs/common'
import { CacheType, ChannelType, EmbedBuilder, Message, ModalBuilder, ModalSubmitInteraction } from 'discord.js'
import { discordModalType } from 'src/discord/discord.type'
import { eventSelectButtonType } from '../events.list'
import _, { isEmpty, isNull, isUndefined } from 'lodash'
import { convertCharacterInfoToJson, convertCharacterJsonToString, filterAndFormatInput } from 'src/discord/utils/convertToJSON'
import { CharacterService } from 'src/domains/character/character.service'

@Injectable()
export class AddCharaInfoService implements discordModalType {
  private _characterInfoConfig: eventSelectButtonType
  
  constructor(
    private readonly characterService: CharacterService
  ) {}
  
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
    console.log(channel.id)
    await this.characterService.updateByChannelId(
      channel.id,
      {[updatePrimary]:convertCharacterInfoToJson(createCharaInfo)},
    )
    console.log(await this.characterService.findByChannelId(channel.id))
    if (isNull(interaction.channelId)) return
    const characterInfo = await this.characterService.findByChannelId(channel.id)
    if (isUndefined(characterInfo)) return
    console.log(  convertCharacterJsonToString(characterInfo, 'status'))
    const characterInfoText = [
      convertCharacterJsonToString(characterInfo, 'status'),
      convertCharacterJsonToString(characterInfo, 'parameter'),
      convertCharacterJsonToString(characterInfo, 'skill')
    ].join('\n')
    const embed = new EmbedBuilder()
      .setTitle(channel.name)
      .setDescription(characterInfoText)

    // チャンネル内のメッセージを取得（最新100件）
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      
      // ボットが送信した埋め込みメッセージを検索
      const botEmbedMessages = messages
        .filter(msg => 
          msg.author.bot && 
          msg.embeds.length > 0 && 
          msg.embeds[0].title === channel.name
        )
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp); // 新しい順にソート
      
      const latestEmbedMessage = botEmbedMessages.first();
      
      if (latestEmbedMessage && latestEmbedMessage.editable) {
        // 既存のメッセージを編集
        await latestEmbedMessage.edit({ embeds: [embed] });
      } else {
        // 既存のメッセージがないか編集できない場合は新しいメッセージを送信
        await interaction.channel?.send({ embeds: [embed] });
      }
    } catch (error) {
      console.error('メッセージの検索または編集中にエラーが発生しました:', error);
      // エラーの場合は新しいメッセージを送信
      await interaction.channel?.send({ embeds: [embed] });
    }
  }
}


