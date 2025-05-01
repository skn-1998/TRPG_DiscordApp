import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, EmbedBuilder, ThreadChannel } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { CharacterService } from 'src/domains/character/character.service'
import { CharacterAttribute } from 'src/domains/character/dto/create-character.dto'

@Injectable()
export class CharacterTabButtonsService implements discordButtonType {
  constructor(private readonly characterService: CharacterService) {}

  // ButtonBuilderのインスタンスはdiscordButtonTypeのdataフィールドとして必要ですが、
  // 実際には動的に生成されるためここでは最小限のものを提供
  public data = new ButtonBuilder().setCustomId('character-tab*').setLabel('基本情報').setStyle(ButtonStyle.Primary)

  /**
   * ボタンが押されたときの処理
   */
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      // ボタンのカスタムIDを解析して、どのタブが選択されたかを特定
      const customId = interaction.customId
      const _temp = customId.replace('character-tab*', '')
      const channelId = _temp.split('*')[0]
      const tabType = _temp.split('*')[1]
      // スレッドチャンネルであることを確認
      if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
        await interaction.reply({ content: 'このコマンドはスレッド内でのみ使用できます', ephemeral: true })
        return
      }

      const character = await this.characterService.findByChannelId(channelId)

      // 応答中であることを示す
      await interaction.deferReply()

      // タブに応じたEmbedを生成
      let embed: EmbedBuilder

      switch (tabType) {
        case 'basic':
          // 基本情報Embed
          embed = new EmbedBuilder()
            .setTitle('【基本情報】')
            .setColor(0x0099ff)
            .addFields(
              { name: '名前', value: character.characterName || '未設定', inline: true },
              { name: '職業', value: character.description?.['職業']?.toString() || '未設定', inline: true },
              { name: 'システム', value: character.TRPGId || '未設定', inline: true },
              { name: '年齢', value: character.description?.['年齢']?.toString() || '未設定', inline: true }
            )

          // ステータスの追加（HPなど）
          if (character.status && Object.keys(character.status).length > 0) {
            // HP, MP, SANの取得
            const hp = character.status['HP']
            const mp = character.status['MP']
            const san = character.status['SAN']

            if (hp) {
              embed.addFields({ name: 'HP', value: `${hp}/${hp}`, inline: true })
            }
            if (mp) {
              embed.addFields({ name: 'MP', value: `${mp}/${mp}`, inline: true })
            }
            if (san) {
              embed.addFields({ name: 'SAN', value: `${san}/${san}`, inline: true })
            }
          }
          break

        case 'status':
          // パラメータEmbed
          embed = new EmbedBuilder().setTitle('【ステータス】').setColor(0x00cc99)

          // パラメータの追加
          if (character.parameter && Object.keys(character.parameter).length > 0) {
            const parameterItems = Object.entries(character.parameter).map(([name, value]) => ({ name, value }))

            // パラメータを4つずつのグループに分割して表示
            for (let i = 0; i < parameterItems.length; i += 4) {
              const group = parameterItems.slice(i, i + 4)
              const fields = group.map((param) => ({
                name: param.name,
                value: param.value.toString(),
                inline: true
              }))
              embed.addFields(fields)
            }

            // 幸運、アイデア、知識などの追加パラメータを追加
            if (character.status['幸運']) {
              embed.addFields({ name: '幸運', value: character.status['幸運'].toString(), inline: true })
            }
            if (character.status['アイデア']) {
              embed.addFields({ name: 'アイデア', value: character.status['アイデア'].toString(), inline: true })
            }
            if (character.status['知識']) {
              embed.addFields({ name: '知識', value: character.status['知識'].toString(), inline: true })
            }
          }
          break

        case 'skills':
          // スキルEmbed
          embed = new EmbedBuilder().setTitle('【スキル】').setColor(0xff6600)

          // スキルの追加
          if (character.skill && Object.keys(character.skill).length > 0) {
            const skillItems = Object.entries(character.skill)
              .map(([name, value]) => ({ name, value: value as CharacterAttribute }))
              .sort((a, b) => Number(b.value.value) - Number(a.value.value)) // 値が大きい順にソート

            // スキルを6つずつのグループに分割して表示
            for (let i = 0; i < skillItems.length; i += 6) {
              const group = skillItems.slice(i, i + 6)
              const fields = group.map((skill) => ({
                name: skill.name,
                value: skill.value.value.toString(),
                inline: true
              }))
              embed.addFields(fields)
            }
          }
          break

        case 'items':
          // アイテムEmbed
          embed = new EmbedBuilder().setTitle('【アイテム】').setColor(0x9933cc)

          // アイテムの追加
          if (character.item && Object.keys(character.item).length > 0) {
            const itemEntries = Object.entries(character.item)

            // アイテムを追加
            for (let i = 0; i < itemEntries.length; i++) {
              const [name, value] = itemEntries[i]
              embed.addFields({
                name,
                value: value?.toString() || '',
                inline: true
              })
            }
          } else {
            embed.setDescription('アイテムはありません')
          }
          break

        case 'desc':
          // メモ・背景Embed
          embed = new EmbedBuilder().setTitle('【メモ・背景】').setColor(0x999999)

          // 背景設定フィールドの追加
          if (character.description && Object.keys(character.description).length > 0) {
            if (character.description['背景']) {
              embed.addFields({
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
                embed.addFields({
                  name: key,
                  value: value?.toString().slice(0, 1024) || '',
                  inline: true
                })
              })
            }
          } else {
            embed.setDescription('メモはありません')
          }
          break

        default:
          // デフォルトは基本情報
          embed = new EmbedBuilder()
            .setTitle('【情報】')
            .setDescription('選択したタブの情報が見つかりませんでした')
            .setColor(0xff0000)
          break
      }

      // Embedを送信
      await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      console.error('タブボタン処理エラー:', error)

      // エラーが発生した場合、通知
      if (interaction.deferred) {
        await interaction.editReply({ content: 'エラーが発生しました。もう一度お試しください。' })
      } else {
        await interaction.reply({ content: 'エラーが発生しました。もう一度お試しください。', ephemeral: true })
      }
    }
  }
}
