/**
 * スキルロールの純粋ロジック util
 *
 * thread-interaction.service（スキルボタン生成）と character-skill-roll.handler（クリック処理）の
 * 双方が共有する「skillKey → 表示名 / スキル値」の解決ロジックを集約する。
 * discord.js / NestJS DI に依存しない純粋関数のみ。
 */

import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { getDisplayNumber, isAttributeNumberParts, isAttributeValue } from '../../../../core/types/attribute.types'

/**
 * スキル値オブジェクトからスキルレベル文字列を抽出する（純粋）。
 *
 * - AttributeValue: values 内の全 number part を表示規則と同様に合算
 * - legacy number-parts object: 読み出し境界の正規化前フォールバックとして同じ規則で合算
 *   （character-attribute.mapper.ts は未知キーを TypeError で拒否するため、正規化済みの本番経路では到達しない）
 * - number: そのまま文字列化
 * - string: 最初の連続数字
 * - それ以外 / 解決不能: null
 */
export function extractSkillLevel(skillValue: unknown): string | null {
  if (!skillValue) return null

  if (isAttributeValue(skillValue) && skillValue.values !== undefined && Object.keys(skillValue.values).length > 0) {
    return String(getDisplayNumber(skillValue))
  }
  if (isAttributeNumberParts(skillValue)) {
    return String(getDisplayNumber({ values: skillValue }))
  }
  if (typeof skillValue === 'number') {
    return String(skillValue)
  }
  if (typeof skillValue === 'string') {
    const match = skillValue.match(/\d+/)
    return match ? match[0] : null
  }

  return null
}

export interface ResolvedSkillRoll {
  /** 表示名（skillValue.name があればそれ、無ければ skillKey） */
  skillName: string
  /** スキル判定値（数値化できない場合は 0） */
  skillValue: number
}

/**
 * Character と skillKey から、スキルロールに必要な表示名と判定値を解決する（純粋）。
 *
 * - 対象 skillKey が character.skill に**存在しない場合は null**（呼び出し側でエラー応答とし、
 *   目標値 0 の誤ロール＋DB 保存を防ぐ）。
 * - skillName: 生成側（postSkillRollButtons）と同じく `skillValue?.name || skillKey`。
 * - skillValue: extractSkillLevel の数値化（存在するがレベル解決不能 / NaN は 0）。
 */
export function resolveSkillRoll(character: CharacterEntity, skillKey: string): ResolvedSkillRoll | null {
  const raw = character.skill?.[skillKey] as { name?: string } | undefined
  if (raw === undefined || raw === null) {
    return null
  }

  const skillName = (typeof raw === 'object' && raw.name) || skillKey

  const level = extractSkillLevel(raw)
  const parsed = level != null ? Number(level) : 0
  const skillValue = Number.isFinite(parsed) ? parsed : 0

  return { skillName, skillValue }
}
