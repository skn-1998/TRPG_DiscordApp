/**
 * キャラクター関連の型定義
 */

import type { CharacterWire } from '@trpg/api-contract'

/**
 * キャラクター属性の型定義
 */
export type CharacterAttribute = {
  [key: string]: string | number | boolean | null | undefined
}

/**
 * 更新可能なプライマリフィールド
 */
export type UpdatePrimary = 'status' | 'parameter' | 'skill'

export type Character = CharacterWire

// 作成リクエスト型は S5/S6 で server CharacterInputDto の wire 化として別途定義する。

/**
 * キャラクター作成入力DTO（部分的に入力可能）
 */
export interface PartialInputCharacterDto {
  characterId?: string
  discordUserId?: string
  discordChannelId?: string
  characterName?: string
  gameSystemId?: string
  status?: CharacterAttribute
  parameter?: CharacterAttribute
  skill?: CharacterAttribute
  item?: CharacterAttribute
  description?: CharacterAttribute
}

/**
 * キャラクター更新DTO
 */
export interface UpdateCharacterDto {
  characterName?: string
  gameSystemId?: string
  status?: Record<string, CharacterAttribute> | Record<string, unknown>
  skill?: Record<string, CharacterAttribute> | Record<string, unknown>
  parameter?: Record<string, CharacterAttribute> | Record<string, unknown>
  item?: Record<string, CharacterAttribute> | Record<string, unknown>
  description?: Record<string, CharacterAttribute> | Record<string, unknown>
}
