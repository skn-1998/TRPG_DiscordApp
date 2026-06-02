import { Injectable, Logger } from '@nestjs/common'
import { Client, CommandInteraction, AutocompleteInteraction } from 'discord.js'
import 'dotenv/config'
import { CharacterThreadService } from './commands-components/character-thread.service'
import { DiceFromContextMenuService } from './commands-components/dice-from-context-menu.service'
import { RollDiceService } from './commands-components/roll-dice.service'
import { SelectGameSystemService } from './commands-components/select-game-system.service'
import { UserDefinedDiceService } from './commands-components/user-defined-dice.service'
import { DiceResultService } from './commands-components/dice-result.service'

@Injectable()
export class CommandsService {
  private readonly logger = new Logger(CommandsService.name)
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

  /**
   * 登録されているすべてのコマンドを取得
   * @returns コマンドの配列
   */
  getCommands() {
    return [
      this.characterThreadService,
      this.rollDiceService,
      this.selectGameSystemService,
      this.userDefinedDiceService,
      this.diceFromContextMenuService,
      this.diceResultService
    ].filter((service) => service)
  }

  /**
   * コマンド実行
   */
  async execute(interaction: CommandInteraction): Promise<void> {
    try {
      // コマンドサービス別に実行
      const commandName = interaction.commandName

      switch (commandName) {
        case 'create-character-thread':
          if (this.characterThreadService && typeof this.characterThreadService.execute === 'function') {
            await this.characterThreadService.execute(interaction)
          }
          break
        case 'd':
          if (this.rollDiceService && typeof this.rollDiceService.execute === 'function') {
            await this.rollDiceService.execute(interaction)
          }
          break
        case 'create-dice-channel':
          if (this.selectGameSystemService && typeof this.selectGameSystemService.execute === 'function') {
            await this.selectGameSystemService.execute(interaction)
          }
          break
        case 'user-dice':
          if (this.userDefinedDiceService && typeof this.userDefinedDiceService.execute === 'function') {
            await this.userDefinedDiceService.execute(interaction)
          }
          break
        case 'dice-from-context-menu':
          if (this.diceFromContextMenuService && typeof this.diceFromContextMenuService.execute === 'function') {
            await this.diceFromContextMenuService.execute(interaction)
          }
          break
        case 'dice-result':
          if (this.diceResultService && typeof this.diceResultService.execute === 'function') {
            await this.diceResultService.execute(interaction)
          }
          break
        default:
          this.logger.warn(`未実装のコマンド: ${commandName}`)
          await interaction.reply({
            content: 'このコマンドは現在利用できません。',
            ephemeral: true
          })
      }
    } catch (error) {
      this.logger.error('コマンド実行エラー:', error)
      const replyOptions = {
        content: 'コマンドの実行中にエラーが発生しました。',
        ephemeral: true
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyOptions)
      } else {
        await interaction.reply(replyOptions)
      }
    }
  }

  /**
   * オートコンプリート実行
   */
  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    try {
      // 各サービスのオートコンプリート機能を呼び出し
      // 現在はログのみ
      this.logger.log(`オートコンプリート: ${interaction.commandName}`)
    } catch (error) {
      this.logger.error('オートコンプリートエラー:', error)
    }
  }

  loadClient(_client: Client): void {
    // クライアント設定が必要な場合は各サービスに委譲
    this.logger.log('Discord クライアントが設定されました')
  }

  // 重複したコマンド登録処理を削除
  // CommandManagerServiceで一元管理されるため不要
}
