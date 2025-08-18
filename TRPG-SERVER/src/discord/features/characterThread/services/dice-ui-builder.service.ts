import { Injectable, Logger } from '@nestjs/common'
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ThreadChannel } from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { AttributeValue, getDisplayNumber } from '../../../../core/types/attribute.types'
import { isNull } from 'lodash'

/**
 * ダイスUI構築サービス
 *
 * 責務：
 * - ダイスロールボタンの作成
 * - スキル・能力値ボタンの生成
 * - UI要素の配置・管理
 */
@Injectable()
export class DiceUIBuilderService {
  private readonly logger = new Logger(DiceUIBuilderService.name)

  constructor() {
    this.logger.debug('Dice UI builder service initialized')
  }

  /**
   * キャラクター用のダイスボタンを作成してスレッドに投稿
   */
  async createDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      if (character.discordUserId == null) {
        this.logger.warn(`No discord user ID for character: ${character.characterName}`)
        return
      }

      // スキルロールボタン（上位5件のスキル）
      const skillButtons = this.createSkillButtons(character)

      // 能力値ロールボタン（上位5件の能力値）
      const abilityButtons = this.createAbilityButtons(character)

      // 一般的なダイスロールボタン
      const diceButtons = this.createGeneralDiceButtons()

      // ボタンをスレッドに投稿
      await thread.send({
        content: '**技能ロール**',
        components: [skillButtons]
      })

      await thread.send({
        content: '**能力値ロール**',
        components: [abilityButtons]
      })

      await thread.send({
        content: '**ダイスロール**',
        components: [diceButtons]
      })

      this.logger.debug(`Dice buttons created for character: ${character.characterName}`)
    } catch (error) {
      this.logger.error(`Failed to create dice buttons: ${error}`)
      await thread.send({ content: 'ダイスボタンの作成中にエラーが発生しました' })
      throw error
    }
  }

  /**
   * スキルロールボタンを作成
   */
  private createSkillButtons(character: Character): ActionRowBuilder<ButtonBuilder> {
    const skillButtons = new ActionRowBuilder<ButtonBuilder>()

    if (character.skill && Object.keys(character.skill).length > 0) {
      const skillItems = Object.entries(character.skill)
        .map(([name, value]) => ({ name, value: value as AttributeValue }))
        .sort((a, b) => getDisplayNumber(b.value) - getDisplayNumber(a.value)) // 値が大きい順にソート
        .slice(0, 5) // 上位5件を取得

      skillItems.forEach((skill, index) => {
        const skillVal = getDisplayNumber(skill.value)
        if (isNull(skillVal)) return

        if (index < 5) {
          // 最大5つまでボタンを作成
          skillButtons.addComponents(
            new ButtonBuilder()
              .setCustomId(`roll*_${skill.name}-${skillVal}`)
              .setLabel(`${skill.name}(${skillVal}%)`)
              .setStyle(ButtonStyle.Secondary)
          )
        }
      })
    }

    return skillButtons
  }

  /**
   * 能力値ロールボタンを作成
   */
  private createAbilityButtons(character: Character): ActionRowBuilder<ButtonBuilder> {
    const abilityButtons = new ActionRowBuilder<ButtonBuilder>()

    const abilityItems = Object.entries(character.parameter ?? {})
      .map(([name, value]) => ({ name, value: value as AttributeValue }))
      .sort((a, b) => getDisplayNumber(b.value) - getDisplayNumber(a.value))
      .slice(0, 5) // 上位5件を取得

    abilityItems.forEach((ability) => {
      const abilityVal = getDisplayNumber(ability.value)
      if (isNull(abilityVal)) return

      abilityButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`roll*_${ability.name}-${abilityVal}`)
          .setLabel(`${ability.name}(${abilityVal})`)
          .setStyle(ButtonStyle.Success)
      )
    })

    return abilityButtons
  }

  /**
   * 一般的なダイスロールボタンを作成
   */
  private createGeneralDiceButtons(): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('roll*1d100').setLabel('1D100').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('roll*1d20').setLabel('1D20').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('roll*1d6').setLabel('1D6').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('roll*2d6').setLabel('2D6').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('roll*custom').setLabel('カスタム').setStyle(ButtonStyle.Danger)
    )
  }

  /**
   * カスタムダイスボタンセットを作成
   */
  createCustomDiceButtons(
    customDiceTypes: Array<{
      label: string
      customId: string
      style?: ButtonStyle
    }>
  ): ActionRowBuilder<ButtonBuilder> {
    const buttons = new ActionRowBuilder<ButtonBuilder>()

    customDiceTypes.forEach((diceType) => {
      buttons.addComponents(
        new ButtonBuilder()
          .setCustomId(diceType.customId)
          .setLabel(diceType.label)
          .setStyle(diceType.style || ButtonStyle.Secondary)
      )
    })

    return buttons
  }

  /**
   * スキル選択ボタンを作成（最大25個まで）
   */
  createSkillSelectionButtons(character: Character): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = []

    if (!character.skill || Object.keys(character.skill).length === 0) {
      return rows
    }

    const skillItems = Object.entries(character.skill)
      .map(([name, value]) => ({ name, value: value as AttributeValue }))
      .sort((a, b) => getDisplayNumber(b.value) - getDisplayNumber(a.value))
      .slice(0, 25) // Discord制限：最大25個

    // 5個ずつの行に分割
    for (let i = 0; i < skillItems.length; i += 5) {
      const row = new ActionRowBuilder<ButtonBuilder>()
      const group = skillItems.slice(i, i + 5)

      group.forEach((skill) => {
        const skillVal = getDisplayNumber(skill.value)
        if (!isNull(skillVal)) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`skill_select_${skill.name}_${skillVal}`)
              .setLabel(`${skill.name}(${skillVal})`)
              .setStyle(ButtonStyle.Primary)
          )
        }
      })

      if (row.components.length > 0) {
        rows.push(row)
      }
    }

    return rows
  }

  /**
   * ダイスボタンのカスタムIDを解析
   */
  parseDiceButtonCustomId(customId: string): {
    type: 'skill' | 'ability' | 'general' | 'custom'
    name?: string
    value?: number
    diceExpression?: string
  } {
    if (customId.startsWith('roll*_')) {
      // スキル・能力値ロール
      const parts = customId.replace('roll*_', '').split('-')
      return {
        type: parts[0].match(/\d+/) ? 'ability' : 'skill',
        name: parts[0],
        value: parseInt(parts[1]) || 0
      }
    } else if (customId.startsWith('roll*')) {
      // 一般的なダイスロール
      const diceExpression = customId.replace('roll*', '')
      return {
        type: diceExpression === 'custom' ? 'custom' : 'general',
        diceExpression
      }
    }

    return { type: 'general' }
  }

  /**
   * ボタンUIの統計情報を取得
   */
  getButtonStats(character: Character): {
    skillButtonCount: number
    abilityButtonCount: number
    totalButtons: number
  } {
    const skillCount = character.skill ? Math.min(Object.keys(character.skill).length, 5) : 0
    const abilityCount = character.parameter ? Math.min(Object.keys(character.parameter).length, 5) : 0
    const generalCount = 5 // 固定の一般ダイスボタン数

    return {
      skillButtonCount: skillCount,
      abilityButtonCount: abilityCount,
      totalButtons: skillCount + abilityCount + generalCount
    }
  }
}
