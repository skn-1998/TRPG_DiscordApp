/**
 * Character Embed Utilities
 *
 * CharacterEmbedManagerService から抽出した純粋関数群。
 *
 * - 前半: discord.js 非依存の表示ロジック（AttributeValue の合算・整形）。
 * - 後半: discord.js の各種 Builder（Embed / ActionRow / SelectMenu / Button）を
 *   入力（Character 等）から決定的に構築する純粋関数。副作用（channel.send / emit）は
 *   含まず、Builder を返すだけ。§12 の通り discord.js 依存のため feature 配下に置く。
 */

import { randomBytes } from 'crypto'
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedField
} from 'discord.js'
import { AttributeValue, getDisplayNumber } from '../../../../core/types/attribute.types'
import { Character } from '../../../../domains/character/models/character.model'

/**
 * Embed 分割タイプ
 */
export type EmbedSectionType = 'status' | 'skill' | 'parameter' | 'basic' | 'item' | 'back'

/**
 * Embed フィールドのプレーンデータ（discord.js EmbedField 互換）
 */
export interface EmbedFieldData {
  name: string
  value: string
  inline: boolean
}

/**
 * フィールド選択メニュー用のオプション表示データ
 */
export interface FieldOptionDisplay {
  /** 表示名（StringSelectMenuOption の label に使う元） */
  displayName: string
  /** 説明文（StringSelectMenuOption の description に使う） */
  displayValue: string
}

const SHORT_ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'

/**
 * 短いキャラクターIDを生成（8文字）
 */
export function generateShortCharacterId(): string {
  let result = ''
  const bytes = randomBytes(8)

  for (let i = 0; i < 8; i++) {
    result += SHORT_ID_CHARS[bytes[i] % SHORT_ID_CHARS.length]
  }

  return result
}

/**
 * 単一の属性値を Embed フィールド表示用の文字列へ整形する。
 * 文字列・数値などのプリミティブはそのまま String 化する。
 */
export function formatAttributeFieldValue(value: unknown): string {
  if (typeof value === 'object' && value !== null) {
    const attr = value as AttributeValue
    const valueParts: string[] = []

    // values（合計値）がある場合
    if (attr.values && Object.keys(attr.values).length > 0) {
      const totalValue = getDisplayNumber(attr)
      valueParts.push(`**合計:** ${totalValue}`)

      // 詳細内訳を表示（基本値、バフ等）
      const detailParts: string[] = []
      Object.entries(attr.values).forEach(([partKey, partValue]) => {
        if (typeof partValue === 'number' && partValue !== 0) {
          detailParts.push(`${partKey}: ${partValue > 0 ? '+' : ''}${partValue}`)
        }
      })

      if (detailParts.length > 0) {
        valueParts.push(`(${detailParts.join(', ')})`)
      }
    }

    // dice（ダイス）がある場合
    if (attr.dice) {
      valueParts.push(`🎲 **ダイス:** ${attr.dice}`)
    }

    // description（説明）がある場合
    if (attr.description) {
      valueParts.push(`💬 ${attr.description}`)
    }

    return valueParts.length > 0 ? valueParts.join('\n') : '値が設定されていません'
  }

  return String(value)
}

/**
 * キャラクターデータ（section）を処理して Embed フィールド配列を作成する純粋関数。
 * 元の processCharacterData と同じ挙動（name 優先・空値スキップ・文字数制限）を保持する。
 */
export function buildAttributeFields(data: Record<string, any>): EmbedFieldData[] {
  const fields: EmbedFieldData[] = []

  for (const [key, value] of Object.entries(data)) {
    if (!value || value === null || value === undefined) {
      continue
    }

    let fieldName: string = key

    // AttributeValue型の場合は name プロパティを優先
    if (typeof value === 'object' && value !== null) {
      const attr = value as AttributeValue
      fieldName = attr.name || key
    }

    let fieldValue = formatAttributeFieldValue(value)

    // 空の値をスキップ
    if (!fieldValue || fieldValue.trim() === '' || fieldValue === 'undefined') continue

    // Discord Embed field length limits
    if (fieldName.length > 256) fieldName = fieldName.substring(0, 253) + '...'
    if (fieldValue.length > 1024) fieldValue = fieldValue.substring(0, 1021) + '...'

    fields.push({
      name: fieldName,
      value: fieldValue,
      inline: true
    })
  }

  return fields
}

/**
 * フィールド選択メニューのオプション表示（label / description）を構成する純粋関数。
 * 元の createFieldSelectMenu 内ロジックと同じ挙動（AttributeValue / レガシー形式 /
 * その他オブジェクト / プリミティブ）を保持する。100文字での短縮も行う。
 */
export function buildFieldOptionDisplay(key: string, value: unknown): FieldOptionDisplay {
  let displayName = key
  let displayValue = String(value)

  if (typeof value === 'object' && value !== null) {
    const attr = value as AttributeValue

    if (attr.values && typeof attr.values === 'object') {
      // AttributeValue形式の場合
      displayName = attr.name || key

      const displayParts: string[] = []

      if (Object.keys(attr.values).length > 0) {
        const totalValue = getDisplayNumber(attr)
        displayParts.push(`合計: ${totalValue}`)
      }

      if (attr.dice) {
        displayParts.push(`ダイス: ${attr.dice}`)
      }

      if (attr.description) {
        displayParts.push(attr.description)
      }

      displayValue = displayParts.length > 0 ? displayParts.join(' | ') : '設定値なし'
    } else if (attr.name && 'value' in value) {
      // レガシー形式の場合
      displayName = attr.name || key
      displayValue = String((value as { value?: unknown }).value || '値なし')
    } else {
      // その他のオブジェクト形式
      displayName = key
      displayValue = 'オブジェクト形式'
    }
  }

  // 表示用に短縮
  if (displayName.length > 100) displayName = displayName.substring(0, 97) + '...'
  if (displayValue.length > 100) displayValue = displayValue.substring(0, 97) + '...'

  return { displayName, displayValue }
}

/**
 * ダイスロールボタン用に、データ項目から表示名とロール値を抽出する純粋関数。
 * 元の addDiceRollButtonsFromData の判定ロジックと同じ挙動を保持する。
 */
export function extractDiceRollValue(key: string, value: unknown): { name: string; rollValue: number } {
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('name' in obj && 'value' in obj) {
      return { name: obj.name as string, rollValue: Number(obj.value) || 0 }
    }
    return { name: key, rollValue: Number(value as any) || 0 }
  }
  return { name: key, rollValue: Number(value as any) || 0 }
}

// ============================================================================
// discord.js Builder 構築（純粋関数：入力 → Builder を返すだけ。副作用なし）
// ============================================================================

/**
 * 基本情報 Embed を構築する純粋関数。
 */
export function buildBasicEmbed(character: Character): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🏷️ ${character.characterName} - 基本情報`)
    .setColor('#3498db')
    .setTimestamp()

  const fields: EmbedField[] = []

  if (character.gameSystemId) {
    fields.push({
      name: '🎲 ゲームシステム',
      value: character.gameSystemId,
      inline: true
    })
  }

  fields.push(
    {
      name: '🆔 キャラクターID',
      value: character.characterId,
      inline: true
    },
    {
      name: '👤 プレイヤー',
      value: `<@${character.discordUserId}>`,
      inline: true
    }
  )

  embed.addFields(...fields)
  return embed
}

/**
 * セクション別 Embed（status/parameter/skill/item 共通）を構築する純粋関数。
 * フィールド整形は buildAttributeFields に委譲し、25 件制限を考慮する。
 */
export function buildSectionEmbed(
  emoji: string,
  sectionName: string,
  color: `#${string}`,
  characterName: string,
  data: Record<string, any> | undefined
): EmbedBuilder {
  const embed = new EmbedBuilder().setTitle(`${emoji} ${characterName} - ${sectionName}`).setColor(color).setTimestamp()

  if (!data || Object.keys(data).length === 0) {
    embed.setDescription(`${sectionName}情報がありません。\n編集ボタンから追加してください。`)
    return embed
  }

  const fields = buildAttributeFields(data)

  if (fields.length > 0) {
    // Discord Embed の 25 フィールド制限を考慮
    embed.addFields(...fields.slice(0, 24))

    if (fields.length > 24) {
      embed.setFooter({ text: `${fields.length - 24}個の${sectionName}が省略されています` })
    }
  } else {
    embed.setDescription(`表示可能な${sectionName}情報がありません。`)
  }

  return embed
}

/**
 * 編集用コンポーネント（セクション選択メニュー + 操作ボタン）を構築する純粋関数。
 */
export function buildEditComponents(characterId: string): ActionRowBuilder<any>[] {
  const components: ActionRowBuilder<any>[] = []

  // セクション選択メニュー
  const sectionSelectMenu = new StringSelectMenuBuilder()
    .setCustomId(`character-edit-section-${characterId}`)
    .setPlaceholder('編集するセクションを選択')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('📊 ステータス')
        .setValue('status')
        .setDescription('基本ステータスを編集'),
      new StringSelectMenuOptionBuilder()
        .setLabel('⚙️ パラメータ')
        .setValue('parameter')
        .setDescription('能力値やパラメータを編集'),
      new StringSelectMenuOptionBuilder().setLabel('⚔️ スキル').setValue('skill').setDescription('技能や特技を編集'),
      new StringSelectMenuOptionBuilder()
        .setLabel('🎒 アイテム')
        .setValue('item')
        .setDescription('装備品やアイテムを編集')
    )

  const sectionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sectionSelectMenu)

  // 操作ボタン
  const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`character-refresh-${characterId}`)
      .setLabel('🔄 更新')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`character-compact-view-${characterId}`)
      .setLabel('📋 簡易表示')
      .setStyle(ButtonStyle.Secondary)
  )

  components.push(sectionRow, actionButtons)
  return components
}

/**
 * 指定データから、ダイスロールボタンを buttons 配列へ追加する純粋関数。
 * extractDiceRollValue で表示名・ロール値を判定し、0 以下はスキップする。
 * 追加後の buttonCount を返す（元の addDiceRollButtonsFromData と同挙動）。
 */
export function appendDiceRollButtonsFromData(
  data: Record<string, any>,
  sectionName: string,
  emoji: string,
  characterId: string,
  buttons: ButtonBuilder[],
  buttonCount: number,
  maxTotalButtons: number
): number {
  for (const [key, value] of Object.entries(data)) {
    if (buttonCount >= maxTotalButtons) break

    // データの形式を判定（純粋関数へ委譲）
    const { name, rollValue } = extractDiceRollValue(key, value)

    // ロール値が0以下の場合はスキップ
    if (rollValue <= 0) continue

    // ダイスロールボタンを作成
    // customId形式: roll*_{name}-{rollValue}*{characterId}
    const customId = `roll*_${name}-${rollValue}*${characterId}`

    const button = new ButtonBuilder()
      .setCustomId(customId)
      .setLabel(`${name}(${rollValue})`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji(emoji)

    buttons.push(button)
    buttonCount++
  }

  return buttonCount
}

/**
 * skill / status / parameter に基づくダイスロールボタン行を構築する純粋関数。
 * （現状ロジックでは行分割がコメントアウトされているため、戻り値は空配列のまま。
 *  挙動を変えずに移設している。）
 */
export function buildCharacterDiceRollButtons(character: Character): ActionRowBuilder<ButtonBuilder>[] {
  const buttons: ButtonBuilder[] = []
  const actionRows: ActionRowBuilder<ButtonBuilder>[] = []

  let buttonCount = 0
  const maxTotalButtons = 20 // Discord制限に配慮

  // skillセクションのボタンを生成
  if (character.skill && Object.keys(character.skill).length > 0) {
    buttonCount = appendDiceRollButtonsFromData(
      character.skill,
      'スキル',
      '🎯',
      character.characterId,
      buttons,
      buttonCount,
      maxTotalButtons
    )
  }

  // statusセクションのボタンを生成
  if (character.status && Object.keys(character.status).length > 0) {
    buttonCount = appendDiceRollButtonsFromData(
      character.status,
      'ステータス',
      '📊',
      character.characterId,
      buttons,
      buttonCount,
      maxTotalButtons
    )
  }

  // parameterセクションのボタンを生成
  if (character.parameter && Object.keys(character.parameter).length > 0) {
    appendDiceRollButtonsFromData(
      character.parameter,
      'パラメータ',
      '⚙️',
      character.characterId,
      buttons,
      buttonCount,
      maxTotalButtons
    )
  }

  // // ボタンを行に分割
  // for (let i = 0; i < buttons.length; i += maxButtonsPerRow) {
  //   const rowButtons = buttons.slice(i, i + maxButtonsPerRow)
  //   if (rowButtons.length > 0) {
  //     const row = new ActionRowBuilder<ButtonBuilder>().addComponents(rowButtons)
  //     actionRows.push(row)
  //   }
  // }

  return actionRows
}

/**
 * 基本ダイスロールボタン（1D100/1D6/2D6/カスタム）行を構築する純粋関数。
 */
export function buildBasicDiceButtons(character: Character): ActionRowBuilder<ButtonBuilder> {
  const diceButtons = [
    new ButtonBuilder()
      .setCustomId(`roll*1d100*${character.characterId}`)
      .setLabel('1D100')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🎲'),

    new ButtonBuilder()
      .setCustomId(`roll*1d6*${character.characterId}`)
      .setLabel('1D6')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎲'),

    new ButtonBuilder()
      .setCustomId(`roll*2d6*${character.characterId}`)
      .setLabel('2D6')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🎲'),

    new ButtonBuilder()
      .setCustomId(`roll*custom*${character.characterId}`)
      .setLabel('カスタム')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⚙️')
  ]

  return new ActionRowBuilder<ButtonBuilder>().addComponents(diceButtons)
}

/**
 * createSectionedEmbeds の embeds / components 一式を構築する純粋関数。
 * 5 つの Embed（基本/ステータス/パラメータ/スキル/アイテム）と
 * 編集コンポーネント + ダイスロールボタンを組み立てて返す。
 */
export function buildSectionedEmbeds(character: Character): {
  embeds: EmbedBuilder[]
  components: ActionRowBuilder<any>[]
} {
  const embeds: EmbedBuilder[] = [
    buildBasicEmbed(character),
    buildSectionEmbed('📊', 'ステータス', '#e74c3c', character.characterName, character.status),
    buildSectionEmbed('⚙️', 'パラメータ', '#34495e', character.characterName, character.parameter),
    buildSectionEmbed('⚔️', 'スキル', '#9b59b6', character.characterName, character.skill),
    buildSectionEmbed('🎒', 'アイテム', '#f39c12', character.characterName, character.item)
  ]

  // 編集用コンポーネントを作成
  const components = buildEditComponents(character.characterId)

  // ダイスロールボタンを追加（skill、status、parameterの個別表示のみ）
  const diceRollButtons = buildCharacterDiceRollButtons(character)
  components.push(...diceRollButtons)

  return { embeds, components }
}

/**
 * 特定セクションのフィールド選択メニューを構築する純粋関数。
 * データが無ければ追加専用メニュー、あれば追加 + 既存編集メニューを返す。
 * 未知のセクションタイプは null。表示整形は buildFieldOptionDisplay に委譲。
 */
export function buildFieldSelectMenu(
  character: Character,
  sectionType: EmbedSectionType,
  characterId: string
): StringSelectMenuBuilder | null {
  let data: Record<string, any> | undefined
  let sectionName: string

  switch (sectionType) {
    case 'status':
      data = character.status
      sectionName = 'ステータス'
      break
    case 'parameter':
      data = character.parameter
      sectionName = 'パラメータ'
      break
    case 'skill':
      data = character.skill
      sectionName = 'スキル'
      break
    case 'item':
      data = character.item
      sectionName = 'アイテム'
      break
    default:
      return null
  }

  if (!data || Object.keys(data).length === 0) {
    // データがない場合は追加専用メニュー
    return new StringSelectMenuBuilder()
      .setCustomId(`character-field-add-${sectionType}-${characterId}`)
      .setPlaceholder(`${sectionName}を追加`)
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`➕ 新しい${sectionName}を追加`)
          .setValue('add_new')
          .setDescription(`新しい${sectionName}項目を追加します`)
      )
  }

  // 既存フィールドの編集メニュー
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`character-field-edit-${sectionType}-${characterId}`)
    .setPlaceholder(`編集する${sectionName}を選択`)

  const options: StringSelectMenuOptionBuilder[] = []

  // 新規追加オプション
  options.push(
    new StringSelectMenuOptionBuilder()
      .setLabel(`➕ 新しい${sectionName}を追加`)
      .setValue('add_new')
      .setDescription(`新しい${sectionName}項目を追加します`)
  )

  // 既存フィールドのオプション
  const fieldEntries = Object.entries(data).slice(0, 23) // Discord制限考慮

  for (const [key, value] of fieldEntries) {
    // AttributeValue / レガシー形式の表示整形を純粋関数へ委譲（短縮処理含む）
    const { displayName, displayValue } = buildFieldOptionDisplay(key, value)

    options.push(
      new StringSelectMenuOptionBuilder().setLabel(`✏️ ${displayName}`).setValue(key).setDescription(`${displayValue}`)
    )
  }

  selectMenu.addOptions(...options)
  return selectMenu
}

/**
 * 新規キャラクター作成用の Embed + ボタンを構築する純粋関数。
 */
export function buildNewCharacterEmbed(
  channelId: string,
  userId: string
): {
  embeds: EmbedBuilder[]
  components: ActionRowBuilder<any>[]
} {
  const embed = new EmbedBuilder()
    .setTitle('🆕 新しいキャラクターを作成')
    .setDescription('新しいキャラクターを作成します。\n下のボタンから基本情報を入力してください。')
    .setColor('#2ecc71')
    .setTimestamp()
    .addFields({
      name: '📝 作成手順',
      value: '1️⃣ 「基本情報入力」ボタンをクリック\n2️⃣ キャラクター名とゲームシステムを入力\n3️⃣ 作成後に詳細情報を編集',
      inline: false
    })

  // 作成ボタン
  const createButton = new ButtonBuilder()
    .setCustomId(`character-create-basic-${channelId}-${userId}`)
    .setLabel('📝 基本情報入力')
    .setStyle(ButtonStyle.Primary)

  const cancelButton = new ButtonBuilder()
    .setCustomId(`character-create-cancel-${channelId}-${userId}`)
    .setLabel('❌ キャンセル')
    .setStyle(ButtonStyle.Secondary)

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(createButton, cancelButton)

  return {
    embeds: [embed],
    components: [buttonRow]
  }
}

/**
 * キャラクター作成完了メッセージ Embed を構築する純粋関数。
 */
export function buildCharacterCreatedEmbed(character: Character): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('✅ キャラクター作成完了')
    .setDescription(
      `**${character.characterName}** が正常に作成されました！\n下記のキャラクター情報から詳細を編集できます。`
    )
    .setColor('#27ae60')
    .setTimestamp()
    .addFields(
      {
        name: '🎲 ゲームシステム',
        value: character.gameSystemId || '未設定',
        inline: true
      },
      {
        name: '🆔 キャラクターID',
        value: character.characterId,
        inline: true
      },
      {
        name: '👤 作成者',
        value: `<@${character.discordUserId}>`,
        inline: true
      }
    )
}
