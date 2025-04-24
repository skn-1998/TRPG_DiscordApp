import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { EventManagerService } from './event-manager.service'
import { EventsService } from '../events/events.service'
import { DiscordButton, DiscordModal, DiscordSelectMenu } from '../interfaces/discord-interaction-types.interface'
import { CharaInfoButtonService } from '../events/button/chara-info-button.service'
import { DiceButtonService } from '../events/button/dice-button.service'
import { AddCharaInfoService } from '../events/modal/add-chara-info.service'
import { ChangeCharaInfoService } from '../events/select/change-chara-info.service'
import { CharacterChannelService } from '../events/select/character-channel.service'
import {
  addCharacterInfoConfig,
  changeCharacterInfoConfig,
  diceButtonConfig,
  selectCharacterChannelConfig
} from '../events/events.list'
import { ButtonStyle } from 'discord.js'
import { DiscordClientService } from './discord-client.service'
import { EventsController } from '../events/events.controller'

/**
 * Discord イベント登録サービス
 * EventsServiceからEventManagerServiceへイベントを登録する
 */
@Injectable()
export class DiscordEventRegistrationService implements OnModuleInit {
  private readonly logger = new Logger(DiscordEventRegistrationService.name)
  private eventsController: EventsController

  constructor(
    private readonly eventManagerService: EventManagerService,
    private readonly eventsService: EventsService,
    private readonly discordClientService: DiscordClientService,
    private readonly charaInfoButtonService: CharaInfoButtonService,
    private readonly diceButtonService: DiceButtonService,
    private readonly addCharaInfoService: AddCharaInfoService,
    private readonly changeCharaInfoService: ChangeCharaInfoService,
    private readonly characterChannelService: CharacterChannelService,
    private readonly moduleRef: ModuleRef
  ) {}

  /**
   * モジュール初期化時にイベントを登録
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Discordイベントを登録します...')
    // コントローラーを取得
    this.eventsController = this.moduleRef.get(EventsController, { strict: false })

    this.registerEvents()
  }

  /**
   * チャンネル作成イベントを登録
   */
  private registerChannelCreateEvent(): void {
    this.logger.log('チャンネル作成イベントを登録しています...')

    // ドメイン側のDiscordクライアントを取得
    const client = this.discordClientService.getClient()

    // EventsControllerにクライアントをセットしてイベントハンドラを登録
    this.eventsController.handleChannelCreate(client)

    this.logger.log('チャンネル作成イベントの登録が完了しました')
  }

  /**
   * イベントを登録
   */
  private registerEvents(): void {
    this.registerButtons()
    this.registerModals()
    this.registerSelectMenus()
  }

  /**
   * ボタンを登録
   */
  private registerButtons(): void {
    // キャラクター情報追加ボタン
    const addCharaInfoButton: DiscordButton = {
      id: addCharacterInfoConfig.customId,
      name: 'キャラクター情報追加',
      description: 'キャラクター情報を追加するボタン',
      data: this.charaInfoButtonService.initialSetting(addCharacterInfoConfig, ButtonStyle.Primary).data,
      execute: this.charaInfoButtonService.execute.bind(this.charaInfoButtonService)
    }

    // キャラクター情報変更ボタン
    const changeCharaInfoButton: DiscordButton = {
      id: changeCharacterInfoConfig.customId,
      name: 'キャラクター情報変更',
      description: 'キャラクター情報を変更するボタン',
      data: this.charaInfoButtonService.initialSetting(changeCharacterInfoConfig, ButtonStyle.Secondary).data,
      execute: this.charaInfoButtonService.execute.bind(this.charaInfoButtonService)
    }

    // ダイスボタン
    const diceButton: DiscordButton = {
      id: diceButtonConfig.customId,
      name: 'ダイス',
      description: 'ダイスを振るボタン',
      data: this.diceButtonService.data,
      execute: this.diceButtonService.execute.bind(this.diceButtonService)
    }

    // ボタンを登録
    this.eventManagerService.registerButton(addCharaInfoButton)
    this.eventManagerService.registerButton(changeCharaInfoButton)
    this.eventManagerService.registerButton(diceButton)
  }

  /**
   * モーダルを登録
   */
  private registerModals(): void {
    // キャラクター情報追加モーダル
    const addCharaInfoModal: DiscordModal = {
      id: addCharacterInfoConfig.customId,
      name: 'キャラクター情報追加モーダル',
      description: 'キャラクター情報を追加するモーダル',
      data: this.addCharaInfoService.initialSetting(addCharacterInfoConfig).data,
      execute: this.addCharaInfoService.execute.bind(this.addCharaInfoService)
    }

    // キャラクター情報変更モーダル
    const changeCharaInfoModal: DiscordModal = {
      id: changeCharacterInfoConfig.customId,
      name: 'キャラクター情報変更モーダル',
      description: 'キャラクター情報を変更するモーダル',
      data: this.addCharaInfoService.initialSetting(changeCharacterInfoConfig).data,
      execute: this.addCharaInfoService.execute.bind(this.addCharaInfoService)
    }

    // モーダルを登録
    this.eventManagerService.registerModal(addCharaInfoModal)
    this.eventManagerService.registerModal(changeCharaInfoModal)
  }

  /**
   * セレクトメニューを登録
   */
  private registerSelectMenus(): void {
    try {
      // キャラクター情報変更セレクトメニュー
      const changeCharaInfoSelect: DiscordSelectMenu = {
        id: changeCharacterInfoConfig.customId,
        name: 'キャラクター情報変更セレクト',
        description: 'キャラクター情報の変更項目を選択するメニュー',
        data: this.changeCharaInfoService.data,
        execute: this.changeCharaInfoService.execute.bind(this.changeCharaInfoService)
      }

      // キャラクターチャンネルセレクトメニュー
      const characterChannelSelect: DiscordSelectMenu = {
        id: selectCharacterChannelConfig.customId,
        name: 'キャラクターチャンネルセレクト',
        description: 'キャラクターチャンネルを選択するメニュー',
        data: this.characterChannelService.data,
        execute: this.characterChannelService.execute.bind(this.characterChannelService)
      }

      // セレクトメニューを登録
      this.eventManagerService.registerSelectMenu(changeCharaInfoSelect)
      this.eventManagerService.registerSelectMenu(characterChannelSelect)
    } catch (error) {
      this.logger.error('セレクトメニューの登録中にエラーが発生しました')
      this.logger.error(error)
    }
  }
}
