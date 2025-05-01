/* eslint-disable no-unused-vars */
import { Controller, Logger } from '@nestjs/common'
import { CharaInfoButtonService } from './button/chara-info-button.service'
import { DiceButtonService } from './button/dice-button.service'
import {
  Client,
  Events,
  ButtonInteraction,
  ModalSubmitInteraction,
  NonThreadGuildBasedChannel,
  ChannelType,
  AnySelectMenuInteraction,
  AuditLogEvent,
  BaseGuildTextChannel,
  TextChannel
} from 'discord.js'
import { ChangeCharaInfoService } from './select/change-chara-info.service'
import { CharacterChannelService } from './select/character-channel.service'
import { AddCharaInfoService } from './modal/add-chara-info.service'
import {
  changeCharacterInfoConfig,
  addCharacterInfoConfig,
  selectCharacterChannelConfig,
  diceButtonConfig,
  eventSelectButtonType,
  eventType,
  eventButtonType,
  characterTabButtonsConfig,
  characterDiceButtonsConfig
} from './events.list'
import { discordInteractionType } from '../discord.type'
import { isUndefined } from 'lodash'
import { CharacterService } from 'src/domains/character/character.service'
import { AppConfigService } from 'src/config/config.service'
import { CharacterTabButtonsService } from './button/character-tab-buttons.service'
import { CharacterDiceButtonsService } from './button/character-dice-buttons.service'
import { ChannelCreateService } from './channel/character-channel-create.service'
import { DiceRollChannelCreateService } from './channel/diceroll-channel-create.service'
// システムイベントハンドラーの型定義
export type systemEventHandlerType = {
  execute: (channel: TextChannel, config: string) => void
}

@Controller('events')
export class EventsController {
  private readonly logger = new Logger(EventsController.name)

  constructor(
    private charaInfoButtonService: CharaInfoButtonService,
    private diceButtonService: DiceButtonService,
    private addCharaInfoService: AddCharaInfoService,
    private changeCharaInfoService: ChangeCharaInfoService,
    private characterChannelService: CharacterChannelService,
    private characterService: CharacterService,
    private appConfigService: AppConfigService,
    private characterTabButtonsService: CharacterTabButtonsService,
    private characterDiceButtonsService: CharacterDiceButtonsService,
    private channelCreateHandler: ChannelCreateService,
    private diceRollChannelCreateHandler: DiceRollChannelCreateService
  ) {}

  private client: Client
  private interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction

  handleCommand(client: Client): void {
    this.client = client
    // イベントリスナーの登録は行わない（EventManagerServiceに委譲）
    this.handleChannelCreate(client)
  }

  // インタラクションハンドラー - 外部から呼び出される
  async handleInteraction(
    interaction: ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
  ): Promise<void> {
    // 応答済みのインタラクションは処理しない
    if (interaction.replied || interaction.deferred) {
      this.logger.warn(`インタラクション(ID: ${interaction.id})は既に応答済みです。処理をスキップします。`)
      return
    }

    this.logger.log(
      `インタラクション処理開始: Type=${interaction.type}, ID=${interaction.id}, CustomID=${interaction.customId}`
    )
    this.interaction = interaction

    try {
      // ボタンインタラクションの処理
      if (interaction.isButton()) {
        this.logger.debug(`ボタン処理: ${interaction.customId}`)
        await this.doEvents(this.charaInfoButtonService, addCharacterInfoConfig)
        await this.doEvents(this.charaInfoButtonService, changeCharacterInfoConfig)
        await this.doEvents(this.diceButtonService, diceButtonConfig)
        await this.doEvents(this.characterTabButtonsService, characterTabButtonsConfig)
        await this.doEvents(this.characterDiceButtonsService, characterDiceButtonsConfig)
      }

      // セレクトメニューインタラクションの処理
      else if (interaction.isStringSelectMenu()) {
        this.logger.debug(`セレクトメニュー処理: ${interaction.customId}`)
        await this.doEvents(this.characterChannelService, selectCharacterChannelConfig)
        await this.doEvents(this.changeCharaInfoService, addCharacterInfoConfig)
        await this.doEvents(this.changeCharaInfoService, changeCharacterInfoConfig)
      }

      // モーダルインタラクションの処理
      else if (interaction.isModalSubmit()) {
        this.logger.debug(`モーダル処理: ${interaction.customId}`)
        await this.doEvents(this.addCharaInfoService, addCharacterInfoConfig)
        await this.doEvents(this.addCharaInfoService, changeCharacterInfoConfig)
      }

      // インタラクションが応答されなかった場合
      if (!(interaction.replied || interaction.deferred)) {
        this.logger.warn(
          `インタラクション(ID: ${interaction.id}, CustomID=${interaction.customId})に対して応答が行われませんでした。`
        )
      } else {
        this.logger.log(`インタラクション処理完了: ID=${interaction.id}`)
      }
    } catch (error) {
      this.logger.error(`インタラクション処理エラー(ID: ${interaction.id}):`, error)

      // エラー発生時に未応答の場合は応答する
      if (!(interaction.replied || interaction.deferred)) {
        try {
          await interaction.reply({
            content: '処理中にエラーが発生しました。しばらく経ってから再度お試しください。',
            ephemeral: true
          })
        } catch (replyError) {
          this.logger.error('エラー応答中にさらにエラーが発生しました:', replyError)
        }
      }
    }
  }

  handleChannelCreate(client: Client): void {
    this.logger.log('チャンネル作成ハンドラーを呼び出します')
    this.client = client
    client.on(Events.ChannelCreate, async (channel: NonThreadGuildBasedChannel): Promise<void> => {
      if (!(channel.type === ChannelType.GuildText)) return

      this.doSystemEvent(this.channelCreateHandler, this.appConfigService.get('discord.characterCategory'), channel)
      this.doSystemEvent(
        this.diceRollChannelCreateHandler,
        this.appConfigService.get('discord.diceRollCategory'),
        channel
      )
    })
  }
  /**
   * システムイベントハンドラーを呼び出す
   * @param handler イベントハンドラー
   * @param config イベント設定
   * @param client Discordクライアント
   */
  doSystemEvent(handler: systemEventHandlerType, categoryId: string, channel: TextChannel): void {
    this.logger.debug(`システムイベント実行: ${categoryId}`)
    console.log(channel.parent.name)
    if (channel.parent.name === categoryId) {
      handler.execute(channel, categoryId)
    }
  }

  async doEvents(
    discordClass: discordInteractionType,
    config?: eventSelectButtonType | eventType | eventButtonType
  ): Promise<void> {
    if (isUndefined(config.customId)) return

    // 応答済みのインタラクションは処理しない
    if (this.interaction.replied || this.interaction.deferred) {
      return
    }

    if (this.interaction?.customId === config.customId) {
      this.logger.debug(`イベント実行: ${config.customId}`)
      await discordClass.execute(this.interaction, config)
    }
    if (this.interaction?.customId.includes('*') && this.interaction?.customId.includes(config.customId)) {
      this.logger.debug(`ワイルドカードイベント実行: ${this.interaction.customId} (マッチ: ${config.customId})`)
      await discordClass.execute(this.interaction, config)
    }
  }
}
