import { Injectable } from '@nestjs/common'
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  CommandInteraction,
  GuildBasedChannel,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  ThreadChannel
} from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import _, { isUndefined, sortBy } from 'lodash'
import { CharacterService } from 'src/domains/character/character.service'
import { AppConfigService } from 'src/config/config.service'

@Injectable()
export class CharacterChannelService implements discordSelectMenuType {
  channelOptions: StringSelectMenuOptionBuilder[]

  constructor(
    private readonly characterService: CharacterService,
    private readonly appConfigService: AppConfigService
  ) {
    // Initialize with default empty array to prevent 'not iterable' error
    this.channelOptions = [new StringSelectMenuOptionBuilder().setLabel('デフォルト').setValue('default')]
  }

  get data(): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder()
      .setCustomId('thread-create-character')
      .setPlaceholder('キャラクターを選択')
      .addOptions(...this.channelOptions)
  }

  async execute(interaction: AnySelectMenuInteraction): Promise<void> {
    const characterCategory = this.appConfigService.get('discord.characterCategory')
    const categoryNameStr = [characterCategory]
    const categoryChannel = interaction.guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && categoryNameStr.includes(channel.name)
    )
    if (_.isNil(categoryChannel)) return

    try {
      const targetChannel = await interaction.guild.channels.fetch(interaction.values[0])
      if (_.isNil(targetChannel) || !targetChannel.isTextBased()) return

      // チャンネルがTextChannelであることを確認
      if (targetChannel instanceof TextChannel) {
        // TextChannelとして処理を続行
        const thread = await targetChannel.threads.create({
          name: `${targetChannel.name}の部屋`,
          type: ChannelType.PublicThread
        })
        await postThreadCreationReply(interaction, thread, targetChannel)
        await this.deleteSelectMenu(interaction)
      } else {
        await interaction.reply({ content: 'テキストチャンネルを選択してください', ephemeral: true })
        return
      }
    } catch (error) {
      console.error(error)
    }
  }

  getAndSetChannelOption(interaction: CommandInteraction): StringSelectMenuBuilder {
    const characterCategory = this.appConfigService.get('discord.characterCategory')
    const categoryNameStr = [characterCategory]
    // カテゴリーチャンネルを取得
    const categoryChannel = interaction.guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && categoryNameStr.includes(channel.name)
    )
    if (_.isNil(categoryChannel)) {
      // カテゴリが見つからない場合は空のメニューを返す
      this.channelOptions = [
        new StringSelectMenuOptionBuilder().setLabel('カテゴリが見つかりません').setValue('no-category')
      ]
      return this.data
    }

    // カテゴリーチャンネル内のテキストチャンネルを取得
    const textChannels = interaction.guild.channels.cache.filter(
      (channel) => channel.type === ChannelType.GuildText && channel.parentId === categoryChannel.id
    )

    this.channelOptions = textChannels.map((channel) =>
      new StringSelectMenuOptionBuilder().setLabel(channel.name).setValue(channel.id)
    )

    if (_.isEmpty(this.channelOptions)) {
      // チャンネルが見つからない場合は空のメニューを返す
      this.channelOptions = [
        new StringSelectMenuOptionBuilder().setLabel('チャンネルが見つかりません').setValue('no-channels')
      ]
    }
    return this.data
  }

  async deleteSelectMenu(interaction: AnySelectMenuInteraction): Promise<void> {
    await interaction.deleteReply()
  }
}

async function postThreadCreationReply(
  interaction: AnySelectMenuInteraction,
  thread: ThreadChannel,
  channel: GuildBasedChannel
): Promise<void> {
  const characterService = interaction.client['characterService'] as CharacterService

  await interaction.reply('キャラクターダイス用のスレッドを作成しました')
  await thread.send(`Welcome to ${thread.name}`)

  try {
    const character = await characterService.findOne(channel.id)
    if (isUndefined(character)) {
      return
    }

    thread.send({ content: '## 名前:' + character.characterName })
    thread.send({ content: '## PL:' + interaction?.user?.displayName })
    thread.send({ content: '### *◆ステータス*' })

    if (character.status) {
      const statusItems = Object.entries(character.status).map(([name, value], index) => ({ name, value, index }))
      sortBy(statusItems, [(status) => status.index]).forEach((status) => {
        thread.send({ content: status.name + ':' + status.value })
      })
    }

    thread.send({ content: '### *◆パラメータ*' })
    if (character.parameter) {
      const parameterItems = Object.entries(character.parameter).map(([name, value], index) => ({ name, value, index }))
      sortBy(parameterItems, [(parameter) => parameter.index]).forEach((parameter) => {
        thread.send({ content: parameter.name + ':' + parameter.value })
      })
    }

    thread.send({ content: '### *◆スキル*' })
    if (character.skill) {
      const skillItems = Object.entries(character.skill).map(([name, value], index) => ({ name, value, index }))
      sortBy(skillItems, [(skill) => skill.index]).forEach((skill) => {
        thread.send({ content: skill.name + ':' + skill.value })
      })
    }
  } catch (error) {
    console.error('キャラクター情報取得エラー:', error)
    thread.send({ content: 'キャラクター情報の取得に失敗しました' })
  }

  // thread.send({components:[createDiceButtonRow()]})
}
