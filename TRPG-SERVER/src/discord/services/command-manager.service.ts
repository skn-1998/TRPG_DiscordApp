import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { REST, Routes, AutocompleteInteraction, CommandInteraction, MessageFlags } from 'discord.js'
import { DiscordClientService } from './discord-client.service'
import { DiscordCommand } from '../interfaces/discord-interaction-types.interface'
import { CommandsService } from '../commands/commands.service'
import { AppConfigService } from '../../config/config.service'
/**
 * コマンドマネージャーサービス
 * Discord Bot のコマンド管理、登録、実行を担当
 */
@Injectable()
export class CommandManagerService implements OnModuleInit {
  private readonly logger = new Logger(CommandManagerService.name)
  private readonly commands = new Map<string, DiscordCommand>()
  private readonly rest: REST

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly appConfigService: AppConfigService,
    private readonly commandsService: CommandsService
  ) {
    const discordToken = this.appConfigService.get('discord.token')
    if (!discordToken) {
      throw new Error('Discord token is not configured')
    }
    this.rest = new REST({ version: '10' }).setToken(discordToken)
  }

  /**
   * モジュール初期化時に呼び出される
   */
  async onModuleInit(): Promise<void> {
    // コマンド登録は DiscordCommandRegistrationService 完了後に手動で呼び出す
    // await this.registerCommands()
  }

  /**
   * コマンドを登録する
   * @param command コマンド
   */
  registerCommand(command: DiscordCommand): void {
    this.logger.log(`コマンド「${command.name}」を登録しています`)
    this.commands.set(command.data.name, command)
  }

  /**
   * コマンドを取得する
   * @param name コマンド名
   * @returns コマンド、または見つからない場合はundefined
   */
  getCommand(name: string): DiscordCommand | undefined {
    return this.commands.get(name)
  }

  /**
   * コマンドリストを取得する
   * @returns 登録されているすべてのコマンドの配列
   */
  getCommands(): DiscordCommand[] {
    return Array.from(this.commands.values())
  }

  /**
   * コマンド相互作用を処理する
   * @param interaction コマンド相互作用
   */
  async handleCommandInteraction(interaction: CommandInteraction): Promise<void> {
    const command = this.getCommand(interaction.commandName)

    if (!command) {
      this.logger.warn(`未登録のコマンド「${interaction.commandName}」が呼び出されました`)
      await interaction.reply({
        content: '不明なコマンドです。管理者に問い合わせてください。',
        flags: MessageFlags.Ephemeral
      })
      return
    }

    try {
      await command.execute(interaction)
    } catch (error) {
      this.logger.error(`コマンド「${interaction.commandName}」の実行中にエラーが発生しました`)
      if (error instanceof Error) {
        this.logger.error(error.message)
      }

      const replyOptions = {
        content: 'コマンドの実行中にエラーが発生しました。',
        flags: MessageFlags.Ephemeral as const
      }

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyOptions)
      } else {
        await interaction.reply(replyOptions)
      }
    }
  }

  /**
   * オートコンプリート相互作用を処理する
   * @param interaction オートコンプリート相互作用
   */
  async handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {
    await this.commandsService.autocomplete(interaction)
  }

  /**
   * Discord APIにコマンドを登録する（外部から呼び出し可能）
   */
  async registerCommandsToDiscord(): Promise<void> {
    await this.registerCommands()
  }

  /**
   * コマンドをDiscordに登録する
   */
  private async registerCommands(): Promise<void> {
    if (this.commands.size === 0) {
      this.logger.warn('登録するコマンドがありません')
      return
    }

    try {
      const applicationId = this.appConfigService.get('discord.applicationId')
      const guildId = this.appConfigService.get('discord.guildId')
      console.log(applicationId, guildId)

      if (!applicationId) {
        throw new Error('Discord Application IDが設定されていません')
      }

      const commandsData = this.getCommands().map((command) => command.data.toJSON())

      this.logger.log(`${commandsData.length}個のコマンドを登録しています...`)

      // ギルドIDが設定されている場合はギルド専用コマンドとして登録
      if (guildId) {
        await this.rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: commandsData })
        this.logger.log(`ギルド「${guildId}」にコマンドを登録しました`)
      } else {
        // グローバルコマンドとして登録
        await this.rest.put(Routes.applicationCommands(applicationId), { body: commandsData })
        this.logger.log('グローバルコマンドを登録しました')
      }
    } catch (error) {
      this.logger.error('コマンドの登録に失敗しました')
      if (error instanceof Error) {
        this.logger.error(error.message)
      }
      throw error
    }
  }
}
