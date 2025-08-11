/**
 * TRPG Character Attribute Type Definitions
 * AI.character.md の仕様に基づく型定義
 */

/**
 * 合算対象の数値群（自由にキー追加可: base, fluctuation, buff, debuff, temp, other など）
 */
export type AttributeNumberParts = Record<string, number>

/**
 * 属性値の詳細定義
 */
export interface AttributeValue {
  /** 表示名（キーと同じなら省略可） */
  name?: string

  /** 並び順（合算に含めない） */
  index?: number

  /** 合算対象の数値群（index 以外の number はここへ） */
  values?: AttributeNumberParts

  /** 説明・備考 */
  description?: string

  /** UI表示フラグ */
  isVisible?: boolean
}

/**
 * 各セクション（status/skill/parameter/item/description）で共通
 */
export type AttributeSection = Record<string, AttributeValue>

/**
 * 表示用合算値を算出（index は対象外。values の number をすべて合算）
 * @param attr 属性値オブジェクト
 * @returns 合算された表示値
 */
export const getDisplayNumber = (attr: AttributeValue): number =>
  Object.values(attr.values ?? {}).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)

/**
 * Discord 増減操作: other のみを変更
 * @param attr 現在の属性値
 * @param delta 増減値
 * @returns 更新された属性値
 */
export const applyDiscordDelta = (attr: AttributeValue, delta: number): AttributeValue => {
  const current = attr.values ?? {}
  const nextOther = (current.other ?? 0) + delta
  return {
    ...attr,
    values: { ...current, other: nextOther }
  }
}

/**
 * サーバー応答用の属性値（display付き）
 */
export interface AttributeValueWithDisplay extends AttributeValue {
  /** サーバー計算済み表示値 */
  display: number
}

/**
 * サーバー応答用のセクション
 */
export type AttributeSectionWithDisplay = Record<string, AttributeValueWithDisplay>

/**
 * 属性値に display を付与するヘルパー
 * @param attr 属性値
 * @returns display付き属性値
 */
export const addDisplayValue = (attr: AttributeValue): AttributeValueWithDisplay => ({
  ...attr,
  display: getDisplayNumber(attr)
})

/**
 * セクション全体に display を付与するヘルパー
 * @param section 属性セクション
 * @returns display付きセクション
 */
export const addDisplayValuesToSection = (section: AttributeSection): AttributeSectionWithDisplay =>
  Object.entries(section).reduce((acc, [key, attr]) => {
    acc[key] = addDisplayValue(attr)
    return acc
  }, {} as AttributeSectionWithDisplay)
