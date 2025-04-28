/* eslint-disable no-unused-vars */
import { Controller } from '@nestjs/common'
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
  AuditLogEvent
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
import { getChannelIdByName } from '../utils/searchChannelID'
import { CharacterService } from 'src/domains/character/character.service'
import { AppConfigService } from 'src/config/config.service'
import { CharacterTabButtonsService } from './button/character-tab-buttons.service'
import { CharacterDiceButtonsService } from './button/character-dice-buttons.service'
@Controller('events')
export class EventsController {
  constructor(
    private charaInfoButtonService: CharaInfoButtonService,
    private diceButtonService: DiceButtonService,
    private addCharaInfoService: AddCharaInfoService,
    private changeCharaInfoService: ChangeCharaInfoService,
    private characterChannelService: CharacterChannelService,
    private characterService: CharacterService,
    private appConfigService: AppConfigService,
    private characterTabButtonsService: CharacterTabButtonsService,
    private characterDiceButtonsService: CharacterDiceButtonsService
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
    this.interaction = interaction

    try {
      // ボタンインタラクションの処理
      if (interaction.isButton()) {
        console.log(interaction.customId+"id")
        await this.doEvents(this.charaInfoButtonService, addCharacterInfoConfig)
        await this.doEvents(this.charaInfoButtonService, changeCharacterInfoConfig)
        await this.doEvents(this.diceButtonService, diceButtonConfig)
        await this.doEvents(this.characterTabButtonsService, characterTabButtonsConfig)
        await this.doEvents(this.characterDiceButtonsService, characterDiceButtonsConfig)
      }

      // セレクトメニューインタラクションの処理
      else if (interaction.isStringSelectMenu()) {
        await this.doEvents(this.characterChannelService, selectCharacterChannelConfig)
        await this.doEvents(this.changeCharaInfoService, addCharacterInfoConfig)
        await this.doEvents(this.changeCharaInfoService, changeCharacterInfoConfig)
      }

      // モーダルインタラクションの処理
      else if (interaction.isModalSubmit()) {
        await this.doEvents(this.addCharaInfoService, addCharacterInfoConfig)
        await this.doEvents(this.addCharaInfoService, changeCharacterInfoConfig)
      }
    } catch (error) {
      console.error('Interaction handling error:', error)
    }
  }


  handleChannelCreate(client: Client): void {
    console.log('create')
    this.client = client // Set the client property

    client.on(Events.ChannelCreate, async (channel: NonThreadGuildBasedChannel): Promise<void> => {
      const characterCategory = this.appConfigService.get('discord.characterCategory')
      const categoryId = getChannelIdByName(channel.guild, characterCategory)
      console.log('Channel created:', channel.name, 'Parent ID:', channel.parentId, 'Target category ID:', categoryId)
      if (!(channel.type === ChannelType.GuildText)) return
      if (channel.parentId === categoryId) {
        console.log('Creating character for channel:', channel.name)
        this.charaInfoButtonService.createButton(channel)

        // チャンネル作成者のIDを取得
        let creatorId = ''
        try {
          // Audit Logsを取得（CHANNEL_CREATEアクションのみ、より多くのエントリを取得）
          const fetchedLogs = await channel.guild.fetchAuditLogs({
            limit: 10, // より多くのログを取得
            type: AuditLogEvent.ChannelCreate
          })

          // 該当チャンネルに関するログエントリを検索
          const logEntry = fetchedLogs.entries.find((entry) => entry.target.id === channel.id)

          // 該当するログが見つかった場合
          if (logEntry) {
            creatorId = logEntry.executor.id
            console.log(`チャンネル作成者ID: ${creatorId}`)
          } else {
            console.log(`チャンネル ${channel.name} の作成者を特定できませんでした`)
          }
        } catch (error) {
          console.error('Audit logs取得エラー:', error)
        }

        // 空文字列でキャラクターを作成 (モデルでデフォルト値が設定されているため可能)
        this.characterService
          .create({
            TRPGName: '',
            characterName: channel.name,
            discordChannelId: channel.id,
            discordUserId: creatorId // チャンネル作成者のIDを設定
          })
          .then((character) => {
            console.log(`キャラクター「${character.characterName}」が作成されました。ID: ${character.characterId}`)
            if (!creatorId) {
              console.log('注意: discordUserIdは取得できませんでした。後で設定してください。')
            }
          })
          .catch((error) => {
            console.error('キャラクター作成エラー:', error)
          })
      }
    })
  }

  async doEvents(
    discordClass: discordInteractionType,
    config?: eventSelectButtonType | eventType | eventButtonType,
  ): Promise<void> {
    if (isUndefined(config.customId)) return
    if (this.interaction?.customId === config.customId) {
      await discordClass.execute(this.interaction, config)
    }
    if(this.interaction?.customId.includes("*") && this.interaction?.customId.includes(config.customId)){
      await discordClass.execute(this.interaction, config)
    }
  }
}
