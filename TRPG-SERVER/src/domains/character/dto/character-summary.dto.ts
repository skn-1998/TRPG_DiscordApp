import type { CharacterSheetVisibility } from '@trpg/api-contract'
import { CharacterHubStatus } from '../models/character.entity'

/**
 * キャラクターカード表示用の軽量データ
 */
export interface CharacterSummaryDto {
  /**
   * キャラクターID
   */
  characterId: string

  /**
   * キャラクター名
   */
  characterName: string

  /**
   * ゲームシステムID
   */
  gameSystemId: string

  visibility: CharacterSheetVisibility

  /** materialized sheet を legacy pin より優先して解決したテンプレート版 */
  templateVersion?: string

  /** Discord hub の現在状態 */
  hub?: {
    status: CharacterHubStatus
  }
}
