/**
 * Character Thread Service
 *
 * /features/characterThread の実装を統合
 * 完全なキャラクタースレッド作成機能を提供
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  ActionRowBuilder,
  CacheType,
  CommandInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from 'discord.js'
import { discordCommandType } from 'src/discord/discord.type'
import { createCharacterThreadConfig } from '../commands.list'
import { BaseCommandService } from '../base-command.service'
import { TypedEventService } from 'src/shared/application/typed-event.service'
import { CharacterService } from 'src/domains/character/character.service'
// Command層はルーティングのみ。ビジネスロジックはfeatures側に集約

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

      // ユーザーのキャラクター一覧を取得
      const characters = await this.characterService.findHavingAll(interaction.user.id)

      if (characters.length === 0) {
        await interaction.reply({
          content: '❌ キャラクターが見つかりませんでした。まずキャラクターを作成してください。',
          ephemeral: true
        })
        return
      }

      // キャラクター選択メニューを表示
      const selectMenu = this.createCharacterSelectMenu(characters)
      const actionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await interaction.reply({
        content: '🎭 スレッドを作成するキャラクターを選択してください：',
        components: [actionRow],
        ephemeral: true
      })

      await this.postExecute(interaction)
    } catch (error) {
      await this.handleInteractionError(interaction, error, 'キャラクタースレッド作成コマンド')
    }
  }

  /**
   * キャラクター選択メニューを作成
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

    return new StringSelectMenuBuilder()
      .setCustomId('character-thread-select')
      .setPlaceholder('キャラクターを選択してください...')
      .addOptions(options)
  }

  // 選択後の処理はfeatures側のOrchestratorに委譲
}
