/**
 * Character UI Utilities
 *
 * CharacterUIService から抽出した discord.js の送信/編集 I/O に依存しない純粋ロジック群。
 * - Embed データ（タイトル / 説明 / 色 / フィールド）の構築
 * - 通知メッセージ文言の整形
 * - チャンネルステータス表示テキストの構築
 * - SelectMenu / ActionRow（discord.js 値オブジェクト）の構築
 *
 * discord.js のビルダー（EmbedBuilder / StringSelectMenuBuilder / ActionRowBuilder）の
 * 生成は行うが、channel.fetch / send / edit などの I/O には一切依存しない。
 */

import { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } from 'discord.js'
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
// P1-D slice1: customId 生成を feature-local 契約モジュールへ集約（byte-identical・挙動不変）
import { CharacterSectionCustomId, CharacterFieldCustomId } from '../custom-id'

/**
 * Embed 構築に必要なギルド情報
 */
export interface GuildInfo {
  id: string
  name: string
  memberCount: number
  channels: Array<{ id: string; name: string; type: string }>
}

/**
 * Embed のプレーンデータ（discord.js 非依存）
 */
export interface EmbedData {
  title: string
  description: string
  color: number
  fields: Array<{
    name: string
    value: string
    inline: boolean
  }>
}

/**
 * createOrUpdateCharacterEmbed / updateCharacterEmbed などで使う
 * 既存キャラクター Embed 判定に用いるタイトルキーワード
 */
export const CHARACTER_EMBED_TITLE_KEYWORD = 'キャラクター情報'

/** セクション選択メニューの customId プレフィックス（単一の真実源は custom-id 契約モジュール・値は不変） */
export const SECTION_SELECT_CUSTOM_ID_PREFIX = CharacterSectionCustomId.sectionSelectPrefix

/** updateFields → 表示名の対応表（通知メッセージ用） */
const UPDATED_FIELD_LABELS: Record<string, string> = {
  characterName: 'キャラクター名',
  status: 'ステータス',
  skill: 'スキル',
  level: 'レベル',
  hp: 'HP',
  mp: 'MP'
}

/** セクションタイプ → 表示名の対応表（フィールド選択メニュー用） */
const SECTION_NAMES: Record<string, string> = {
  status: 'ステータス',
  parameter: 'パラメータ',
  skill: 'スキル',
  item: 'アイテム'
}

/** セクション選択メニューの共通オプション（4セクション） */
const SECTION_OPTIONS = [
  { label: '📊 ステータス', value: 'status', description: '基本ステータスを編集' },
  { label: '⚙️ パラメータ', value: 'parameter', description: '能力値やパラメータを編集' },
  { label: '⚔️ スキル', value: 'skill', description: '技能や特技を編集' },
  { label: '🎒 アイテム', value: 'item', description: '装備品やアイテムを編集' }
]

/** 「戻る」オプション + 4セクションのオプション */
const SECTION_OPTIONS_WITH_BACK = [
  { label: '⬅️ セクション選択に戻る', value: 'back', description: 'メインのセクション選択画面に戻ります' },
  ...SECTION_OPTIONS
]

/**
 * キャラクター情報 Embed のプレーンデータを構築する（純粋関数）。
 *
 * status / skill は JSON 文字列 or オブジェクトの双方を受け付け、
 * パース失敗時は文字列としてフィールド化する（現挙動を保存）。
 */
export function buildCharacterEmbedData(character: CharacterEntity, guildInfo: GuildInfo): EmbedData {
  const fields: Array<{ name: string; value: string; inline: boolean }> = []

  // 基本情報
  if (character.characterName) {
    fields.push({ name: 'キャラクター名', value: character.characterName, inline: true })
  }

  // ステータス情報
  if (character.status) {
    try {
      const statusObj = typeof character.status === 'string' ? JSON.parse(character.status) : character.status
      Object.entries(statusObj).forEach(([key, value]) => {
        if (value) {
          fields.push({ name: key, value: String(value), inline: true })
        }
      })
    } catch {
      fields.push({ name: 'ステータス', value: String(character.status), inline: false })
    }
  }

  // スキル情報
  if (character.skill) {
    try {
      const skillObj = typeof character.skill === 'string' ? JSON.parse(character.skill) : character.skill
      const skillText = Object.entries(skillObj)
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')

      if (skillText) {
        fields.push({ name: 'スキル', value: skillText, inline: false })
      }
    } catch {
      fields.push({ name: 'スキル', value: String(character.skill), inline: false })
    }
  }

  return {
    title: `🎭 キャラクター情報 - ${character.characterName || '未設定'}`,
    description: `サーバー: ${guildInfo.name}\nチャンネル: <#${character.discordChannelId}>`,
    color: 0x00ff00,
    fields
  }
}

/**
 * EmbedData から EmbedBuilder を生成する（純粋・I/O非依存）。
 *
 * @param withTimestamp タイムスタンプを付与するか（呼び出し元ごとの差異を保存）
 */
export function buildCharacterEmbed(embedData: EmbedData, withTimestamp = false): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(embedData.title)
    .setDescription(embedData.description)
    .setColor(embedData.color)
    .addFields(embedData.fields)

  if (withTimestamp) {
    embed.setTimestamp()
  }

  return embed
}

/**
 * キャラクター更新完了通知メッセージを構築する（純粋関数）。
 */
export function buildCharacterUpdateNotificationMessage(
  character: CharacterEntity,
  updatedFields: string[],
  userId?: string
): string {
  const fieldNames = updatedFields.map((field) => UPDATED_FIELD_LABELS[field] ?? field).join(', ')

  return userId
    ? `<@${userId}> 「${character.characterName}」の${fieldNames}が更新されました！✨`
    : `「${character.characterName}」の${fieldNames}が更新されました！✨`
}

/**
 * キャラクター削除完了通知メッセージを構築する（純粋関数）。
 */
export function buildCharacterDeletionNotificationMessage(characterName: string, userId?: string): string {
  return userId
    ? `<@${userId}> キャラクター「${characterName}」が削除されました。`
    : `キャラクター「${characterName}」が削除されました。`
}

/**
 * チャンネルステータス表示（トピック）テキストを構築する（純粋関数）。
 *
 * status は JSON 文字列 or オブジェクト双方を受け付け、パース失敗時は名前のみ（現挙動を保存）。
 */
export function buildChannelStatusText(character: CharacterEntity): string {
  let statusText = `🎭 ${character.characterName}`

  if (character.status) {
    try {
      const statusObj = typeof character.status === 'string' ? JSON.parse(character.status) : character.status
      if (statusObj.hp) statusText += ` | HP: ${statusObj.hp}`
      if (statusObj.mp) statusText += ` | MP: ${statusObj.mp}`
      if (statusObj.level) statusText += ` | Lv: ${statusObj.level}`
    } catch {
      // JSON parse失敗時は無視（名前のみ）
    }
  }

  return statusText
}

/**
 * セクション選択メニュー（編集セクション選択）を構築する（純粋・I/O非依存）。
 */
export function buildSectionSelectMenu(characterId: string): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(CharacterSectionCustomId.createSectionSelect(characterId))
    .setPlaceholder('編集するセクションを選択')
    .addOptions(SECTION_OPTIONS)
}

/**
 * 「戻る」を含むセクション選択メニューを構築する（純粋・I/O非依存）。
 */
export function buildSectionSelectMenuWithBack(characterId: string): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(CharacterSectionCustomId.createSectionSelect(characterId))
    .setPlaceholder('別のセクションを選択するか戻る')
    .addOptions(SECTION_OPTIONS_WITH_BACK)
}

/**
 * フィールド選択メニューを構築する（純粋・I/O非依存）。
 * 未知のセクションタイプは null を返す（現挙動を保存）。
 */
export function buildFieldSelectMenu(sectionType: string, characterId: string): StringSelectMenuBuilder | null {
  const sectionName = SECTION_NAMES[sectionType]
  if (!sectionName) return null

  return new StringSelectMenuBuilder()
    .setCustomId(CharacterFieldCustomId.createEdit(sectionType, characterId))
    .setPlaceholder(`編集する${sectionName}を選択`)
    .addOptions([
      {
        label: `➕ 新しい${sectionName}を追加`,
        value: 'add_new',
        description: `新しい${sectionName}項目を追加します`
      },
      {
        label: '🔧 編集機能準備中',
        value: 'coming_soon',
        description: '詳細な編集機能は準備中です'
      }
    ])
}

/**
 * StringSelectMenuBuilder を ActionRow にラップする（純粋・I/O非依存）。
 */
export function toSelectMenuRow(menu: StringSelectMenuBuilder): ActionRowBuilder<StringSelectMenuBuilder> {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)
}

/** customId がキャラクターセクション選択のものか判定する（純粋関数）。 */
export function isSectionSelectCustomId(customId: string): boolean {
  return customId.startsWith(SECTION_SELECT_CUSTOM_ID_PREFIX)
}

/** セクション選択 customId から characterId を抽出する（純粋関数）。 */
export function extractCharacterIdFromSectionSelect(customId: string): string {
  return customId.replace(SECTION_SELECT_CUSTOM_ID_PREFIX, '')
}
