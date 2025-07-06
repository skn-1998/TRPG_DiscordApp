import { Controller, Logger } from '@nestjs/common'
import { Client, Interaction, CommandInteraction, AutocompleteInteraction, CacheType } from 'discord.js'
import {
  commandType,
  createCharacterThreadConfig,
  diceFromContextMenuConfig,
  diceResultConfig,
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
import { DiceResultService } from './commands-components/dice-result.service'

@Controller('commands')
export class CommandsController {
  private readonly logger = new Logger(CommandsController.name)
  private characterThreadService: CharacterThreadService
  private rollDiceService: RollDiceService
  private selectGameSystemService: SelectGameSystemService
  private userDefinedDiceService: UserDefinedDiceService
  private diceFromContextMenuService: DiceFromContextMenuService
  private diceResultService: DiceResultService
  constructor(
    characterThreadService: CharacterThreadService,
    rollDiceService: RollDiceService,
    selectGameSystemService: SelectGameSystemService,
    userDefinedDiceService: UserDefinedDiceService,
    diceFromContextMenuService: DiceFromContextMenuService,
    diceResultService: DiceResultService
  ) {
    this.characterThreadService = characterThreadService
    this.rollDiceService = rollDiceService
    this.selectGameSystemService = selectGameSystemService
    this.userDefinedDiceService = userDefinedDiceService
    this.diceFromContextMenuService = diceFromContextMenuService
    this.diceResultService = diceResultService
  }

  private client: Client
  private interaction: CommandInteraction | AutocompleteInteraction

  /**
   * Discord クライアントを設定する
   * 注意：InteractionCreateイベントリスナーは登録しない（EventManagerServiceに委任）
   * @param client Discord クライアント
   */
  handleCommand(client: Client): void {
    this.logger.log('コマンドコントローラーにクライアントを設定')
    this.client = client
    // InteractionCreateイベントリスナーの登録はもう行わない（EventManagerServiceに委任）
  }

  /**
   * Discord クライアントを設定する（オートコンプリート用）
   * 注意：InteractionCreateイベントリスナーは登録しない（EventManagerServiceに委任）
   * @param client Discord クライアント
   */
  handleAutoComplete(client: Client): void {
    this.logger.log('オートコンプリートコントローラーにクライアントを設定')
    this.client = client
    // InteractionCreateイベントリスナーの登録はもう行わない（EventManagerServiceに委任）
  }

  /**
   * コマンドインタラクションを処理する
   * EventManagerServiceから直接呼び出される
   * @param interaction コマンドインタラクション
   */
  async handleInteraction(interaction: CommandInteraction): Promise<void> {
    this.logger.log(`コマンド処理: ${interaction.commandName} (ID: ${interaction.id})`)
    this.interaction = interaction

    await this.doEvents(this.characterThreadService, createCharacterThreadConfig)
    await this.doEvents(this.rollDiceService, rollDiceConfig)
    await this.doEvents(this.selectGameSystemService, selectGameSystemConfig)
    await this.doEvents(this.userDefinedDiceService, userDefinedDiceConfig)
    await this.doEvents(this.diceFromContextMenuService, diceFromContextMenuConfig)
    await this.doEvents(this.diceResultService, diceResultConfig)
  }

  /**
   * オートコンプリートインタラクションを処理する
   * EventManagerServiceから直接呼び出される
   * @param interaction オートコンプリートインタラクション
   */
  async handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {
    this.logger.log(`オートコンプリート処理: ${interaction.commandName} (ID: ${interaction.id})`)
    this.interaction = interaction

    await this.doAutoComplete(this.selectGameSystemService, selectGameSystemConfig)
    await this.doAutoComplete(this.userDefinedDiceService, userDefinedDiceConfig)
  }

  async doEvents(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    discordClass: discordCommandType | discordContextMenuType,
    config: commandType
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
    config: commandType
  ): Promise<void> {
    if (isUndefined(config.name)) return
    if (!(this.interaction instanceof AutocompleteInteraction)) return
    if (this.interaction?.commandName === config.name) {
      if (discordClass.autocomplete) {
        await discordClass.autocomplete(this.interaction)
      }
    }
  }
}
