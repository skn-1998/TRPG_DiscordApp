import {
  SlashCommandBuilder,
  ButtonBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  CommandInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  ContextMenuCommandBuilder
} from 'discord.js'
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

/**
 * コンテキストメニューコマンドのインターフェース
 */
export interface DiscordContextMenu extends DiscordInteraction {
  /**
   * コンテキストメニューコマンドのデータ
   */
  data: ContextMenuCommandBuilder

  /**
   * コンテキストメニューの実行処理
   * @param interaction コマンドの相互作用オブジェクト
   */
  execute(interaction: CommandInteraction): Promise<void>
}

/**
 * ボタンのインターフェース
 */
export interface DiscordButton extends DiscordInteraction {
  /**
   * ボタンのデータ
   */
  data: ButtonBuilder

  /**
   * ボタンの実行処理
   * @param interaction ボタンの相互作用オブジェクト
   */
  execute(interaction: ButtonInteraction): Promise<void>
}

/**
 * セレクトメニューのインターフェース
 */
export interface DiscordSelectMenu extends DiscordInteraction {
  /**
   * セレクトメニューのデータ
   */
  data: StringSelectMenuBuilder

  /**
   * セレクトメニューの実行処理
   * @param interaction セレクトメニューの相互作用オブジェクト
   * @param config 追加設定（オプション）
   */

  execute(interaction: AnySelectMenuInteraction, config?: any): Promise<void>
}

/**
 * モーダルのインターフェース
 */
export interface DiscordModal extends DiscordInteraction {
  /**
   * モーダルのデータ
   */
  data: ModalBuilder

  /**
   * モーダルの実行処理
   * @param interaction モーダルの相互作用オブジェクト
   */
  execute(interaction: ModalSubmitInteraction): Promise<void>
}
