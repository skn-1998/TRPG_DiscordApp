import { Injectable, Logger } from '@nestjs/common'
import {
  AnySelectMenuInteraction,
  StringSelectMenuInteraction,
  CommandInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js'
import { discordSelectMenuType } from '../../../discord.type'
import { TypedEventService } from '../../../../shared/application/typed-event.service'
import { Character } from '../../../../domains/character/models/character.model'
import { ChannelManagerService } from './channel-manager.service'
import { CharacterEmbedService } from './character-embed.service'
import { DiceUIBuilderService } from './dice-ui-builder.service'
import { ErrorHandler } from '../../../../utils/error-handler'

/**
 * キャラクターチャンネルオーケストレーターサービス
 *
 * 責務：
 * - 分割されたサービス間の協調
 * - インタラクションのルーティング
 * - 完全なキャラクタースレッド作成フローの管理
 */
@Injectable()
export class CharacterChannelOrchestratorService implements discordSelectMenuType {
  private readonly logger = new Logger(CharacterChannelOrchestratorService.name)

  // SelectMenuの実装に必要なプロパティ
  channelOptions: StringSelectMenuOptionBuilder[]

  constructor(
    private readonly channelManager: ChannelManagerService,
    private readonly characterEmbed: CharacterEmbedService,
    private readonly diceUIBuilder: DiceUIBuilderService,
    private readonly eventEmitter: TypedEventService
  ) {
    this.logger.debug('Character channel orchestrator service initialized')

    // デフォルトオプションで初期化
    this.channelOptions = [new StringSelectMenuOptionBuilder().setLabel('デフォルト').setValue('default')]
  }

  get data(): StringSelectMenuBuilder {
    return new StringSelectMenuBuilder()
      .setCustomId('thread-create-character')
      .setPlaceholder('キャラクターを選択')
      .addOptions(...this.channelOptions)
  }

  /**
   * SelectMenuインタラクションの処理
   */
  async execute(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      // Guild存在チェック
      if (!interaction.guild) {
        await interaction.reply({
          content: 'このコマンドはサーバー内でのみ使用できます',
          ephemeral: true
        })
        return
      }

      // カテゴリの検証
      const categoryValidation = this.channelManager.validateCharacterCategory(interaction.guild)
      if (!categoryValidation.isValid) {
        await interaction.reply({
          content: 'カテゴリが見つかりませんでした',
          ephemeral: true
        })
        return
      }

      const characterChannelId = interaction.values[0]

      // 【PHASE3】一時的な機能無効化メッセージ
      await this.handlePhase3Transition(interaction, characterChannelId)
    } catch (error) {
      this.logger.error('Failed to execute select menu interaction', error)

      await ErrorHandler.handleDiscordError(error, interaction, {
        operation: 'CharacterChannelOrchestratorService.execute',
        customId: interaction.customId,
        channelId: interaction.channelId
      })
    }
  }

  /**
   * Phase3移行中の一時処理
   */
  private async handlePhase3Transition(
    interaction: StringSelectMenuInteraction,
    characterChannelId: string
  ): Promise<void> {
    try {
      this.logger.log(`[PHASE3] Character search request: ${characterChannelId}`)

      // 型安全なイベント発行
      await this.eventEmitter.emit('character.findByChannelId.requested', {
        channelId: characterChannelId,
        source: 'character-channel-orchestrator-service',
        timestamp: new Date()
      })

      // 一時的に機能を無効化
      await interaction.reply({
        content:
          '⚠️ キャラクタースレッド作成機能は現在メンテナンス中です。Phase 3移行作業が完了するまでお待ちください。',
        ephemeral: true
      })
    } catch (error) {
      this.logger.error('Phase3 transition handling failed', error)
      throw error
    }
  }

  /**
   * キャラクタースレッドの作成（完全なフロー）
   */
  async createCharacterThread(interaction: CommandInteraction, character: Character): Promise<void> {
    try {
      // Guild存在確認
      if (!interaction.guild) {
        await interaction.reply({
          content: 'このコマンドはサーバー内でのみ使用できます',
          ephemeral: true
        })
        return
      }

      // キャラクターのチャンネルID確認
      const channelId = character.discordChannelId
      if (!channelId) {
        await interaction.reply({
          content: 'キャラクターにチャンネルが設定されていません',
          ephemeral: true
        })
        return
      }

      // チャンネル検証
      const targetChannel = await this.channelManager.validateTextChannel(interaction.guild, channelId)

      if (!targetChannel) {
        await interaction.reply({
          content: 'キャラクターのチャンネルが見つかりません',
          ephemeral: true
        })
        return
      }

      // スレッド作成
      const thread = await this.channelManager.createCharacterThread(interaction.guild, channelId, character)

      // 応答
      await interaction.reply({
        content: `${character.characterName}のスレッドを作成しました`,
        ephemeral: true
      })

      // キャラクター情報を投稿
      await this.characterEmbed.postCharacterInfo(thread, character, interaction.user.displayName)

      // ダイスボタンを作成
      await this.diceUIBuilder.createDiceButtons(thread, character)

      this.logger.debug(`Character thread created successfully: ${thread.id}`)
    } catch (error) {
      this.logger.error('Failed to create character thread', error)

      if (!interaction.replied) {
        await interaction.reply({
          content: 'スレッドの作成中にエラーが発生しました',
          ephemeral: true
        })
      }

      throw error
    }
  }

  /**
   * チャンネルオプションを取得・設定
   */
  getAndSetChannelOption(interaction: CommandInteraction): StringSelectMenuBuilder {
    try {
      // Guild存在確認
      if (!interaction.guild) {
        this.channelOptions = [
          new StringSelectMenuOptionBuilder().setLabel('サーバー情報が取得できません').setValue('no-guild')
        ]
        return this.data
      }

      // チャンネルオプションを取得
      this.channelOptions = this.channelManager.getCharacterChannelOptions(interaction.guild)

      this.logger.debug(`Channel options updated: ${this.channelOptions.length} options`)
      return this.data
    } catch (error) {
      this.logger.error('Failed to get channel options', error)

      // エラー時はデフォルトオプションを返す
      this.channelOptions = [new StringSelectMenuOptionBuilder().setLabel('エラーが発生しました').setValue('error')]
      return this.data
    }
  }

  /**
   * SelectMenuを削除
   */
  async deleteSelectMenu(interaction: StringSelectMenuInteraction): Promise<void> {
    try {
      await interaction.deleteReply()
      this.logger.debug('Select menu deleted')
    } catch (error) {
      this.logger.error('Failed to delete select menu', error)
    }
  }

  /**
   * スレッド作成後の応答処理
   */
  async postThreadCreationReply(
    interaction: StringSelectMenuInteraction,
    thread: any,
    character: Character
  ): Promise<void> {
    try {
      if (!interaction.replied) {
        await interaction.reply('キャラクターダイス用のスレッドを作成しました')
      }

      await thread.send(`Welcome to ${thread.name}`)

      if (character) {
        // キャラクター情報を投稿
        await this.characterEmbed.postCharacterInfo(thread, character, interaction.user?.displayName)
      }

      this.logger.debug(`Thread creation reply posted: ${thread.id}`)
    } catch (error) {
      this.logger.error('Failed to post thread creation reply', error)

      try {
        await thread.send({ content: 'キャラクター情報の取得に失敗しました' })

        if (!interaction.replied && interaction.isRepliable()) {
          await interaction.reply({
            content: 'キャラクター情報の取得に失敗しました',
            ephemeral: true
          })
        } else if (interaction.isRepliable()) {
          await interaction.followUp({
            content: 'キャラクター情報の取得に失敗しました',
            ephemeral: true
          })
        }
      } catch (replyError) {
        this.logger.error('Failed to send error response', replyError)
      }
    }
  }

  /**
   * サービス統計情報を取得
   */
  getServiceStats(): {
    channelOptionsCount: number
    isReady: boolean
  } {
    return {
      channelOptionsCount: this.channelOptions.length,
      isReady: this.channelOptions.length > 0 && this.channelOptions[0].data.value !== 'default'
    }
  }
}
