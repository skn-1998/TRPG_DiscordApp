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

  /**
   * キャラクターチャンネルID
   */
  discordChannelId: string
}
