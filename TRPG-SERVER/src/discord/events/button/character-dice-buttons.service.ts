import { Injectable } from '@nestjs/common'
import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  CacheType,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ColorResolvable,
  Colors,
  TextChannel
} from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { CharacterService } from 'src/domains/character/character.service'
import { isNull } from 'lodash'
import dice from 'src/discord/utils/dice'

@Injectable()
export class CharacterDiceButtonsService implements discordButtonType {
  constructor(private readonly characterService: CharacterService) {}

  // ButtonBuilderのインスタンスはdiscordButtonTypeのdataフィールドとして必要ですが、
  // 実際には動的に生成されるためここでは最小限のものを提供
  public data = new ButtonBuilder().setCustomId('roll-1d100').setLabel('1D100').setStyle(ButtonStyle.Danger)

  /**
   * ボタンが押されたときの処理
   */
  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      // ボタンのカスタムIDを解析して、どのダイスロールが選択されたかを特定
      const customId = interaction.customId

      // カスタムダイスロールの場合
      if (customId === 'roll*custom') {
        await this.handleCustomDiceRoll(interaction)
        return
      }

      // 通常のスキルロールまたはダイスロールの処理
      const rollInfo = customId.replace('roll*', '')

      // diceRollのフォーマットを判断
      let diceCommand: string
      let skillName: string | null = null
      let skillValue: number | null = null

      // スキルロールか通常のダイスロールかを判断
      if (rollInfo.includes('_')) {
        // スキルロール
        skillName = rollInfo.replace('_', '').split('-')[0]
        skillValue = Number(rollInfo.replace('_', '').split('-')[1])
        diceCommand = '1d100' + '<' + skillValue
        console.log(diceCommand)
      } else {
        diceCommand = rollInfo
      }

      // ダイスロールを実行
      const diceResult = await dice(diceCommand, 'Cthulhu')
      if (isNull(diceResult)) {
        await interaction.reply({ content: 'ダイスロールに失敗しました', ephemeral: true })
        return
      }

      // スキルロールの場合は成功/失敗判定を行う
      // const resultMessage = diceResult.text || `${diceCommand}の結果: 不明`
      const result = diceResult.rands.reduce((acc, curr) => acc + curr[0], 0)
      // ダイス目を数値として抽出

      const rollValue = result
      if (rollValue > 0) {
        let embedColor: ColorResolvable
        if (diceResult.critical || result < 5) {
          embedColor = Colors.Gold // ゴールド
        } else if (diceResult.fumble || result > 95) {
          embedColor = Colors.Purple // 紫
        } else if (diceResult.success) {
          embedColor = Colors.Green // 緑
        } else if (diceResult.failure) {
          embedColor = Colors.Red // 赤
        } else {
          embedColor = '#808080' // グレー
        }

        const characterName = interaction.channel.name
        // Embedを作成
        const embed = new EmbedBuilder()
          .setColor(embedColor)
          .setDescription(`${characterName}:${skillName}:${diceResult.text}`)

        // スレッドのチャンネルタイプ確認
        if (interaction.channel?.type === ChannelType.PublicThread) {
          // 親チャンネルにもメッセージを送信
          const parentChannelId = interaction.channel.parentId
          if (parentChannelId) {
            const parentChannel = (await interaction.client.channels.fetch(parentChannelId)) as TextChannel
            if (parentChannel && parentChannel.isTextBased()) {
              console.log(parentChannel)
              const topic = parentChannel.topic
              if (topic.includes('embedId')) {
                const embedIdLine = /^.*embedId:\d+.*$/m.exec(topic)[0] || ''
                const embedId = embedIdLine.split(':')[1]
                const textMessage = await parentChannel.messages.fetch(embedId)
                if (textMessage && textMessage.embeds.length > 0) {
                  // 現在のエンベッドを取得
                  const currentEmbed = textMessage.embeds[0]

                  // 現在の説明文を取得（nullの場合は空文字列で初期化）
                  const currentDescription = currentEmbed.description || ''

                  // 新しいコンテンツを追加（最後に改行して追加）
                  const newDescription =
                    currentDescription +
                    (currentDescription ? '\n' : '') + // 既存の内容がある場合のみ改行を追加
                    `+${characterName}:${skillName}:${diceResult.text}`

                  // 新しい説明文でエンベッドを更新
                  const updatedEmbed = new EmbedBuilder(currentEmbed.data).setDescription(newDescription)
                  await textMessage.edit({ embeds: [updatedEmbed] })
                } else {
                  await parentChannel.send({ embeds: [embed] })
                }
              } else {
                const textMessage = await parentChannel.send({ embeds: [embed] })
                await parentChannel.setTopic(`${topic}\nembedId:${textMessage.id}`)
              }
            }
          }
        }

        // ボタンの応答を完了させる
        await interaction.deferUpdate()
        return
      }
    } catch (error) {
      console.error('ダイスボタン処理エラー:', error)

      // エラーが発生した場合、通知
      await interaction.reply({ content: 'エラーが発生しました。もう一度お試しください。', ephemeral: true })
    }
  }

  /**
   * カスタムダイスロールのモーダルを表示
   */
  private async handleCustomDiceRoll(interaction: ButtonInteraction): Promise<void> {
    try {
      // モーダルを作成
      const modal = new ModalBuilder().setCustomId('custom-dice-modal').setTitle('カスタムダイスロール')

      // ダイスコマンド入力フィールド
      const diceCommandInput = new TextInputBuilder()
        .setCustomId('dice-command')
        .setLabel('ダイスコマンド（例: 2d6+3, 1d100）')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('1d100')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(20)

      // コメント入力フィールド
      const commentInput = new TextInputBuilder()
        .setCustomId('dice-comment')
        .setLabel('コメント（任意）')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('任意のコメント')
        .setRequired(false)
        .setMaxLength(50)

      // アクションロウにフィールドを追加
      const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(diceCommandInput)
      const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)

      // モーダルにアクションロウを追加
      modal.addComponents(firstActionRow, secondActionRow)

      // モーダルを表示
      await interaction.showModal(modal)
    } catch (error) {
      console.error('カスタムダイスモーダル作成エラー:', error)
      await interaction.reply({ content: 'エラーが発生しました。もう一度お試しください。', ephemeral: true })
    }
  }
}
