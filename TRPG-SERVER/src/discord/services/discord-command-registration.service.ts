import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { CommandManagerService } from './command-manager.service'
import { CommandsService } from '../commands/commands.service'
import { DiscordCommand } from '../interfaces/discord-interaction-types.interface'
import { SlashCommandBuilder } from 'discord.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Discord コマンド登録サービス
 * CommandsServiceからCommandManagerServiceへコマンドを登録する
 */
@Injectable()
export class DiscordCommandRegistrationService implements OnModuleInit {
  private readonly logger = new Logger(DiscordCommandRegistrationService.name)

  constructor(
    private readonly commandManagerService: CommandManagerService,
    private readonly commandsService: CommandsService
  ) {}

  /**
   * モジュール初期化時にコマンドを登録
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Discordコマンドを登録します...')
    this.registerCommands()

    // コマンド登録完了後にDiscord APIに登録
    await this.commandManagerService.registerCommandsToDiscord()
  }

  /**
   * CommandsServiceのコマンドをCommandManagerServiceに登録
   */
  private registerCommands(): void {
    // CommandsServiceからコマンドインスタンスを取得
    const commands = this.commandsService.getCommands()

    if (commands.length === 0) {
      this.logger.warn('登録可能なコマンドが見つかりません')
      return
    }

    // コマンドをCommandManagerServiceに登録
    for (const command of commands) {
      try {
        if (!command || !command.data || !command.data.name) {
          this.logger.warn('不正なコマンド形式がスキップされました')
          continue
        }

        // SlashCommandBuilderに対応したデータを持っているか確認
        if (command.data.toJSON && typeof command.data.toJSON === 'function') {
          // DiscordCommand形式に変換
          const discordCommand: DiscordCommand = {
            id: uuidv4(), // 一意のIDを生成
            name: command.data.name,
            description: '',
            data: command.data as unknown as Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>,
            execute: command.execute.bind(command)
          }

          // コマンドマネージャーに登録
          this.commandManagerService.registerCommand(discordCommand)
          this.logger.log(`コマンド '${command.data.name}' を登録しました`)
        }
      } catch (error) {
        this.logger.error(`コマンドの登録に失敗しました`)
        if (error instanceof Error) {
          this.logger.error(error.message)
        }
      }
    }
  }
}
