import { Injectable } from '@nestjs/common'
import { ButtonBuilder, ButtonInteraction, ButtonStyle, CacheType, EmbedBuilder, ThreadChannel } from 'discord.js'
import { discordButtonType } from 'src/discord/discord.type'
import { Character } from 'src/domains/character/models/character.model'
import { CharacterAttribute } from 'src/domains/character/dto/create-character.dto'
import { EventEmitter2 } from '@nestjs/event-emitter'

@Injectable()
export class CharacterTabButtonsService implements discordButtonType {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  public data = new ButtonBuilder().setCustomId('character-tab*').setLabel('基本情報').setStyle(ButtonStyle.Primary)

  async execute(interaction: ButtonInteraction<CacheType>): Promise<void> {
    try {
      if (!interaction.isButton()) return

      const _temp = interaction.customId.replace('character-tab*', '')
      const channelId = _temp.split('*')[0]
      const tabType = _temp.split('*')[1]

      // スレッドチャンネルであることを確認
      if (!interaction.channel || !(interaction.channel instanceof ThreadChannel)) {
        await interaction.reply({ content: 'このコマンドはスレッド内でのみ使用できます', ephemeral: true })
        return
      }

      // 【PHASE3】 キャラクター情報取得をイベント駆動パターンに変更
      console.log(`[PHASE3] キャラクター情報取得をスキップ: ${channelId}, tab: ${tabType}`)

      // イベント発行（非同期）
      this.eventEmitter.emit('character.findByChannelId.requested', {
        channelId,
        tabType,
        source: 'character-tab-buttons-service',
        timestamp: new Date()
      })

      // 【PHASE3】 一時的に機能を無効化
      await interaction.reply({
        content: '⚠️ キャラクタータブ機能は現在メンテナンス中です。Phase 3移行作業が完了するまでお待ちください。',
        ephemeral: true
      })
      return

      // 以下は Phase 3 完了後に削除予定
      // const character = await this.discordFacadeService.getCharacterByChannelId(channelId)

      // // キャラクターが見つからない場合の処理
      // if (!character) {
      //   await interaction.reply({ content: 'キャラクター情報が見つかりませんでした', ephemeral: true })
      //   return
      // }

      // // 応答中であることを示す
      // await interaction.deferReply()

      // // タブに応じたEmbedを生成
      // let embed: EmbedBuilder

      // switch (tabType) {
      //   case 'basic':
      //     embed = this.createBasicInfoEmbed(character)
      //     break
      //   case 'status':
      //     embed = this.createStatusEmbed(character)
      //     break
      //   case 'skills':
      //     embed = this.createSkillsEmbed(character)
      //     break
      //   case 'items':
      //     embed = this.createItemsEmbed(character)
      //     break
      //   case 'desc':
      //     embed = this.createDescriptionEmbed(character)
      //     break
      //   default:
      //     embed = this.createBasicInfoEmbed(character)
      // }

      // await interaction.editReply({ embeds: [embed] })
    } catch (error) {
      console.error('[PHASE3] キャラクタータブ処理エラー:', error)

      // エラー応答
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({
            content: '⚠️ キャラクター情報の表示中にエラーが発生しました。',
            ephemeral: true
          })
        } else if (interaction.deferred) {
          await interaction.editReply({
            content: '⚠️ キャラクター情報の表示中にエラーが発生しました。'
          })
        } else {
          await interaction.followUp({
            content: '⚠️ キャラクター情報の表示中にエラーが発生しました。',
            ephemeral: true
          })
        }
      } catch (replyError) {
        console.error('[PHASE3] エラー応答送信失敗:', replyError)
      }
    }
  }
}
