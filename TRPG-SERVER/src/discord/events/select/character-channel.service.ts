import { Injectable } from '@nestjs/common'
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  CacheType,
  Channel,
  Collection,
  CommandInteraction,
  GuildBasedChannel,
  SelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  ThreadChannel
} from 'discord.js'
import { isNull, isUndefined, sortBy } from 'lodash'
import { getChannelIdByName } from '../../utils/searchChannelID'
import { selectCharacterChannelConfig } from '../events.list'
// import { getCharacter } from '../../DB/characterRepository'
import { discordSelectMenuType } from 'src/discord/discord.type'
@Injectable()
export class CharacterChannelService implements discordSelectMenuType {
  channelOptions: StringSelectMenuOptionBuilder[]
  get data(): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder()
      .setCustomId(selectCharacterChannelConfig.customId)
      .setPlaceholder(selectCharacterChannelConfig.placeholder)
      .addOptions(this.channelOptions)
  }

  async execute(interaction: AnySelectMenuInteraction): Promise<void> {
    const channel = await interaction.guild?.channels.cache.get(
      interaction.values[0]
    )
    if (isUndefined(channel)) return
    if (isNull(channel.name)) throw new Error('Channel is null')
    if (!(interaction.channel instanceof TextChannel))
      throw new Error('interaction.channel is null')
    const thread = await interaction.channel.threads.create({
      name: channel.name
    })
    await this.deleteSelectMenu(interaction)
    postThreadCreationReply(interaction, thread, channel)
  }
  getAndSetChannelOption(
    interaction: CommandInteraction
  ): StringSelectMenuBuilder {
    if (isNull(interaction.guild)) throw new Error('guild is null')
    const categoryId = getChannelIdByName(interaction.guild, 'キャラクター')
    const channels = interaction.guild.channels.cache.filter(
      channel => channel.parentId === categoryId
    )
    const channelOptions = channels.map(channel => {
      return new StringSelectMenuOptionBuilder()
        .setLabel(channel.name)
        .setValue(channel.id)
    })
    this.channelOptions = channelOptions
    return this.data
  }
  async deleteSelectMenu(interaction: AnySelectMenuInteraction): Promise<void> {
    try {
      const message = interaction.message
      if (message.deletable) {
        await message.delete()
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('メッセージ削除中にエラー', error)
    }
  }
}

async function postThreadCreationReply(
  interaction: AnySelectMenuInteraction,
  thread: ThreadChannel,
  channel: GuildBasedChannel
): Promise<void> {
  await interaction.reply('キャラクターダイス用のスレッドを作成しました')
  // await thread.send(`Welcome to ${thread.name}`)
  // const character = await (getCharacter(channel.id))
  // if(isUndefined(character)){
  //   return
  // }
  // thread.send({content:"## 名前:" + character.name})
  thread.send({ content: '## PL:' + interaction?.user?.displayName })
  // thread.send({content:"### *◆ステータス*"})
  // sortBy(character.status,[(status)=>{return status.index}]).forEach(status=>{
  //   thread.send({content:status.name + ":" + status.value})
  // })
  // thread.send({content:"### *◆パラメータ*"})
  // sortBy(character.parameter,[(parameter)=>{return parameter.index}]).forEach(parameter=>{
  //   thread.send({content:parameter.name + ":" + parameter.value})
  // })
  // thread.send({content:"### *◆スキル*"})
  // sortBy(character.skill,[(skill)=>{return skill.index}]).forEach(skill=>{
  //   thread.send({content:skill.name + ":" + skill.value})
  // })

  // thread.send({components:[createDiceButtonRow()]})
}
