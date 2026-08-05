/**
 * Character Modal Handler Utilities
 *
 * character-modal-handler.service.ts から抽出した純粋ロジック。
 * discord.js / NestJS DI に依存せず、入力 → 出力の変換・解析・バリデーションのみを担う。
 * 副作用（reply/update・イベント発行・セッション取得）はサービス側に残す。
 */
import { UpdateCharacterDto } from '../../../../domains/character/dto/update-character.dto'
import { AttributeValueDto } from '../../../../domains/character/dto/create-character.dto'
import { AttributeValue } from '../../../../core/types/attribute.types'
import { EmbedSectionType } from './character-embed-manager.service'
import { CharacterModalCustomId } from '../custom-id/character-modal.custom-id'
import { CharacterCreateCustomId } from '../custom-id/character-create.custom-id'

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

/**
 * モーダル customId を解析する（純粋）。
 * - セッション形式: char-edit-modal-{sessionId}
 * - レガシー形式  : char-edit-{sectionType}-{fieldKey}-{characterId...}
 */
export function parseEditCustomId(customId: string): ParsedEditCustomId {
  const parsed = CharacterModalCustomId.parse(customId)

  if (parsed.kind !== 'legacy') {
    return parsed
  }

  return { ...parsed, sectionType: parsed.sectionType as EmbedSectionType }
}

/**
 * 作成モーダルの customId を解析する（純粋）。
 * character-create-basic-{channelId}-{userId}
 */
export function parseCreationCustomId(customId: string): {
  channelId: string | null
  userId: string | null
} {
  return CharacterCreateCustomId.parseBasic(customId)
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
export interface BuiltAttributeValue extends AttributeValue {
  name: string
  values: Record<string, number>
  isVisible: boolean
}

/**
 * フォームの値から、実際のフィールドキーと AttributeValue を構築する（純粋）。
 *
 * - fieldKey === 'add_new' の場合は formData.name（無ければ new_{now}）を使用
 * - finalName は formData.name、既存 name、actualFieldKey の順で決定
 * - 数値欄が空なら values を空にし、非空かつ非有限なら null を返す
 * - 既存フィールドでは有限値の入力時だけ base 以外の values part を維持
 * - 既存フィールドの index / isVisible は数値入力にかかわらず維持
 * - 新規フィールドでは従来どおり入力値を values.base にセット
 * - 旧実装は description/dice がある項目では `{}` を保存して values を消していたが、サイレントな消失を避けるため中止（`null`）に倒した
 *
 * @param now Date.now() 相当（テスト容易性のため注入）
 * @param existingAttributeValue 編集対象の既存 AttributeValue（新規または未保存なら undefined）
 * @returns 非空の数値欄が非有限なら null。それ以外は構築結果
 */
export function buildAttributeValueFromForm(
  fieldKey: string,
  formData: FieldData,
  now: number,
  existingAttributeValue?: AttributeValue
): { actualFieldKey: string; attributeValue: BuiltAttributeValue } | null {
  const isNewField = fieldKey === 'add_new'

  // フィールドキーを決定（新規の場合はフォームの名前を使用）
  const actualFieldKey = isNewField ? formData.name || `new_${now}` : fieldKey
  const existingValue = isNewField ? undefined : existingAttributeValue

  // nameの決定: フォーム、既存値、フィールドキーの順で使用
  const finalName = formData.name?.trim() || existingValue?.name || actualFieldKey

  const submittedValues = formData.values?.trim()
  let valuesObj: Record<string, number> = {}

  if (submittedValues) {
    const numericValue = Number(submittedValues)
    if (!Number.isFinite(numericValue)) {
      return null
    }

    valuesObj = Object.fromEntries(
      Object.entries(existingValue?.values ?? {}).filter(([partName]) => partName !== 'base')
    )
    const nonBaseTotal = Object.values(valuesObj).reduce(
      (sum, partValue) => sum + (typeof partValue === 'number' && Number.isFinite(partValue) ? partValue : 0),
      0
    )

    // core/types/attribute.types.ts の getDisplayNumber が行う合算の逆算側。
    // 送信時点の既存 non-base part を基準に合計を入力値へ合わせるため、モーダル表示後に
    // applyDiscordDelta で other が増減していても入力値へ吸収され、その増分だけ base が減る。
    // 非 base の合計が入力値を超える場合も base の負数を許容し、合計を壊す 0 クランプは行わない。
    valuesObj.base = numericValue - nonBaseTotal
  }

  // extractFieldEditValues が既存の description / dice を初期表示するのは、values を持つ AttributeValue に限る。
  // その場合の空欄は意図的クリアとして扱う。values がない項目では初期表示されず、既存値は復元されない。
  const attributeValue: BuiltAttributeValue = {
    name: finalName,
    values: valuesObj,
    ...(existingValue?.index !== undefined ? { index: existingValue.index } : {}),
    ...(formData.description ? { description: formData.description } : {}),
    ...(formData.dice ? { dice: formData.dice } : {}),
    isVisible: existingValue?.isVisible ?? true
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
