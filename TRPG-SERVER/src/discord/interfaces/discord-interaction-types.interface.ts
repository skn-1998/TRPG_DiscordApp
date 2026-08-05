import { SlashCommandBuilder, CommandInteraction } from 'discord.js'
import { DiscordInteraction } from './discord-interaction.interface'

/**
 * スラッシュコマンドのインターフェース
 */
export interface DiscordCommand extends DiscordInteraction {
  /**
   * スラッシュコマンドのデータ
   */
  data: Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>

  /**
   * コマンドの実行処理
   * @param interaction コマンドの相互作用オブジェクト
   */
  execute(interaction: CommandInteraction): Promise<void>
}
