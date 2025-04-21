import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction
} from 'discord.js';

/**
 * Discord相互作用の基本インターフェース
 * コマンド、ボタン、モーダル、セレクトメニューなどの共通の基盤
 */
export interface DiscordInteraction {
  /**
   * 相互作用のID（一意の識別子）
   */
  readonly id: string;
  
  /**
   * 相互作用の名前
   */
  readonly name: string;
  
  /**
   * 相互作用の説明
   */
  readonly description?: string;
  
  /**
   * 相互作用の実行処理
   * @param interaction Discordの相互作用オブジェクト
   */
  execute(interaction: CommandInteraction | ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction): Promise<void>;
  
  /**
   * オートコンプリートの処理（オプション）
   * @param interaction オートコンプリートの相互作用オブジェクト
   */
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
} 