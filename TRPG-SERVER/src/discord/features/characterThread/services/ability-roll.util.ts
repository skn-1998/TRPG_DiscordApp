/**
 * 能力(ability)ロールの純粋ロジック util
 *
 * 能力ボタン生成側（S-4 で配線予定）と ability-roll.handler（クリック処理）の双方が共有する
 * 「abilityKey → 表示名 / 能力値」の解決ロジックを集約する。
 * discord.js / NestJS DI に依存しない純粋関数のみ。
 *
 * 能力値は `character.parameter`（skill と同型 `AttributeSection`）から再解決する。
 * 数値化ロジックは skill と同一のため `extractSkillLevel` を skill-roll.util.ts から再利用する。
 * （skill-roll.util.ts の resolveSkillRoll と対称なミラー）
 */

import { Character } from '../../../../domains/character/models/character.model'
import { extractSkillLevel } from './skill-roll.util'

export interface ResolvedAbilityRoll {
  /** 表示名（abilityValue.name があればそれ、無ければ abilityKey） */
  abilityName: string
  /** 能力判定値（数値化できない場合は 0） */
  abilityValue: number
}

/**
 * Character と abilityKey から、能力ロールに必要な表示名と判定値を解決する（純粋）。
 *
 * - 対象 abilityKey が character.parameter に**存在しない場合は null**（呼び出し側でエラー応答とし、
 *   目標値 0 の誤ロール＋DB 保存を防ぐ）。
 * - abilityName: 生成側と同じく `abilityValue?.name || abilityKey`。
 * - abilityValue: extractSkillLevel の数値化（存在するがレベル解決不能 / NaN は 0）。
 */
export function resolveAbilityRoll(character: Character, abilityKey: string): ResolvedAbilityRoll | null {
  const raw = character.parameter?.[abilityKey] as { name?: string } | undefined
  if (raw === undefined || raw === null) {
    return null
  }

  const abilityName = (typeof raw === 'object' && raw.name) || abilityKey

  const level = extractSkillLevel(raw)
  const parsed = level != null ? Number(level) : 0
  const abilityValue = Number.isFinite(parsed) ? parsed : 0

  return { abilityName, abilityValue }
}
