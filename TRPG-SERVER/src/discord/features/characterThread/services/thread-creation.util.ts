/**
 * Thread Creation Util
 *
 * ThreadCreationService から抽出した「純粋ロジック」群。
 * Discord I/O（fetch/send/create 等の副作用）は一切持たず、
 * 入力（Character / 文字列）から出力（文字列 / discord.js Builder）を組み立てるだけ。
 *
 * discord.js の *Builder は副作用を持たない値オブジェクト（メッセージ送信時に初めて
 * シリアライズされる）であり、ここでの生成は純粋関数として扱える。
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'

/**
 * スレッド名を生成する（🎭 名前 [YYYY-MM-DD]）
 */
export function buildThreadName(characterName: string, date: Date = new Date()): string {
  const timestamp = date.toISOString().split('T')[0] // YYYY-MM-DD
  return `🎭 ${characterName} [${timestamp}]`
}

/**
 * スレッド URL を生成する
 */
export function buildThreadUrl(guildId: string, channelId: string, threadId: string): string {
  return `https://discord.com/channels/${guildId}/${channelId}/${threadId}`
}

/**
 * キャラクター編集 URL（Discord チャンネル URL）を生成する。
 * 編集は常に元の discordChannelId を使用する。
 */
export function generateCharacterEditUrl(character: Character, guildId: string): string | null {
  const editChannelId = character.discordChannelId
  if (editChannelId) {
    return `https://discord.com/channels/${guildId}/${editChannelId}`
  }
  return null
}

/**
 * キャラクターデータをフォーマット（最大5項目）
 */
export function formatCharacterData(data: Record<string, unknown>): string {
  if (!data || typeof data !== 'object') {
    return ''
  }

  return Object.entries(data)
    .map(([key, value]) => {
      if (value && typeof value === 'object' && 'name' in value && 'value' in value) {
        const typedValue = value as { name: string; value: string | number }
        return `**${typedValue.name}**: ${typedValue.value}`
      }
      return `**${key}**: ${value}`
    })
    .slice(0, 5)
    .join('\n')
}

/**
 * 値から数値を抽出
 */
export function extractNumericValue(value: unknown): number {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'object' && value && 'value' in value) {
    return Number((value as any).value) || 0
  }

  return Number(value) || 0
}

/**
 * thread 用の基本キャラクター Embed を作成（postCharacterInfo と同じ形式）
 */
export function createBasicCharacterEmbed(character: Character, guildId: string): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(`🎭 ${character.characterName}`).setColor(0x00ae86).setTimestamp()

  if (character.gameSystemId) {
    embed.addFields({
      name: '🎲 ゲームシステム',
      value: character.gameSystemId,
      inline: true
    })
  }

  embed.addFields({
    name: '🆔 キャラクターID',
    value: character.characterId,
    inline: true
  })

  if (character.status) {
    const statusText = formatCharacterData(character.status)
    if (statusText) {
      embed.addFields({
        name: '📊 ステータス',
        value: statusText.substring(0, 1024),
        inline: false
      })
    }
  }

  if (character.parameter) {
    const parameterText = formatCharacterData(character.parameter)
    if (parameterText) {
      embed.addFields({
        name: '⚙️ パラメータ',
        value: parameterText.substring(0, 1024),
        inline: false
      })
    }
  }

  const editUrl = generateCharacterEditUrl(character, guildId)
  if (editUrl) {
    embed.addFields({
      name: '✏️ キャラクター編集',
      value: `[こちらから詳細な編集ができます](${editUrl})`,
      inline: false
    })
  }

  return embed
}

/**
 * 詳細キャラクター情報の Embed を作成（編集機能なし）
 */
export function createDetailedCharacterEmbed(character: Character, guildId: string): EmbedBuilder {
  const basicEmbed = new EmbedBuilder()
    .setTitle(`🎭 ${character.characterName} - 詳細情報`)
    .setColor(0x00ae86)
    .setTimestamp()

  if (character.gameSystemId) {
    basicEmbed.addFields({
      name: '🎲 ゲームシステム',
      value: character.gameSystemId,
      inline: true
    })
  }

  basicEmbed.addFields({
    name: '🆔 キャラクターID',
    value: character.characterId,
    inline: true
  })

  if (character.status && Object.keys(character.status).length > 0) {
    const statusText = formatCharacterData(character.status)
    if (statusText) {
      basicEmbed.addFields({
        name: '🩸 ステータス',
        value: statusText.substring(0, 1024),
        inline: false
      })
    }
  }

  if (character.parameter && Object.keys(character.parameter).length > 0) {
    const parameterText = formatCharacterData(character.parameter)
    if (parameterText) {
      basicEmbed.addFields({
        name: '📊 パラメータ',
        value: parameterText.substring(0, 1024),
        inline: false
      })
    }
  }

  if (character.skill && Object.keys(character.skill).length > 0) {
    const skillText = formatCharacterData(character.skill)
    if (skillText) {
      basicEmbed.addFields({
        name: '⚔️ スキル',
        value: skillText.substring(0, 1024),
        inline: false
      })
    }
  }

  if (character.item && Object.keys(character.item).length > 0) {
    const itemText = formatCharacterData(character.item)
    if (itemText) {
      basicEmbed.addFields({
        name: '🎒 アイテム',
        value: itemText.substring(0, 1024),
        inline: false
      })
    }
  }

  const editUrl = generateCharacterEditUrl(character, guildId)
  if (editUrl) {
    basicEmbed.addFields({
      name: '✏️ キャラクター編集',
      value: `[こちらから詳細な編集ができます](${editUrl})`,
      inline: false
    })
  }

  return basicEmbed
}

/**
 * ダイスロールボタンの ActionRow を作成
 */
export function createDiceRollActionRow(): ActionRowBuilder<ButtonBuilder> {
  const diceButtons = [
    new ButtonBuilder().setCustomId('roll*1d100').setLabel('1D100').setStyle(ButtonStyle.Danger).setEmoji('🎲'),
    new ButtonBuilder().setCustomId('roll*1d6').setLabel('1D6').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),
    new ButtonBuilder().setCustomId('roll*2d6').setLabel('2D6').setStyle(ButtonStyle.Secondary).setEmoji('🎲'),
    new ButtonBuilder().setCustomId('roll*custom').setLabel('カスタム').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
  ]

  return new ActionRowBuilder<ButtonBuilder>().addComponents(diceButtons)
}

/**
 * キャラクターデータからパラメータ選択メニューを作成
 */
export function createParameterSelectMenu(character: Character): StringSelectMenuBuilder | null {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`flexible-dice-param*${character.characterId}`)
    .setPlaceholder('計算に使用するパラメータを選択...')
    .setMinValues(1)
    .setMaxValues(1)

  const options: StringSelectMenuOptionBuilder[] = []

  const appendSection = (
    section: Record<string, unknown> | undefined,
    sectionKey: 'status' | 'skill' | 'parameter',
    emoji: string,
    descriptionLabel: string
  ) => {
    if (!section || Object.keys(section).length === 0) {
      return
    }
    for (const [key, value] of Object.entries(section)) {
      let displayName = key
      let displayValue = ''

      if (typeof value === 'object' && value && 'name' in value && 'value' in value) {
        displayName = (value as any).name || key
        displayValue = String((value as any).value || 0)
      } else {
        displayValue = String(value || 0)
      }

      if (parseInt(displayValue) > 0) {
        options.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${emoji} ${displayName} (${displayValue})`)
            .setValue(`${sectionKey}:${key}:${displayValue}`)
            .setDescription(`${descriptionLabel}: ${displayName}を使用`)
        )
      }
    }
  }

  appendSection(character.status, 'status', '📊', 'ステータス')
  appendSection(character.skill, 'skill', '⚔️', 'スキル')
  appendSection(character.parameter, 'parameter', '⚙️', 'パラメータ')

  // カスタム計算オプション
  options.push(
    new StringSelectMenuOptionBuilder()
      .setLabel('🔧 カスタム計算式')
      .setValue('custom:formula:0')
      .setDescription('自由な計算式を入力')
  )

  if (options.length === 0) {
    return null
  }

  // Discord の制限：最大25オプション
  selectMenu.addOptions(...options.slice(0, 25))
  return selectMenu
}

/**
 * プリセットダイスボタンを作成（値の高い順に最大10ボタン）
 */
export function createPresetButtons(character: Character): ButtonBuilder[] {
  const buttons: ButtonBuilder[] = []
  const maxButtons = 10

  const allParameters: Array<{ key: string; value: number; section: string; emoji: string }> = []

  const collect = (section: Record<string, unknown> | undefined, sectionKey: string, emoji: string) => {
    if (!section || Object.keys(section).length === 0) {
      return
    }
    for (const [key, value] of Object.entries(section)) {
      const numericValue = extractNumericValue(value)
      if (numericValue > 0) {
        allParameters.push({ key, value: numericValue, section: sectionKey, emoji })
      }
    }
  }

  collect(character.status, 'status', '📊')
  collect(character.skill, 'skill', '⚔️')
  collect(character.parameter, 'parameter', '⚙️')

  // 値の高い順にソート
  allParameters.sort((a, b) => b.value - a.value)

  for (let i = 0; i < Math.min(allParameters.length, maxButtons); i++) {
    const param = allParameters[i]

    const patterns = [
      { multiplier: 3, label: `×3`, description: `${param.key}×3` },
      { multiplier: 2, label: `×2`, description: `${param.key}×2` }
    ]

    for (const pattern of patterns) {
      if (buttons.length >= maxButtons) break

      const customId = `preset-dice*${character.characterId}*${param.section}*${param.key}*${param.value}*${pattern.multiplier}`

      const button = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(`${param.emoji} ${param.key}${pattern.label}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚡')

      buttons.push(button)
    }
  }

  return buttons
}

/**
 * ButtonBuilder 配列を 5 個ずつ ActionRow に分割する
 */
export function chunkButtonsIntoRows(buttons: ButtonBuilder[]): ActionRowBuilder<ButtonBuilder>[] {
  const actionRows: ActionRowBuilder<ButtonBuilder>[] = []
  for (let i = 0; i < buttons.length; i += 5) {
    const rowButtons = buttons.slice(i, i + 5)
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rowButtons)
    actionRows.push(row)
  }
  return actionRows
}

/**
 * スキルロールボタンの ActionRow 群を作成（character-edit と共有フォーマット）。
 * スキルが無い／全て0以下なら空配列。
 */
export function createSkillRollActionRows(character: Character): ActionRowBuilder<ButtonBuilder>[] {
  if (!character.skill || Object.keys(character.skill).length === 0) {
    return []
  }

  const skillButtons: ButtonBuilder[] = []
  const actionRows: ActionRowBuilder<ButtonBuilder>[] = []
  let buttonCount = 0
  const maxButtonsPerRow = 5
  const maxTotalButtons = 20

  for (const [skillKey, skillData] of Object.entries(character.skill)) {
    if (buttonCount >= maxTotalButtons) break

    let skillName: string
    let skillValue: number

    if (skillData && typeof skillData === 'object') {
      if ('name' in skillData && 'value' in skillData) {
        skillName = (skillData as any).name as string
        skillValue = Number((skillData as any).value) || 0
      } else {
        skillName = skillKey
        skillValue = Number(skillData) || 0
      }
    } else {
      skillName = skillKey
      skillValue = Number(skillData) || 0
    }

    if (skillValue <= 0) continue

    const customId = `roll*_${skillName}-${skillValue}*${character.characterId}`

    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(`${skillName}(${skillValue})`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎯')

    skillButtons.push(button)
    buttonCount++

    if (skillButtons.length === maxButtonsPerRow) {
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skillButtons.splice(0, maxButtonsPerRow))
      actionRows.push(row)
    }
  }

  if (skillButtons.length > 0) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(skillButtons)
    actionRows.push(row)
  }

  return actionRows
}
