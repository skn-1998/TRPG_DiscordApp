/**
 * Character Embed Utilities
 *
 * CharacterEmbedManagerService から抽出した discord.js 非依存の純粋関数群。
 * AttributeValue の合算・整形などの表示ロジックを、副作用なしで決定的に提供する。
 */

import { randomBytes } from 'crypto'
import { AttributeValue, getDisplayNumber } from '../../../../core/types/attribute.types'

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
