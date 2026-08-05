/**
 * Character Section Editor - 純粋関数ユーティリティ
 *
 * CharacterSectionEditorService から、副作用を持たない整形・分岐判定ロジックを切り出す。
 * NestJS DI や副作用に依存せず、引数と戻り値だけで完結する。
 *
 * 配置方針（ARCHITECTURE.md 準拠）:
 * - getDisplayNumber は core/types に依存する純ヘルパ（discord.js import 無し）。
 * - セクション表示名は ../utils/character-embed.util.ts の正本を参照する。
 * - EmbedSectionType 型に触れるためサービスと同じ characterEdit/services/ 配下に置く。
 */

import { getDisplayNumber, AttributeValue } from '../../../../core/types/attribute.types'
import { EmbedSectionType } from './character-embed-manager.service'
import {
  CHARACTER_FIELD_EDIT_CUSTOM_ID_PREFIX,
  CHARACTER_FIELD_ADD_CUSTOM_ID_PREFIX,
  characterFieldSectionInfix
} from '../custom-id/character-field.custom-id'
import { CharacterModalCustomId } from '../custom-id/character-modal.custom-id'
import { getSectionDisplayName } from '../utils/character-embed.util'

/**
 * フィールド編集モーダルに流し込む既存値。
 */
export interface FieldEditValues {
  /** 項目名（表示名 or fieldKey フォールバック） */
  fieldName: string
  /** 数値欄に入れる値（合算値 or 数値文字列） */
  currentValues: string
  /** ダイス記法欄に入れる値 */
  currentDice: string
  /** 説明・備考欄に入れる値 */
  currentDescription: string
}

/** セクションデータの 1 フィールドが取り得る型（AttributeValue / レガシー name+value / プリミティブ） */
type SectionFieldValue = unknown

/**
 * セクションデータと fieldKey から、編集モーダル用の既存値を抽出する（純粋）。
 *
 * 現挙動を保存した 3 分岐:
 * 1. AttributeValue 形式（`values` が object）: name / 合算値 / dice / description を振り分け
 * 2. レガシー name+value 形式（object で name & value を持つ）: value が数値なら数値欄、非数値なら説明欄
 * 3. プリミティブ値: 数値なら数値欄、非数値なら説明欄
 *
 * sectionData が無い / fieldKey が存在しない場合は空文字＋fieldName=fieldKey を返す。
 *
 * @param sectionData セクション（status/parameter/skill/item）のプレーンオブジェクト
 * @param fieldKey 対象フィールドキー
 */
export function extractFieldEditValues(
  sectionData: Record<string, SectionFieldValue> | undefined,
  fieldKey: string
): FieldEditValues {
  let fieldName = ''
  let currentValues = ''
  let currentDice = ''
  let currentDescription = ''

  if (sectionData && fieldKey in sectionData) {
    const fieldValue = sectionData[fieldKey]

    if (typeof fieldValue === 'object' && fieldValue !== null) {
      const attr = fieldValue as Record<string, unknown>

      if (attr.values && typeof attr.values === 'object') {
        // 1. AttributeValue 形式
        fieldName = (typeof attr.name === 'string' && attr.name) || fieldKey

        if (Object.keys(attr.values).length > 0) {
          const total = getDisplayNumber(attr as AttributeValue)
          currentValues = String(total)
        }

        if (attr.dice) {
          currentDice = String(attr.dice)
        }

        if (attr.description) {
          currentDescription = String(attr.description)
        }
      } else if ('name' in attr && 'value' in attr) {
        // 2. レガシー name+value 形式
        const fv = attr as { name?: unknown; value?: unknown }
        fieldName = (typeof fv.name === 'string' && fv.name) || fieldKey

        const numericValue = parseFloat(String(fv.value ?? ''))
        if (!isNaN(numericValue)) {
          currentValues = String(numericValue)
        } else {
          currentDescription = String(fv.value ?? '')
        }
      }
    } else {
      // 3. プリミティブ値
      const numericValue = parseFloat(String(fieldValue))
      if (!isNaN(numericValue)) {
        currentValues = String(numericValue)
      } else {
        currentDescription = String(fieldValue)
      }
    }
  }

  fieldName = fieldName || fieldKey

  return { fieldName, currentValues, currentDice, currentDescription }
}

/**
 * カスタムIDからセクションタイプを抽出する（純粋）。
 * `-status-` 等の中置部分文字列で判定（中置の正本は契約 characterFieldSectionInfix・byte 同一）。
 * 該当無しは null。
 */
export function extractSectionFromCustomId(customId: string): EmbedSectionType | null {
  if (customId.includes(characterFieldSectionInfix('status'))) return 'status'
  if (customId.includes(characterFieldSectionInfix('parameter'))) return 'parameter'
  if (customId.includes(characterFieldSectionInfix('skill'))) return 'skill'
  if (customId.includes(characterFieldSectionInfix('item'))) return 'item'
  return null
}

/**
 * フィールド操作（編集 / 追加）の customId かを判定する（純粋）。
 * true の場合は deferUpdate せず modal を表示する分岐。
 *
 * 判定は契約 prefix（末尾ハイフン付き）の includes。旧実装のハイフン無し literal からの
 * 引き締めだが、生成側（createEdit/createAdd）は常に末尾ハイフン付きのため生成集合上で等価
 * （差分は 'character-field-editorial' 等の非生成形のみ・spec で負例 pin）。
 */
export function isFieldOperationCustomId(customId: string): boolean {
  return (
    customId.includes(CHARACTER_FIELD_EDIT_CUSTOM_ID_PREFIX) || customId.includes(CHARACTER_FIELD_ADD_CUSTOM_ID_PREFIX)
  )
}

/**
 * 短い characterId（8 文字以下）に対する直接 modal customId を生成する（純粋）。
 *
 * @example buildDirectModalId('status', 'hp', 'abc123') // 'char-edit-status-hp-abc123'
 */
export function buildDirectModalId(sectionType: EmbedSectionType, fieldKey: string, characterId: string): string {
  return CharacterModalCustomId.createDirect(sectionType, fieldKey, characterId)
}

/**
 * session ベース modal customId を生成する（純粋）。
 *
 * @example buildSessionModalId('SESSION99') // 'char-edit-modal-SESSION99'
 */
export function buildSessionModalId(sessionId: string): string {
  return CharacterModalCustomId.createSession(sessionId)
}

/**
 * characterId が直接 modalId 方式（短いID）かを判定する（純粋）。
 * 8 文字以下なら直接、超過なら session 採番（副作用）。
 */
export function shouldUseDirectModalId(characterId: string): boolean {
  return characterId.length <= 8
}

/**
 * モーダルタイトルを生成する（純粋）。
 *
 * @example buildModalTitle('status', true) // 'ステータス追加'
 * @example buildModalTitle('status', false) // 'ステータス編集'
 */
export function buildModalTitle(sectionType: EmbedSectionType, isNew: boolean): string {
  return `${getSectionDisplayName(sectionType)}${isNew ? '追加' : '編集'}`
}

/**
 * Discord TextInput の説明欄向けにサニタイズする（純粋）。
 * trim し、1000 文字超過なら先頭 997 文字 + '...' に切り詰める。
 *
 * 現挙動: setValue 直前のサニタイズ。空文字（trim 後）はそのまま返す
 * （サービス側で trim 後の空判定をしているため呼び出し側で扱う）。
 */
export function sanitizeDescriptionValue(description: string): string {
  const trimmed = description.trim()
  if (trimmed.length > 1000) {
    return trimmed.substring(0, 997) + '...'
  }
  return trimmed
}
