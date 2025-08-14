/**
 * Character Thread Service
 *
 * キャラクター指定でのTRPGキャラクター表示機能を提供
 * 疎結合な設計により、表示タイプを指定してfeatures/に委譲
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  ActionRowBuilder,
  CacheType,
  CommandInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ApplicationCommandOptionType
} from 'discord.js'
import { discordCommandType } from 'src/discord/discord.type'
import { createCharacterThreadConfig } from '../commands.list'
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/shared/application/typed-event.service'
import { CharacterService } from 'src/domains/character/character.service'

@Injectable()
export class CharacterThreadService extends BaseCommandService implements discordCommandType {
  constructor(
    private readonly characterService: CharacterService,
    typedEventService: TypedEventService
  ) {
    super(typedEventService, CharacterThreadService.name)
  }

  public data = new SlashCommandBuilder()
    .setName(createCharacterThreadConfig.name)
    .setDescription(createCharacterThreadConfig.description)

  async execute(interaction: CommandInteraction<CacheType>): Promise<void> {
    if (!(await this.preExecute(interaction))) return

    this.logger.log(`Character thread command executed by: ${interaction.user.id}`)

    try {
      // 基本チェック
      if (!interaction.guild || !interaction.channel) {
        await interaction.reply({
          content: '❌ このコマンドはサーバー内でのみ使用できます。',
          ephemeral: true
        })
        return
      }

      // 現在のチャンネルIDに関連するキャラクター選択メニューを表示
      await this.displayChannelCharacterSelectionMenu(interaction)

      await this.postExecute(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'キャラクタースレッド作成コマンド')
    }
  }

  /**
   * キャラクター選択メニューを表示（現行仕様）
   * AI.discord.md準拠: commands層は薄いアダプタとして機能
   */
  private async displayChannelCharacterSelectionMenu(interaction: CommandInteraction<CacheType>): Promise<void> {
    try {
      // ユーザーのキャラクター一覧を取得
      const allCharacters = await this.characterService.findHavingAll(interaction.user.id)

      // 現行仕様: 全キャラクターを表示（チャンネル制限なし）
      if (allCharacters.length === 0) {
        await interaction.reply({
          content: '❌ キャラクターが見つかりませんでした。\n先にキャラクターを作成してください。',
          ephemeral: true
        })
        return
      }

      // キャラクター選択メニューを作成
      const selectMenu = this.createCharacterSelectMenu(allCharacters)
      const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await interaction.reply({
        content: `🎭 キャラクターを選択してスレッドを作成してください：`,
        components: [actionRow],
        ephemeral: true
      })

      this.logger.log(`Displayed ${allCharacters.length} characters for user: ${interaction.user.id}`)
    } catch (error) {
      this.logger.error('Failed to display character selection menu', error)
      await interaction.reply({
        content: '❌ キャラクター取得中にエラーが発生しました。',
        ephemeral: true
      })
    }
  }

  /**
   * キャラクター選択メニューを作成（現行仕様）
   */
  private createCharacterSelectMenu(
    characters: Array<{ characterName?: string; characterId: string; gameSystemId?: string }>
  ): StringSelectMenuBuilder {
    const options = characters.slice(0, 25).map((character) => ({
      label: character.characterName || 'Unknown Character',
      value: character.characterId,
      description: `${character.gameSystemId || 'Unknown System'} - ID: ${character.characterId}`,
      emoji: '🎭'
    }))

    // スレッド作成専用のcustomId（現行仕様）
    const customId = 'character-thread-create-select'

    return new StringSelectMenuBuilder()
      .setCustomId(customId)
      .setPlaceholder('キャラクターを選択してスレッドを作成...')
      .addOptions(options)
  }

  // ===============================================
  // 古い処理（コメントアウト - 参考用）
  // ===============================================

  /**
   * [廃止] チャンネル制限付きキャラクター選択
   * 理由: AI.discord.md方針変更により、commands層は薄いアダプタに統一
   * 現行: 全キャラクター表示 → features/側でビジネスロジック処理
   */
  /*
  private async displayChannelCharacterSelectionMenuLegacy(
    interaction: CommandInteraction<CacheType>
  ): Promise<void> {
    const currentChannelId = interaction.channel!.id

    try {
      const allCharacters = await this.characterService.findHavingAll(interaction.user.id)
      
      // 旧仕様: チャンネルIDフィルタリング
      const channelCharacters = allCharacters.filter(character => 
        character.discordChannelId === currentChannelId
      )

      if (channelCharacters.length === 0) {
        await interaction.reply({
          content: '❌ このチャンネルに関連するキャラクターが見つかりませんでした。',
          ephemeral: true
        })
        return
      }
      
      // 以下処理継続...
    } catch (error) {
      // エラーハンドリング...
    }
  }
  */

  // 選択後の処理はfeatures側のOrchestratorまたはSelectServiceに委譲
}
