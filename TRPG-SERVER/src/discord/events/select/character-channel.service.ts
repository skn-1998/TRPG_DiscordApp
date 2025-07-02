import { Injectable } from '@nestjs/common'
import {
  ActionRowBuilder,
  AnySelectMenuInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  CommandInteraction,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
  ThreadChannel
} from 'discord.js'
import { discordSelectMenuType } from 'src/discord/discord.type'
import _, { isNull, isUndefined } from 'lodash'
import { CharacterService } from 'src/domains/character/character.service'
import { AppConfigService } from 'src/config/config.service'
import { Character } from 'src/domains/character/models/character.model'
import { CharacterAttribute } from 'src/domains/character/dto/create-character.dto'

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
    // Guildの存在チェック
    if (!interaction.guild) {
      await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます', ephemeral: true })
      return
    }

    const characterCategory = this.appConfigService.get('discord.characterCategory')
    const categoryNameStr = [characterCategory]
    const categoryChannel = interaction.guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && categoryNameStr.includes(channel.name)
    )
    if (_.isNil(categoryChannel)) {
      try {
        if (!interaction.replied) {
          await interaction.reply({ content: 'カテゴリが見つかりませんでした', ephemeral: true })
        }
      } catch (error) {
        console.error('応答エラー:', error)
      }
      return
    }

    try {
      const targetChannel = interaction.channel
      const characterChannelId = interaction.values[0]
      const character = await this.characterService.findByChannelId(characterChannelId)

      // キャラクターの存在チェック
      if (!character) {
        await interaction.reply({ content: 'キャラクター情報が見つかりませんでした', ephemeral: true })
        return
      }

      if (_.isNil(targetChannel) || !targetChannel.isTextBased()) {
        if (!interaction.replied) {
          await interaction.reply({ content: 'チャンネルが見つかりませんでした', ephemeral: true })
        }
        return
      }

      // チャンネルがTextChannelであることを確認
      if (targetChannel instanceof TextChannel) {
        // TextChannelとして処理を続行
        const thread = await targetChannel.threads.create({
          name: `${character.characterName}`,
          type: ChannelType.PublicThread
        })
        await this.postThreadCreationReply(interaction, thread, character)
        try {
          await this.deleteSelectMenu(interaction)
        } catch (deleteError) {
          console.error('セレクトメニュー削除エラー:', deleteError)
        }
      } else {
        if (!interaction.replied) {
          await interaction.reply({ content: 'テキストチャンネルを選択してください', ephemeral: true })
        }
        return
      }
    } catch (error) {
      console.error('スレッド作成エラー:', error)
      try {
        if (!interaction.replied) {
          await interaction.reply({ content: 'スレッド作成中にエラーが発生しました', ephemeral: true })
        } else if (interaction.isRepliable()) {
          await interaction.followUp({ content: 'スレッド作成中にエラーが発生しました', ephemeral: true })
        }
      } catch (replyError) {
        console.error('エラー応答に失敗:', replyError)
      }
    }
  }

  /**
   * キャラクターのスレッドを作成する
   * @param interaction コマンドインタラクション
   * @param character キャラクターデータ
   */
  async createCharacterThread(interaction: CommandInteraction, character: Character): Promise<void> {
    try {
      // Guildの存在確認
      if (!interaction.guild) {
        await interaction.reply({ content: 'このコマンドはサーバー内でのみ使用できます', ephemeral: true })
        return
      }

      // キャラクターのチャンネルIDを取得
      const channelId = character.discordChannelId
      if (!channelId) {
        await interaction.reply({ content: 'キャラクターにチャンネルが設定されていません', ephemeral: true })
        return
      }

      // チャンネルを取得
      const targetChannel = await interaction.guild.channels.fetch(channelId)
      if (_.isNil(targetChannel) || !(targetChannel instanceof TextChannel)) {
        await interaction.reply({ content: 'キャラクターのチャンネルが見つかりません', ephemeral: true })
        return
      }

      // スレッドを作成
      const thread = await targetChannel.threads.create({
        name: `${character.characterName}`,
        type: ChannelType.PublicThread
      })

      // 応答
      await interaction.reply({ content: `${character.characterName}のスレッドを作成しました`, ephemeral: true })

      // スレッドにキャラクター情報を投稿
      await this.postCharacterEmbeds(thread, character, interaction.user.displayName)
    } catch (error) {
      console.error('スレッド作成エラー:', error)
      await interaction.reply({ content: 'スレッドの作成中にエラーが発生しました', ephemeral: true })
    }
  }

  getAndSetChannelOption(interaction: CommandInteraction): StringSelectMenuBuilder {
    try {
      // Guildの存在確認
      if (!interaction.guild) {
        this.channelOptions = [
          new StringSelectMenuOptionBuilder().setLabel('サーバー情報が取得できません').setValue('no-guild')
        ]
        return this.data
      }

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

      if (textChannels.size === 0) {
        // チャンネルが見つからない場合は空のメニューを返す
        this.channelOptions = [
          new StringSelectMenuOptionBuilder().setLabel('チャンネルが見つかりません').setValue('no-channels')
        ]
      } else {
        // Discord制限：SelectMenuは最大25個のオプションまで
        // 最新の25個を取得する
        let channelsArray = Array.from(textChannels.values())

        // 作成日時順に並べ替え（新しいものが先頭）
        channelsArray = channelsArray.sort((a, b) => b.createdTimestamp - a.createdTimestamp)

        // 最大25個に制限
        channelsArray = channelsArray.slice(0, 25)

        this.channelOptions = channelsArray.map(
          (channel) => new StringSelectMenuOptionBuilder().setLabel(channel.name).setValue(String(channel.id)) // 必ず文字列として扱う
        )
      }

      return this.data
    } catch (error) {
      console.error('チャンネルオプション取得エラー:', error)
      // エラー時はデフォルトオプションを返す
      this.channelOptions = [new StringSelectMenuOptionBuilder().setLabel('エラーが発生しました').setValue('error')]
      return this.data
    }
  }

  async deleteSelectMenu(interaction: AnySelectMenuInteraction): Promise<void> {
    await interaction.deleteReply()
  }

  /**
   * キャラクター情報をEmbed形式でスレッドに投稿する
   * @param thread スレッド
   * @param character キャラクターデータ
   * @param playerName プレイヤー名
   */
  async postCharacterEmbeds(thread: ThreadChannel, character: Character, playerName: string): Promise<void> {
    try {
      // 基本情報Embed
      const baseInfoEmbed = new EmbedBuilder()
        .setTitle('【基本情報】')
        .setColor(0x0099ff)
        .addFields(
          { name: '名前', value: character.characterName || '未設定', inline: true },
          { name: '職業', value: character.description?.['職業']?.toString() || '未設定', inline: true },
          { name: 'システム', value: character.gameSystemId || '未設定', inline: true },
          { name: '年齢', value: character.description?.['年齢']?.toString() || '未設定', inline: true },
          { name: 'PL', value: playerName || '未設定', inline: true }
        )

      // ステータスの追加（HPなど）
      if (character.status && Object.keys(character.status).length > 0) {
        // HP, MP, SANの取得
        const hp = character.status['HP'] as CharacterAttribute
        const mp = character.status['MP'] as CharacterAttribute
        const san = character.status['SAN'] as CharacterAttribute

        if (hp) {
          baseInfoEmbed.addFields({ name: 'HP', value: `${hp.value}/${hp.value}`, inline: true })
        }
        if (mp) {
          baseInfoEmbed.addFields({ name: 'MP', value: `${mp.value}/${mp.value}`, inline: true })
        }
        if (san) {
          baseInfoEmbed.addFields({ name: 'SAN', value: `${san.value}/${san.value}`, inline: true })
        }
      }

      // パラメータEmbed
      const parameterEmbed = new EmbedBuilder().setTitle('【ステータス】').setColor(0x00cc99)

      // パラメータの追加
      if (character.parameter && Object.keys(character.parameter).length > 0) {
        const parameterItems = Object.entries(character.parameter).map(([name, value]) => ({
          name,
          value: value as CharacterAttribute
        }))

        // パラメータを4つずつのグループに分割して表示
        for (let i = 0; i < parameterItems.length; i += 4) {
          const group = parameterItems.slice(i, i + 4)
          const fields = group.map((param) => ({
            name: param.name,
            value: param.value.value.toString(),
            inline: true
          }))
          parameterEmbed.addFields(fields)
        }

        // 幸運、アイデア、知識などの追加パラメータを追加
        if (character.status['幸運']) {
          parameterEmbed.addFields({ name: '幸運', value: character.status['幸運'].toString(), inline: true })
        }
        if (character.status['アイデア']) {
          parameterEmbed.addFields({ name: 'アイデア', value: character.status['アイデア'].toString(), inline: true })
        }
        if (character.status['知識']) {
          parameterEmbed.addFields({ name: '知識', value: character.status['知識'].toString(), inline: true })
        }
      }

      // スキルEmbed
      const skillEmbed = new EmbedBuilder().setTitle('【スキル】(上位5件)').setColor(0xff6600)

      // スキルの追加（上位5件）
      if (character.skill && Object.keys(character.skill).length > 0) {
        const skillItems = Object.entries(character.skill)
          .map(([name, value]) => ({ name, value: value as CharacterAttribute }))
          .sort((a, b) => Number(b.value.value) - Number(a.value.value)) // 値が大きい順にソート
          .slice(0, 5) // 上位5件を取得

        // スキルフィールドを追加
        skillItems.forEach((skill) => {
          console.log(skill)

          skillEmbed.addFields({
            name: skill.name,
            value: `${skill.value.value}`,
            inline: true
          })
        })
      }

      // アイテムEmbed（あれば）
      let itemEmbed = null
      if (character.item && Object.keys(character.item).length > 0) {
        itemEmbed = new EmbedBuilder().setTitle('【アイテム】').setColor(0x9933cc)

        // アイテムの追加
        Object.entries(character.item).forEach(([name, value], index) => {
          if (index < 10) {
            // 最大10個まで表示
            itemEmbed.addFields({
              name: name,
              value: value?.toString() || '',
              inline: true
            })
          }
        })
      }

      // メモ・背景Embed
      let descriptionEmbed = null
      if (character.description && Object.keys(character.description).length > 0) {
        descriptionEmbed = new EmbedBuilder().setTitle('【メモ・背景】').setColor(0x999999)

        // 背景設定フィールドの追加
        if (character.description['背景']) {
          descriptionEmbed.addFields({
            name: '背景設定',
            value: character.description['背景'].toString().slice(0, 1024) // Discordの制限
          })
        }

        // その他のメモを追加
        const filteredDesc = Object.entries(character.description).filter(
          ([key]) => !['背景', '年齢', '職業'].includes(key)
        )

        if (filteredDesc.length > 0) {
          filteredDesc.forEach(([key, value]) => {
            descriptionEmbed.addFields({
              name: key,
              value: value?.toString().slice(0, 1024) || '',
              inline: true
            })
          })
        }
      }

      // 送信するEmbedを配列にまとめる
      const embeds = [baseInfoEmbed, parameterEmbed, skillEmbed]
      if (itemEmbed) embeds.push(itemEmbed)
      if (descriptionEmbed) embeds.push(descriptionEmbed)

      // 最初のメッセージ送信（基本情報、ステータス、スキル）
      await thread.send({ embeds: embeds.slice(0, 3) })

      // 残りのEmbedがあれば送信
      if (embeds.length > 3) {
        await thread.send({ embeds: embeds.slice(3) })
      }

      // ダイスロールボタンの作成
      await this.createDiceButtons(thread, character)
    } catch (error) {
      console.error('キャラクター情報表示エラー:', error)
      thread.send({ content: 'キャラクター情報の表示中にエラーが発生しました' })
    }
  }

  /**
   * ダイスロールボタンを作成してスレッドに投稿
   * @param thread スレッド
   * @param character キャラクターデータ
   */
  async createDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      if (character.discordUserId == null) return
      console.log(character.discordUserId)
      // const customId = `character-tab*${character.discordChannelId}*`
      // const basic = `character-tab*${character.discordChannelId}*basic`
      // const status = `character-tab*${character.discordChannelId}*status`
      // const skills = `character-tab*${character.discordChannelId}*skills`
      // const items = `character-tab*${character.discordChannelId}*items`
      // const desc = `character-tab*${character.discordChannelId}*desc`
      // カテゴリボタン（タブボタン）
      // const categoryButtons = new ActionRowBuilder<ButtonBuilder>()
      //   .addComponents(
      //     new ButtonBuilder()
      //       .setCustomId(basic)
      //       .setLabel('基本情報')
      //       .setStyle(ButtonStyle.Primary),
      //     new ButtonBuilder()
      //       .setCustomId(status)
      //       .setLabel('ステータス')
      //       .setStyle(ButtonStyle.Primary),
      //     new ButtonBuilder()
      //       .setCustomId(skills)
      //       .setLabel('スキル')
      //       .setStyle(ButtonStyle.Primary),
      //     new ButtonBuilder()
      //       .setCustomId(items)
      //       .setLabel('アイテム')
      //       .setStyle(ButtonStyle.Primary),
      //     new ButtonBuilder()
      //       .setCustomId(desc)
      //       .setLabel('背景設定')
      //       .setStyle(ButtonStyle.Primary)
      //   );

      // スキルロールボタン（上位5件のスキル）
      const skillButtons = new ActionRowBuilder<ButtonBuilder>()

      if (character.skill && Object.keys(character.skill).length > 0) {
        const skillItems = Object.entries(character.skill)
          .map(([name, value]) => ({ name, value: value as CharacterAttribute }))
          .sort((a, b) => Number(b.value.value) - Number(a.value.value)) // 値が大きい順にソート
          .slice(0, 5) // 上位5件を取得

        skillItems.forEach((skill, index) => {
          if (isNull(skill.value.value)) return
          if (index < 5) {
            // 最大5つま
            // でボタンを作成
            skillButtons.addComponents(
              new ButtonBuilder()
                .setCustomId(`roll*_${skill.name}-${skill.value.value}`)
                .setLabel(`${skill.name}(${skill.value.value}%)`)
                .setStyle(ButtonStyle.Secondary)
            )
          }
        })
      }

      // 能力値ロールボタン
      const abilityButtons = new ActionRowBuilder<ButtonBuilder>()

      const abilityItems = Object.entries(character.parameter)
        .map(([name, value]) => ({ name, value: value as CharacterAttribute }))
        .sort((a, b) => Number(b.value.name) - Number(a.value.value)) // 値が大きい順にソート
        .slice(0, 5) // 上位5件を取得

      abilityItems.forEach((ability) => {
        if (isNull(ability.value.value)) return
        abilityButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(`roll*_${ability.name}-${ability.value.value}`)
            .setLabel(`${ability.name}(${ability.value.value})`)
            .setStyle(ButtonStyle.Success)
        )
      })
      // 一般的なダイスロールボタン
      const diceButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('roll*1d100').setLabel('1D100').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('roll*1d20').setLabel('1D20').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('roll*1d6').setLabel('1D6').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('roll*2d6').setLabel('2D6').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('roll*custom').setLabel('カスタム').setStyle(ButtonStyle.Danger)
      )

      // ボタンをスレッドに投稿
      // await thread.send({
      //   content: '**操作メニュー**',
      //   components: [categoryButtons]
      // });

      await thread.send({
        content: '**技能ロール**',
        components: [skillButtons]
      })

      await thread.send({
        content: '**能力値ロール**',
        components: [abilityButtons]
      })

      await thread.send({
        content: '**ダイスロール**',
        components: [diceButtons]
      })
    } catch (error) {
      console.error('ダイスボタン作成エラー:', error)
      thread.send({ content: 'ダイスボタンの作成中にエラーが発生しました' })
    }
  }

  async postThreadCreationReply(
    interaction: AnySelectMenuInteraction,
    thread: ThreadChannel,
    character: Character
  ): Promise<void> {
    try {
      if (!interaction.replied) {
        await interaction.reply('キャラクターダイス用のスレッドを作成しました')
      }
      await thread.send(`Welcome to ${thread.name}`)

      // const character = await this.characterService.findByChannelId(channel.id);
      if (isUndefined(character)) {
        return
      }

      // 新しい表示方法を使用
      await this.postCharacterEmbeds(thread, character, interaction?.user?.displayName)
    } catch (error) {
      console.error('スレッド情報投稿エラー:', error)
      try {
        thread.send({ content: 'キャラクター情報の取得に失敗しました' })

        if (!interaction.replied && interaction.isRepliable()) {
          await interaction.reply({ content: 'キャラクター情報の取得に失敗しました', ephemeral: true })
        } else if (interaction.isRepliable()) {
          await interaction.followUp({ content: 'キャラクター情報の取得に失敗しました', ephemeral: true })
        }
      } catch (replyError) {
        console.error('エラー応答に失敗:', replyError)
      }
    }
  }
}
