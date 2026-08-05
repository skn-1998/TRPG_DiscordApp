/**
 * Character UI Utilities
 *
 * CharacterUIService から抽出した discord.js の送信/編集 I/O に依存しない純粋ロジック群。
 * - Embed データ（タイトル / 説明 / 色 / フィールド）の構築
 *
 */

import { EmbedBuilder } from 'discord.js'
import { CharacterEntity } from '../../../../domains/character/models/character.entity'

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
interface EmbedData {
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
 * 既存キャラクター Embed 判定に用いるタイトルキーワード
 */
export const CHARACTER_EMBED_TITLE_KEYWORD = 'キャラクター情報'

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
