import { Injectable, Logger } from '@nestjs/common'
import {
  ThreadChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
// P1-D slice2: routed な customId 生成を feature-local 契約モジュールの Factory へ集約（byte-identical・挙動不変）
import { FlexibleDiceSelectCustomId, DiceGenericCustomId, SkillRollCustomId, AbilityRollCustomId } from '../custom-id'
// skill 解決ロジックは handler と共有する純粋 util へ集約
import { extractSkillLevel } from './skill-roll.util'

/**
 * スレッドインタラクションサービス
 *
 * 責務：
 * - ボタン・メニューUI要素の作成
 * - インタラクティブ要素の管理
 * - ユーザーインタラクション用コンポーネント提供
 */
@Injectable()
export class ThreadInteractionService {
  private readonly logger = new Logger(ThreadInteractionService.name)

  constructor() {
    this.logger.debug('Thread interaction service initialized')
  }

  /**
   * アクションボタンを投稿
   */
  async postActionButtons(thread: ThreadChannel, channelId: string): Promise<void> {
    try {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`character_edit_${channelId}`)
          .setLabel('キャラクター編集')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('✏️'),
        new ButtonBuilder()
          .setCustomId(`dice_roll_${channelId}`)
          .setLabel('ダイスロール')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎲'),
        new ButtonBuilder()
          .setCustomId(`character_info_${channelId}`)
          .setLabel('詳細情報')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      )

      await thread.send({
        content: '**🎮 アクション**',
        components: [row]
      })

      this.logger.debug(`Action buttons posted to thread: ${thread.id}`)
    } catch (error) {
      this.logger.error(`Failed to post action buttons: ${thread.id}`, error)
      throw error
    }
  }

  /**
   * 基本ダイスボタンを投稿（1d100 / 1d6 / 2d6 の3ボタン1行）
   *
   * routed な `dice_generic_` 契約のみを用いる（custom ボタンは flexible メニューがカバーするため付けない）。
   * channelId は `character.discordChannelId` を採用する。
   */
  async postBasicDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const channelId = character.discordChannelId

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(DiceGenericCustomId.create('1d100', channelId))
          .setLabel('1d100')
          .setStyle(ButtonStyle.Success)
          .setEmoji('🎲'),
        new ButtonBuilder()
          .setCustomId(DiceGenericCustomId.create('1d6', channelId))
          .setLabel('1d6')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎲'),
        new ButtonBuilder()
          .setCustomId(DiceGenericCustomId.create('2d6', channelId))
          .setLabel('2d6')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎲')
      )

      await thread.send({
        content: '🎲 ダイスロール',
        components: [row]
      })

      this.logger.debug(`Basic dice buttons posted to thread: ${thread.id}`)
    } catch (error) {
      this.logger.error(`Failed to post basic dice buttons: ${thread.id}`, error)
      throw error
    }
  }

  /**
   * フレキシブルダイスメニューを投稿
   */
  async postFlexibleDiceMenu(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const diceOptions = [
        { label: '1d6', value: '1d6', description: '6面ダイス1個' },
        { label: '2d6', value: '2d6', description: '6面ダイス2個' },
        { label: '1d10', value: '1d10', description: '10面ダイス1個' },
        { label: '1d20', value: '1d20', description: '20面ダイス1個' },
        { label: '1d100', value: '1d100', description: '100面ダイス1個' },
        { label: 'カスタム', value: 'custom_dice', description: 'カスタムダイス設定' }
      ]

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(FlexibleDiceSelectCustomId.create(character.discordChannelId))
        .setPlaceholder('ダイスタイプを選択してください')
        .addOptions(
          diceOptions.map((option) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(option.label)
              .setValue(option.value)
              .setDescription(option.description)
          )
        )

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)

      await thread.send({
        content: '**🎲 フレキシブルダイス**\n使用するダイスタイプを選択してください：',
        components: [row]
      })

      this.logger.debug(`Flexible dice menu posted to thread: ${thread.id}`)
    } catch (error) {
      this.logger.error(`Failed to post flexible dice menu: ${thread.id}`, error)
      throw error
    }
  }

  /**
   * プリセットダイスボタンを投稿
   */
  async postPresetDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const gameSystem = character.gameSystemId?.toLowerCase() || 'generic'
      let presetButtons: ButtonBuilder[] = []

      // ゲームシステム別のプリセット
      switch (gameSystem) {
        case 'coc7':
        case 'call_of_cthulhu':
          presetButtons = this.createCoC7Buttons(character)
          break
        case 'dnd5e':
        case 'dungeons_and_dragons':
          presetButtons = this.createDnD5eButtons(character)
          break
        case 'sw2.5':
        case 'sword_world':
          presetButtons = this.createSW25Buttons(character)
          break
        default:
          presetButtons = this.createGenericButtons(character)
          break
      }

      // ボタンを5個ずつ行に分割
      const rows: ActionRowBuilder<ButtonBuilder>[] = []
      for (let i = 0; i < presetButtons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(presetButtons.slice(i, i + 5))
        rows.push(row)
      }

      if (rows.length > 0) {
        await thread.send({
          content: '**🎯 プリセットダイス**\nゲームシステム用のクイックダイス：',
          components: rows
        })

        this.logger.debug(`Preset dice buttons posted to thread: ${thread.id}`)
      }
    } catch (error) {
      this.logger.error(`Failed to post preset dice buttons: ${thread.id}`, error)
      throw error
    }
  }

  /**
   * スキルロールボタンを投稿
   */
  async postSkillRollButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      if (!character.skill || Object.keys(character.skill).length === 0) {
        this.logger.debug(`No skills found for character: ${character.characterId}`)
        return
      }

      const skillEntries = Object.entries(character.skill).slice(0, 20) // 最大20個
      const skillButtons: ButtonBuilder[] = []

      skillEntries.forEach(([skillKey, skillValue], _index) => {
        const skillName = skillValue?.name || skillKey
        const skillLevel = extractSkillLevel(skillValue)

        const button = new ButtonBuilder()
          .setCustomId(SkillRollCustomId.create(character.discordChannelId, skillKey))
          .setLabel(`${skillName}${skillLevel ? ` (${skillLevel})` : ''}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎯')

        skillButtons.push(button)
      })

      // ボタンを5個ずつ行に分割
      const rows: ActionRowBuilder<ButtonBuilder>[] = []
      for (let i = 0; i < skillButtons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skillButtons.slice(i, i + 5))
        rows.push(row)
      }

      if (rows.length > 0) {
        await thread.send({
          content: '**🎯 スキルロール**\n使用するスキルを選択してください：',
          components: rows
        })

        this.logger.debug(`Skill roll buttons posted to thread: ${thread.id}`)
      }
    } catch (error) {
      this.logger.error(`Failed to post skill roll buttons: ${thread.id}`, error)
      throw error
    }
  }

  /**
   * 能力(ability)ロールボタンを投稿（postSkillRollButtons の完全ミラー）
   *
   * `character.parameter`（skill と同型 `AttributeSection`）を反復し、
   * `ability_{discordChannelId}_{abilityKey}` 契約のボタンを生成する。
   * 値0以下・parameter 空はスキップし、最大20個・5個ずつの行に分割して送信する。
   */
  async postAbilityRollButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      if (!character.parameter || Object.keys(character.parameter).length === 0) {
        this.logger.debug(`No parameters found for character: ${character.characterId}`)
        return
      }

      const abilityEntries = Object.entries(character.parameter).slice(0, 20) // 最大20個
      const abilityButtons: ButtonBuilder[] = []

      abilityEntries.forEach(([abilityKey, abilityValue], _index) => {
        const abilityName = abilityValue?.name || abilityKey
        const abilityLevel = extractSkillLevel(abilityValue)

        const button = new ButtonBuilder()
          .setCustomId(AbilityRollCustomId.create(character.discordChannelId, abilityKey))
          .setLabel(`${abilityName}${abilityLevel ? ` (${abilityLevel})` : ''}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎯')

        abilityButtons.push(button)
      })

      // ボタンを5個ずつ行に分割
      const rows: ActionRowBuilder<ButtonBuilder>[] = []
      for (let i = 0; i < abilityButtons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(abilityButtons.slice(i, i + 5))
        rows.push(row)
      }

      if (rows.length > 0) {
        await thread.send({
          content: '**🎯 能力ロール**\n使用する能力を選択してください：',
          components: rows
        })

        this.logger.debug(`Ability roll buttons posted to thread: ${thread.id}`)
      }
    } catch (error) {
      this.logger.error(`Failed to post ability roll buttons: ${thread.id}`, error)
      throw error
    }
  }

  /**
   * Call of Cthulhu 7th用ボタン
   */
  private createCoC7Buttons(character: Character): ButtonBuilder[] {
    const channelId = character.discordChannelId || character.characterId

    return [
      new ButtonBuilder()
        .setCustomId(`dice_coc7_1d100_${channelId}`)
        .setLabel('技能判定')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎲'),
      new ButtonBuilder()
        .setCustomId(`dice_coc7_sanity_${channelId}`)
        .setLabel('SAN値判定')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('😱'),
      new ButtonBuilder()
        .setCustomId(`dice_coc7_idea_${channelId}`)
        .setLabel('アイデア')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💡'),
      new ButtonBuilder()
        .setCustomId(`dice_coc7_luck_${channelId}`)
        .setLabel('幸運')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🍀'),
      new ButtonBuilder()
        .setCustomId(`dice_coc7_damage_${channelId}`)
        .setLabel('ダメージ')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥')
    ]
  }

  /**
   * D&D 5e用ボタン
   */
  private createDnD5eButtons(character: Character): ButtonBuilder[] {
    const channelId = character.discordChannelId || character.characterId

    return [
      new ButtonBuilder()
        .setCustomId(`dice_dnd5e_1d20_${channelId}`)
        .setLabel('d20攻撃')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚔️'),
      new ButtonBuilder()
        .setCustomId(`dice_dnd5e_save_${channelId}`)
        .setLabel('セーヴィング・スロー')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛡️'),
      new ButtonBuilder()
        .setCustomId(`dice_dnd5e_ability_${channelId}`)
        .setLabel('能力値判定')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💪'),
      new ButtonBuilder()
        .setCustomId(`dice_dnd5e_damage_${channelId}`)
        .setLabel('ダメージ')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥')
    ]
  }

  /**
   * ソード・ワールド2.5用ボタン
   */
  private createSW25Buttons(character: Character): ButtonBuilder[] {
    const channelId = character.discordChannelId || character.characterId

    return [
      new ButtonBuilder()
        .setCustomId(`dice_sw25_2d6_${channelId}`)
        .setLabel('2d6判定')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎲'),
      new ButtonBuilder()
        .setCustomId(`dice_sw25_attack_${channelId}`)
        .setLabel('命中判定')
        .setStyle(ButtonStyle.Success)
        .setEmoji('⚔️'),
      new ButtonBuilder()
        .setCustomId(`dice_sw25_damage_${channelId}`)
        .setLabel('ダメージ')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('💥'),
      new ButtonBuilder()
        .setCustomId(`dice_sw25_magic_${channelId}`)
        .setLabel('魔法行使')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✨')
    ]
  }

  /**
   * 汎用ボタン
   */
  private createGenericButtons(character: Character): ButtonBuilder[] {
    const channelId = character.discordChannelId || character.characterId

    return [
      new ButtonBuilder()
        .setCustomId(DiceGenericCustomId.create('1d6', channelId))
        .setLabel('1d6')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎲'),
      new ButtonBuilder()
        .setCustomId(DiceGenericCustomId.create('2d6', channelId))
        .setLabel('2d6')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎲'),
      new ButtonBuilder()
        .setCustomId(DiceGenericCustomId.create('1d20', channelId))
        .setLabel('1d20')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎲'),
      new ButtonBuilder()
        .setCustomId(DiceGenericCustomId.create('1d100', channelId))
        .setLabel('1d100')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎲')
    ]
  }
}
