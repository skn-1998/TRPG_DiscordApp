/**
 * Interaction Error Response Util
 *
 * Discord interaction の応答状態（replied / deferred / 未応答）に応じた
 * エラーメッセージの送達方法を一元化する純関数。
 *
 * Invariant: 判定の優先順位は replied → deferred → 未応答。
 * replied 済みの interaction へは reply / editReply とも Discord API 契約上
 * 不正または既存応答の破壊になるため followUp に固定する。
 *
 * この関数はログ・握り潰し・独自例外への変換を一切行わない。
 * Discord API の失敗はそのまま reject させ、通知失敗時の扱い（warn ログ等）は
 * 呼び出し元の責務とする（DI service や Logger を utils に持ち込まない）。
 */

import { MessageFlags } from 'discord.js'

/**
 * deferred 状態での応答方法。
 *
 * - 'editReply'（既定）: deferReply 済みの placeholder をエラー文言で解消する。
 *   可視性（ephemeral か否か）は defer 時の指定を引き継ぐ。
 * - 'followUp': deferUpdate 済みで元メッセージ（共有 embed 等）を書き換えたくない
 *   呼び出し元が指定する。エラーは ephemeral followUp で本人だけに届く。
 */
type DeferredErrorStrategy = 'editReply' | 'followUp'

interface RespondEphemeralErrorOptions {
  deferredStrategy?: DeferredErrorStrategy
}

/**
 * respondEphemeralError が必要とする最小の interaction 面。
 * discord.js の Button / StringSelectMenu / ModalSubmit interaction は構造的に満たす。
 */
interface EphemeralErrorRespondable {
  readonly replied: boolean
  readonly deferred: boolean
  reply(options: { content: string; flags: MessageFlags.Ephemeral }): Promise<unknown>
  editReply(options: { content: string }): Promise<unknown>
  followUp(options: { content: string; flags: MessageFlags.Ephemeral }): Promise<unknown>
}

/**
 * interaction の応答状態に応じてエラーメッセージを届ける。
 *
 * 失敗時は Discord API の rejection をそのまま伝播する（catch しない）。
 */
export async function respondEphemeralError(
  interaction: EphemeralErrorRespondable,
  message: string,
  options?: RespondEphemeralErrorOptions
): Promise<void> {
  if (interaction.replied) {
    await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral })
    return
  }

  if (interaction.deferred) {
    if (options?.deferredStrategy === 'followUp') {
      await interaction.followUp({ content: message, flags: MessageFlags.Ephemeral })
      return
    }
    await interaction.editReply({ content: message })
    return
  }

  await interaction.reply({ content: message, flags: MessageFlags.Ephemeral })
}
