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
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import {
  EDITABLE_SECTION_DESCRIPTORS,
  EDITABLE_SECTION_TYPES,
  getSectionData,
  getSectionDescriptor,
  getSectionDisplayName as getDescriptorDisplayName,
  type EmbedSectionType
} from './character-section-descriptor'
// P1-D slice1: customId 生成を feature-local 契約モジュールへ集約（byte-identical・挙動不変）
import {
  CharacterSectionCustomId,
  CharacterRefreshCustomId,
  CharacterCompactCustomId,
  CharacterFieldCustomId,
  CharacterCreateCustomId
} from '../custom-id'

export { EDITABLE_SECTION_TYPES, getSectionData }
export type { EmbedSectionType }

/**
 * セクションタイプから日本語表示名を返す（純粋）。
 * back と実行時の未知値は旧 SECTION_NAMES lookup と同じく undefined を返す。
 * 公開上の string 戻り値型は既存 API 互換のため維持する。
 */
export function getSectionDisplayName(sectionType: EmbedSectionType): string
export function getSectionDisplayName(sectionType: EmbedSectionType): string | undefined {
  return sectionType === 'back' ? undefined : getDescriptorDisplayName(sectionType)
}

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

// ============================================================================
// discord.js Builder 構築（純粋関数：入力 → Builder を返すだけ。副作用なし）
// ============================================================================

/**
 * 基本情報 Embed を構築する純粋関数。
 */
export function buildBasicEmbed(character: CharacterEntity): EmbedBuilder {
  const descriptor = getSectionDescriptor('basic')
  const embed = new EmbedBuilder()
    .setTitle(`${descriptor.emoji} ${character.characterName} - ${descriptor.displayName}`)
    .setColor(descriptor.color)
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
    .setCustomId(CharacterSectionCustomId.createEditSection(characterId))
    .setPlaceholder('編集するセクションを選択')
    .addOptions(
      ...EDITABLE_SECTION_DESCRIPTORS.map((descriptor) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(`${descriptor.emoji} ${descriptor.displayName}`)
          .setValue(descriptor.type)
          .setDescription(descriptor.menuDescription)
      )
    )

  const sectionRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sectionSelectMenu)

  // 操作ボタン
  const actionButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CharacterRefreshCustomId.create(characterId))
      .setLabel('🔄 更新')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(CharacterCompactCustomId.create(characterId))
      .setLabel('📋 簡易表示')
      .setStyle(ButtonStyle.Secondary)
  )

  components.push(sectionRow, actionButtons)
  return components
}

/**
 * createSectionedEmbeds の embeds / components 一式を構築する純粋関数。
 * 5 つの Embed（基本/ステータス/パラメータ/スキル/アイテム）と
 * 編集コンポーネントを組み立てて返す。
 */
export function buildSectionedEmbeds(character: CharacterEntity): {
  embeds: EmbedBuilder[]
  components: ActionRowBuilder<any>[]
} {
  const embeds: EmbedBuilder[] = [
    buildBasicEmbed(character),
    ...EDITABLE_SECTION_DESCRIPTORS.map((descriptor) =>
      buildSectionEmbed(
        descriptor.emoji,
        descriptor.displayName,
        descriptor.color,
        character.characterName,
        getSectionData(character, descriptor.type)
      )
    )
  ]

  // 編集用コンポーネントを作成
  const components = buildEditComponents(character.characterId)

  return { embeds, components }
}

/**
 * 特定セクションのフィールド選択メニューを構築する純粋関数。
 * データが無ければ追加専用メニュー、あれば追加 + 既存編集メニューを返す。
 * 未知のセクションタイプは null。表示整形は buildFieldOptionDisplay に委譲。
 */
export function buildFieldSelectMenu(
  character: CharacterEntity,
  sectionType: EmbedSectionType,
  characterId: string
): StringSelectMenuBuilder | null {
  if (!EDITABLE_SECTION_TYPES.some((editableSectionType) => editableSectionType === sectionType)) {
    return null
  }

  const data = getSectionData(character, sectionType)
  const sectionName = getSectionDisplayName(sectionType)

  if (!data || Object.keys(data).length === 0) {
    // データがない場合は追加専用メニュー
    return new StringSelectMenuBuilder()
      .setCustomId(CharacterFieldCustomId.createAdd(sectionType, characterId))
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
    .setCustomId(CharacterFieldCustomId.createEdit(sectionType, characterId))
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
    .setCustomId(CharacterCreateCustomId.createBasic(channelId, userId))
    .setLabel('📝 基本情報入力')
    .setStyle(ButtonStyle.Primary)

  const cancelButton = new ButtonBuilder()
    .setCustomId(CharacterCreateCustomId.createCancel(channelId, userId))
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
export function buildCharacterCreatedEmbed(character: CharacterEntity): EmbedBuilder {
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
