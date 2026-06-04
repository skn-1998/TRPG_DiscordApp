/**
 * スキルロールの純粋ロジック util
 *
 * thread-interaction.service（スキルボタン生成）と character-skill-roll.handler（クリック処理）の
 * 双方が共有する「skillKey → 表示名 / スキル値」の解決ロジックを集約する。
 * discord.js / NestJS DI に依存しない純粋関数のみ。
 */

import { Character } from '../../../../domains/character/models/character.model'

/**
 * スキル値オブジェクトからスキルレベル文字列を抽出する（純粋）。
 *
 * 現挙動を保存（旧 thread-interaction.service の private extractSkillLevel と同一）:
 * - AttributeValue（object かつ values あり）: values.level → value → base の順で採用
 * - number: そのまま文字列化
 * - string: 最初の連続数字
 * - それ以外 / 解決不能: null
 */
export function extractSkillLevel(skillValue: unknown): string | null {
  if (!skillValue) return null

  if (typeof skillValue === 'object' && (skillValue as { values?: unknown }).values) {
    const values = (skillValue as { values: Record<string, unknown> }).values
    if (values.level) return String(values.level)
    if (values.value) return String(values.value)
    if (values.base) return String(values.base)
  } else if (typeof skillValue === 'number') {
    return String(skillValue)
  } else if (typeof skillValue === 'string') {
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
 * - skillName: 生成側（postSkillRollButtons）と同じく `skillValue?.name || skillKey`。
 * - skillValue: extractSkillLevel の数値化（解決不能 / NaN は 0）。
 */
export function resolveSkillRoll(character: Character, skillKey: string): ResolvedSkillRoll {
  const raw = character.skill?.[skillKey] as { name?: string } | undefined
  const skillName = (raw && typeof raw === 'object' && raw.name) || skillKey

  const level = extractSkillLevel(raw)
  const parsed = level != null ? Number(level) : 0
  const skillValue = Number.isFinite(parsed) ? parsed : 0

  return { skillName, skillValue }
}
