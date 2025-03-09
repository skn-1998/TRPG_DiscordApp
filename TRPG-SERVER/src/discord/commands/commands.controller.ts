import { Controller } from '@nestjs/common'
import {
  Client,
  Interaction,
  Events,
  CommandInteraction,
  AutocompleteInteraction
} from 'discord.js'
import {
  commandType,
  createCharacterThreadConfig,
  diceFromContextMenuConfig,
  rollDiceConfig,
  selectGameSystemConfig,
  userDefinedDiceConfig
} from '../commands/commands.list'
import { CharacterThreadService } from '../commands/commands-components/character-thread.service'
import { RollDiceService } from '../commands/commands-components/roll-dice.service'
import { SelectGameSystemService } from '../commands/commands-components/select-game-system.service'
import { UserDefinedDiceService } from '../commands/commands-components/user-defined-dice.service'
import { DiceFromContextMenuService } from '../commands/commands-components/dice-from-context-menu.service'
import { discordCommandType, discordContextMenuType } from '../discord.type'
import { isUndefined } from 'lodash'

@Controller('commands')
export class CommandsController {
  private characterThreadService: CharacterThreadService
  private rollDiceService: RollDiceService
  private selectGameSystemService: SelectGameSystemService
  private userDefinedDiceService: UserDefinedDiceService
  private diceFromContextMenuService: DiceFromContextMenuService

  constructor(
    characterThreadService: CharacterThreadService,
    rollDiceService: RollDiceService,
    selectGameSystemService: SelectGameSystemService,
    userDefinedDiceService: UserDefinedDiceService,
    diceFromContextMenuService: DiceFromContextMenuService
  ) {
    this.characterThreadService = characterThreadService
    this.rollDiceService = rollDiceService
    this.selectGameSystemService = selectGameSystemService
    this.userDefinedDiceService = userDefinedDiceService
    this.diceFromContextMenuService = diceFromContextMenuService
  }

  private client: Client
  private interaction: CommandInteraction | AutocompleteInteraction

  handleCommand(client: Client): void {
    this.client = client
    this.client.on(
      Events.InteractionCreate,
      async (interaction: Interaction) => {
        if (!interaction.isCommand()) return
        this.interaction = interaction

        this.doEvents(this.characterThreadService, createCharacterThreadConfig)
        this.doEvents(this.rollDiceService, rollDiceConfig)
        this.doEvents(this.selectGameSystemService, selectGameSystemConfig)
        this.doEvents(this.userDefinedDiceService, userDefinedDiceConfig)
        this.doEvents(
          this.diceFromContextMenuService,
          diceFromContextMenuConfig
        )
      }
    )
  }

  handleAutoComplete(client: Client): void {
    this.client = client
    this.client.on(
      Events.InteractionCreate,
      async (interaction: AutocompleteInteraction) => {
        if (!interaction.isAutocomplete()) return
        this.interaction = interaction

        this.doAutoComplete(
          this.selectGameSystemService,
          selectGameSystemConfig
        )
        this.doAutoComplete(this.userDefinedDiceService, userDefinedDiceConfig)
      }
    )
  }

  async doEvents(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discordClass: discordCommandType | discordContextMenuType,
    config?: commandType
  ): Promise<void> {
    if (isUndefined(config.name)) return
    if (!(this.interaction instanceof CommandInteraction)) return
    if (this.interaction?.commandName === config.name) {
      await discordClass.execute(this.interaction)
    }
  }

  async doAutoComplete(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discordClass: discordCommandType | discordContextMenuType,
    config?: commandType
  ): Promise<void> {
    if (isUndefined(config.name)) return
    if (!(this.interaction instanceof AutocompleteInteraction)) return
    if (this.interaction?.commandName === config.name) {
      await discordClass.autocomplete(this.interaction)
    }
  }
}
