/**
 * Enhanced Character Edit - 純粋関数ユーティリティ
 *
 * discord.js 非依存の整形・分岐判定ロジックを集約する。
 * EnhancedCharacterEditService のオーケストレーションから副作用を持たない
 * 純粋ロジックを切り出し、個別にユニットテスト可能にする。
 */

// customId の生成文字列は契約モジュール（byte 一致の create()）を参照する。
// いずれも純粋モジュールのため、本ファイルの discord.js 非依存は保たれる。
import { CharacterRefreshCustomId } from '../custom-id/character-refresh.custom-id'
import { CharacterCompactCustomId } from '../custom-id/character-compact.custom-id'

const SECTION_TYPES = ['status', 'parameter', 'skill', 'item', 'basic'] as const
export type CharacterEditSectionType = (typeof SECTION_TYPES)[number]

/**
 * カスタムIDからキャラクターIDを抽出（refresh / compact-view パターンのみ）
 *
 * @example
 * extractCharacterIdFromCustomId('character-refresh-abc123') // => 'abc123'
 * extractCharacterIdFromCustomId('character-compact-view-abc123') // => 'abc123'
 * extractCharacterIdFromCustomId('char-edit-status-hp-abc123') // => null
 */
export function extractCharacterIdFromCustomId(customId: string): string | null {
  const patterns = [/character-refresh-(.+)/, /character-compact-view-(.+)/]

  for (const pattern of patterns) {
    const match = customId.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * モーダル送信の customId を分解する。
 *
 * 現挙動: '-' で split し、最後の要素を characterId、parts[2] を sectionType、
 * parts[3] を fieldKey とする。要素が無い場合は 'unknown' を返す。
 * CharacterModalCustomId.parse とは意味論が異なる lossy な第3実装
 * （素朴な split('-')・末尾要素を characterId とする）。イベント payload 用途の現挙動保存であり、
 * 契約 parse への統一は挙動変更を伴うため見送っている。
 *
 * @example
 * parseModalSubmitCustomId('char-edit-status-hp-char-123')
 * // => { characterId: '123', sectionType: 'status', fieldKey: 'hp' }
 */
export function parseModalSubmitCustomId(customId: string): {
  characterId: string
  sectionType: string
  fieldKey: string
} {
  const parts = customId.split('-')
  return {
    characterId: parts[parts.length - 1],
    sectionType: parts[2] || 'unknown',
    fieldKey: parts[3] || 'unknown'
  }
}

/**
 * セクション選択の値を sectionType / fieldKey に分解する。
 *
 * @example
 * parseSectionSelectValue('status-hp') // => { sectionType: 'status', fieldKey: 'hp' }
 * parseSectionSelectValue(undefined) // => { sectionType: 'unknown', fieldKey: 'unknown' }
 */
export function parseSectionSelectValue(selectedValue: string | undefined): {
  sectionType: string
  fieldKey: string
} {
  const [sectionType, fieldKey] = selectedValue?.split('-') || ['unknown', 'unknown']
  return {
    sectionType: sectionType ?? 'unknown',
    fieldKey: fieldKey ?? 'unknown'
  }
}

/**
 * 文字列を既知の sectionType に正規化する。未知の場合は 'basic'。
 */
export function normalizeSectionType(value: string | undefined): CharacterEditSectionType {
  return (SECTION_TYPES as readonly string[]).includes(value ?? '') ? (value as CharacterEditSectionType) : 'basic'
}

/**
 * Discord メッセージのコンポーネント行集合が、指定キャラクターの
 * characterEdit ボタン（refresh / compact-view）を含むか判定する純粋関数。
 *
 * discord.js の Message 型に依存しないよう、判定に必要な最小構造のみを引数に取る。
 */
export interface ComponentLike {
  type?: number
  customId?: string | null
}
export interface ComponentRowLike {
  components?: ComponentLike[]
}
export interface MessageLike {
  author: { bot: boolean }
  components: ComponentRowLike[]
}

/**
 * ボット発・かつ characterEdit ボタンを含むメッセージかを判定する。
 *
 * 現挙動: ボタン(type=2) で customId が
 * `character-refresh-{characterId}` または `character-compact-view-{characterId}`
 * を含むものがあれば true。
 */
export function messageHasCharacterEditButtons(message: MessageLike, characterId: string): boolean {
  if (!message.author.bot) return false

  return message.components.some(
    (row) =>
      !!row.components &&
      row.components.some((component) => {
        if (component.type !== 2) return false // Button type = 2
        const customId = component.customId
        return (
          !!customId &&
          (customId.includes(CharacterRefreshCustomId.create(characterId)) ||
            customId.includes(CharacterCompactCustomId.create(characterId)))
        )
      })
  )
}
