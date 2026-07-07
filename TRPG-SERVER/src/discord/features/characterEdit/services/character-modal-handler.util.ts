/**
 * Character Modal Handler Utilities
 *
 * character-modal-handler.service.ts から抽出した純粋ロジック。
 * discord.js / NestJS DI に依存せず、入力 → 出力の変換・解析・バリデーションのみを担う。
 * 副作用（reply/update・イベント発行・セッション取得）はサービス側に残す。
 */
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { UpdateCharacterDto } from '../../../../domains/character/dto/update-character.dto'
import { AttributeValueDto } from '../../../../domains/character/dto/create-character.dto'
import { EmbedSectionType } from './character-embed-manager.service'

/**
 * フィールドデータ構造
 */
export interface FieldData {
  name?: string
  values?: string
  dice?: string
  description?: string
}

/**
 * モーダル customId の解析結果（編集用）。
 * セッション形式の場合は sessionId を返し、セッション取得は呼び出し側に委ねる。
 */
export type ParsedEditCustomId =
  | { kind: 'session'; sessionId: string }
  | { kind: 'legacy'; characterId: string; sectionType: EmbedSectionType; fieldKey: string }
  | { kind: 'invalid' }

const SESSION_FORMAT_PREFIX = 'char-edit-modal-'
const LEGACY_FORMAT_PREFIX = 'char-edit-'

/**
 * モーダル customId を解析する（純粋）。
 * - セッション形式: char-edit-modal-{sessionId}
 * - レガシー形式  : char-edit-{sectionType}-{fieldKey}-{characterId...}
 */
export function parseEditCustomId(customId: string): ParsedEditCustomId {
  // セッションベース形式
  if (customId.startsWith(SESSION_FORMAT_PREFIX)) {
    const sessionId = customId.slice(SESSION_FORMAT_PREFIX.length)
    return { kind: 'session', sessionId }
  }

  // 従来の形式（後方互換）
  if (customId.startsWith(LEGACY_FORMAT_PREFIX) && !customId.startsWith(SESSION_FORMAT_PREFIX)) {
    const rest = customId.slice(LEGACY_FORMAT_PREFIX.length)
    const parts = rest.split('-')

    if (parts.length < 3) {
      return { kind: 'invalid' }
    }

    const sectionType = parts[0] as EmbedSectionType
    const fieldKey = parts[1]
    const characterId = parts.slice(2).join('-')

    return { kind: 'legacy', characterId, sectionType, fieldKey }
  }

  return { kind: 'invalid' }
}

/**
 * 作成モーダルの customId を解析する（純粋）。
 * character-create-basic-{channelId}-{userId}
 */
export function parseCreationCustomId(customId: string): {
  channelId: string | null
  userId: string | null
} {
  const pattern = /character-create-basic-(.+?)-(.+)$/
  const match = customId.match(pattern)

  if (!match) {
    return { channelId: null, userId: null }
  }

  return {
    channelId: match[1],
    userId: match[2]
  }
}

/**
 * 取り出した raw 文字列群を FieldData へ変換・バリデーションする（純粋）。
 * trim 後に空なら undefined 化し、values/dice/description がすべて空なら null を返す。
 *
 * @param raw getTextInputValue で取得した生値（undefined 可）
 */
export function buildFieldData(raw: {
  name?: string
  values?: string
  dice?: string
  description?: string
}): FieldData | null {
  const name = raw.name?.trim() || undefined
  const values = raw.values?.trim() || undefined
  const dice = raw.dice?.trim() || undefined
  const description = raw.description?.trim() || undefined

  // データの有効性をチェック（values/dice/description のいずれも無ければ無効）
  if (!values && !dice && !description) {
    return null
  }

  return { name, values, dice, description }
}

/**
 * 単一フィールドの AttributeValue を構築する（純粋）。
 */
export interface BuiltAttributeValue {
  name: string
  index: null
  values: Record<string, number>
  description: string | null
  dice: string | null
  isVisible: boolean
}

/**
 * フォームの値から、実際のフィールドキーと AttributeValue を構築する（純粋）。
 *
 * - fieldKey === 'add_new' の場合は formData.name（無ければ new_{now}）を使用
 * - finalName は formData.name があればそれ、無ければ actualFieldKey
 * - values は parseFloat 可能な場合のみ base にセット
 *
 * @param now Date.now() 相当（テスト容易性のため注入）
 */
export function buildAttributeValueFromForm(
  fieldKey: string,
  formData: FieldData,
  now: number
): { actualFieldKey: string; attributeValue: BuiltAttributeValue } {
  // フィールドキーを決定（新規の場合はフォームの名前を使用）
  const actualFieldKey = fieldKey === 'add_new' ? formData.name || `new_${now}` : fieldKey

  // nameの決定: フォームのnameがある場合は使用、なければactualFieldKeyを使用
  const finalName = formData.name && formData.name.trim() !== '' ? formData.name.trim() : actualFieldKey

  // AttributeValue形式でフィールドデータを構築
  const valuesObj: Record<string, number> = {}

  if (formData.values && formData.values.trim() !== '') {
    const numericValue = parseFloat(formData.values.trim())
    if (!isNaN(numericValue)) {
      valuesObj.base = numericValue
    }
  }

  const attributeValue: BuiltAttributeValue = {
    name: finalName,
    index: null,
    values: valuesObj,
    description: formData.description || null,
    dice: formData.dice || null,
    isVisible: true
  }

  return { actualFieldKey, attributeValue }
}

/**
 * 構築した AttributeValue が有効かどうかを判定する（純粋）。
 * name が空、または values/description/dice がすべて空なら無効。
 */
export function isValidAttributeValue(attributeValue: BuiltAttributeValue): boolean {
  if (!attributeValue.name) {
    return false
  }
  if (Object.keys(attributeValue.values).length === 0 && !attributeValue.description && !attributeValue.dice) {
    return false
  }
  return true
}

/**
 * Character から指定セクションのデータを取得する（純粋）。
 */
export function getSectionData(
  character: CharacterEntity,
  sectionType: EmbedSectionType
): Record<string, unknown> | undefined {
  switch (sectionType) {
    case 'status':
      return character.status
    case 'parameter':
      return character.parameter
    case 'skill':
      return character.skill
    case 'item':
      return character.item
    default:
      return undefined
  }
}

/**
 * 更新後のセクションデータから UpdateCharacterDto を構築する（純粋）。
 * 対応していないセクションタイプの場合は null を返す。
 */
export function buildUpdateData(
  sectionType: EmbedSectionType,
  sectionData: Record<string, unknown>
): UpdateCharacterDto | null {
  switch (sectionType) {
    case 'status':
      return { status: sectionData as Record<string, AttributeValueDto> }
    case 'parameter':
      return { parameter: sectionData as Record<string, AttributeValueDto> }
    case 'skill':
      return { skill: sectionData as Record<string, AttributeValueDto> }
    case 'item':
      return { item: sectionData as Record<string, AttributeValueDto> }
    default:
      return null
  }
}
