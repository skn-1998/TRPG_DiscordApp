/**
 * Channel Manager Util
 *
 * ChannelManagerService から抽出した「純粋ロジック」群。
 * Discord I/O（guild.channels.fetch / guild.channels.cache の取得・instanceof 判定）は
 * 一切持たず、入力（チャンネルの最小スナップショット配列 / 文字列）から
 * 出力（プレーンな選択肢配列 / discord.js Builder）を組み立てるだけ。
 *
 * discord.js の StringSelectMenuOptionBuilder は副作用を持たない値オブジェクト
 * （送信時に初めてシリアライズされる）であり、ここでの生成は純粋関数として扱える。
 */

import { ChannelType, StringSelectMenuOptionBuilder } from 'discord.js'

/** Discord SelectMenu の最大オプション数 */
export const MAX_SELECT_OPTIONS = 25

/**
 * 選別ロジックの入力となるチャンネルの最小スナップショット。
 * discord.js の GuildBasedChannel から必要な属性だけを写し取った純粋なデータ。
 */
export interface ChannelSnapshot {
  id: string
  name: string
  type: ChannelType
  parentId?: string | null
  createdTimestamp?: number | null
}

/** SelectMenu のオプションを表すプレーンな値（Builder へ変換する前段） */
export interface SelectOptionData {
  label: string
  value: string
}

/**
 * チャンネルが「キャラクターカテゴリ」に一致するか判定する純粋 predicate。
 * type === GuildCategory かつ name が categoryNames に含まれる。
 */
export function matchesCharacterCategory(
  channel: Pick<ChannelSnapshot, 'type' | 'name'>,
  categoryNames: readonly string[]
): boolean {
  return channel.type === ChannelType.GuildCategory && categoryNames.includes(channel.name)
}

/**
 * チャンネルが「指定カテゴリ直下のテキストチャンネル」か判定する純粋 predicate。
 * type === GuildText かつ parentId === categoryId。
 */
export function isTextChannelInCategory(
  channel: Pick<ChannelSnapshot, 'type' | 'parentId'>,
  categoryId: string
): boolean {
  return channel.type === ChannelType.GuildText && channel.parentId === categoryId
}

/**
 * テキストチャンネルのスナップショット配列を
 * 「createdTimestamp 降順 → 先頭 limit 件 → {label,value} 整形」した純粋関数。
 *
 * - label = name / value = id（id は String 化して安定させる）
 * - createdTimestamp 未設定は 0 として最後尾に寄せる（元実装と同一）
 * - 入力配列は破壊しない（コピーしてからソート）
 */
export function selectChannelOptions(
  channels: readonly ChannelSnapshot[],
  limit: number = MAX_SELECT_OPTIONS
): SelectOptionData[] {
  return [...channels]
    .sort((a, b) => (b.createdTimestamp ?? 0) - (a.createdTimestamp ?? 0))
    .slice(0, limit)
    .map((channel) => ({ label: channel.name, value: String(channel.id) }))
}

/**
 * プレーンな {label,value} 配列を StringSelectMenuOptionBuilder 配列へ変換する。
 * Builder は値オブジェクトなので副作用なし（純粋）。
 */
export function buildSelectOptions(options: readonly SelectOptionData[]): StringSelectMenuOptionBuilder[] {
  return options.map((option) => new StringSelectMenuOptionBuilder().setLabel(option.label).setValue(option.value))
}

/** 単一のフォールバックオプションを生成する純粋ヘルパ */
export function buildFallbackOption(label: string, value: string): StringSelectMenuOptionBuilder {
  return new StringSelectMenuOptionBuilder().setLabel(label).setValue(value)
}
