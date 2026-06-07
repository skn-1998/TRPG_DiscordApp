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

import { EmbedBuilder } from 'discord.js'
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
