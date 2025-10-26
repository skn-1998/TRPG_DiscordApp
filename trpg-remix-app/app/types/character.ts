/**
 * キャラクター関連の型定義
 */

/** 合算対象の数値群（自由にキー追加可: base, fluctuation, buff, debuff, temp, other など） */
export type CharacterAttributeNumberParts = Record<string, number>

/** 属性値の詳細定義 */
export interface CharacterAttributeValue {
  /** 表示名（キーと同じなら省略可） */
  name: string
  /** 並び順（合算に含めない） */
  index: number
  /** 合算対象の数値群（index 以外の number はここへ） */
  values: CharacterAttributeNumberParts
  /** 説明・備考 */
  description: string
  /** ダイスロール */
  dice: string
  /** UI表示フラグ */
  isVisible: boolean
}

export type CharacterAttributeType = 'status' | 'skill' | 'parameter' | 'item' | 'description'

export type CharacterAttribute = {
  [P in CharacterAttributeType]: Record<string, CharacterAttributeValue>
}

/** Discord関連情報 */
export type CharacterDiscordInfo = {
  discord: {
    userId: string
    channelId?: string
    editChannelId?: string
    threadId?: string
  }
}

// キャラクター基礎情報
export interface CharacterBaseInfo {
  /** キャラクターID（ユニーク） */
  characterId: string
  /** キャラクター名 */
  characterName: string
  /** ゲームシステムID */
  gameSystemId: string
  /** 作成日時 */
  createdAt: Date
  /** 更新日時 */
  updatedAt: Date
}

/** キャラクターインターフェース */
export type Character = CharacterBaseInfo & CharacterAttribute & CharacterDiscordInfo
