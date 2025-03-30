import { Controller } from '@nestjs/common'
import { CharaInfoButtonService } from './button/chara-info-button.service'
import { DiceButtonService } from './button/dice-button.service'
import {
  Client,
  Events,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  NonThreadGuildBasedChannel,
  ChannelType,
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
  eventButtonType
} from './events.list'
import { discordInteractionType } from '../discord.type'
import { isUndefined } from 'lodash'
import { getChannelIdByName } from '../utils/searchChannelID'
import { CharacterService } from 'src/DB/character/character.service'

@Controller('events')
export class EventsController {
  // private charaInfoButtonService: CharaInfoButtonService
  // private diceButtonService: DiceButtonService
  // private addCharaInfoService: AddCharaInfoService
  // private changeCharaInfoService: ChangeCharaInfoService
  // private characterChannelService: CharacterChannelService
  constructor(
    private charaInfoButtonService: CharaInfoButtonService,
    private diceButtonService: DiceButtonService,
    private addCharaInfoService: AddCharaInfoService,
    private changeCharaInfoService: ChangeCharaInfoService,
    private characterChannelService: CharacterChannelService,
    private characterService: CharacterService
  ) {
    // this.charaInfoButtonService = charaInfoButtonService
    // this.diceButtonService = diceButtonService
    // this.addCharaInfoService = addCharaInfoService
    // this.changeCharaInfoService = changeCharaInfoService
    // this.characterChannelService = characterChannelService
  }
  private client: Client
  private interaction:
    | ButtonInteraction
    | StringSelectMenuInteraction
    | ModalSubmitInteraction
  handleCommand(client: Client) {
    this.client = client
    this.handleButton()
    this.handleSelectMenu()
    this.handleModal()
  }
  handleSelectMenu() {
    this.client.on(
      Events.InteractionCreate,
      async (interaction: StringSelectMenuInteraction) => {
        if (!interaction.isStringSelectMenu) return
        this.interaction = interaction
        this.doEvents(
          this.characterChannelService,
          selectCharacterChannelConfig
        )
        this.doEvents(this.changeCharaInfoService, addCharacterInfoConfig)
        this.doEvents(this.changeCharaInfoService, changeCharacterInfoConfig)
      }
    )
  }
  handleButton():void {
    this.client.on(
      Events.InteractionCreate,
      async (interaction: ButtonInteraction) => {
        if (!interaction.isButton()) return
        this.interaction = interaction
        await this.doEvents(this.charaInfoButtonService, addCharacterInfoConfig)
        await this.doEvents(
          this.charaInfoButtonService,
          changeCharacterInfoConfig
        )
        await this.doEvents(this.diceButtonService, diceButtonConfig)
      }
    )
  }
  handleModal(): void {
    this.client.on(
      Events.InteractionCreate,
      async (interaction: ModalSubmitInteraction) => {
        if (!interaction.isModalSubmit()) return
        this.interaction = interaction
        await this.doEvents(this.addCharaInfoService, addCharacterInfoConfig)
        await this.doEvents(this.addCharaInfoService, changeCharacterInfoConfig)
      }
    )
  }
  handleChannelCreate(): void {
    this.client.on(
      Events.ChannelCreate,
      async (channel: NonThreadGuildBasedChannel): Promise<void> => {
        const categoryId = getChannelIdByName(channel.guild, 'キャラクター')
        if (!(channel.type === ChannelType.GuildText)) return
        if (channel.parentId === categoryId) {
          this.charaInfoButtonService.createButton(channel)
          const auditLogs = await channel.guild.fetchAuditLogs({
            limit:1,
            type: AuditLogEvent.ChannelCreate
          })

          const auditLog = auditLogs.entries.first();
          if(auditLog)
          {
            const creatorId = auditLog.executorId
          // channel.createInvite

            this.characterService.create(channel.name,creatorId)
          }
          
        }
      }
    )
  }
  async doEvents(
    discordClass: discordInteractionType,
    config?: eventSelectButtonType | eventType | eventButtonType
  ): Promise<void> {
    if (isUndefined(config.customId)) return
    if (this.interaction?.customId === config.customId) {
      console.log(config, discordClass)
      await discordClass.execute(this.interaction, config)
    }
  }
}
