/**
 * materialized なのに channel 未紐付けである、という単一条件を判定する純関数。
 * discordChannelId の空文字列 sentinel が未紐付けを表す。
 * 非空の不正 snowflake は characterSheet/services/hub-publication.service.ts の projection warning 側に委ねる。
 * L1（ユーザー可視ゲート）/ L2（副作用直前）/ L3（別 customId 経路）の3適用点から呼ばれる。
 */
import type { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { resolveCharacterState } from '../../../../domains/character/models/character.entity'

export const CHARACTER_CHANNEL_BINDING_REQUIRED_MESSAGE =
  '先にキャラクターのチャンネルを開設してください（/post-character）。'

export function isMaterializedWithoutChannel(
  character: Pick<CharacterEntity, 'sheet' | 'templatePin' | 'discordChannelId'>
): boolean {
  return resolveCharacterState(character) === 'materialized' && !character.discordChannelId
}
