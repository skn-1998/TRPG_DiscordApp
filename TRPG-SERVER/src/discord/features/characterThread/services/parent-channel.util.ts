import { Logger } from '@nestjs/common'
import { ButtonInteraction, ChannelType, StringSelectMenuInteraction, TextChannel } from 'discord.js'

/**
 * スレッド内 interaction の結果メッセージを親チャンネルへ送信する共通ヘルパ（C-4）
 *
 * 旧: ability-roll / character-skill-roll / dice-generic / flexible-dice-select /
 * preset-dice-quick-roll 各 handler の private sendToParentChannel（5 実装ロジック完全同一）を集約。
 *
 * 共通契約（挙動保存）:
 * - スレッド（Public/PrivateThread）内なら親チャンネルを fetch して投稿し true
 * - 非スレッド / channel なし / parentId なし / 親が text-based でない場合は送信せず false
 * - fetch/send 失敗は warn ログのみで握り潰して false（throw しない）
 * - logger は呼び出し元 handler の this.logger を受け取り、ログ context（handler 名）を保存する
 *
 * 呼び出し側の契約（fallback followUp の有無等）は各 handler 側の責務で、本ヘルパは boolean を返すのみ。
 */
export async function sendToParentChannel(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  message: string,
  logger: Pick<Logger, 'warn'>
): Promise<boolean> {
  try {
    if (!interaction.channel) return false

    if (
      interaction.channel.type === ChannelType.PublicThread ||
      interaction.channel.type === ChannelType.PrivateThread
    ) {
      const parentId = interaction.channel.parentId
      if (parentId) {
        const parentChannel = await interaction.client.channels.fetch(parentId)
        if (parentChannel && parentChannel.isTextBased()) {
          await (parentChannel as TextChannel).send({ content: message })
          return true
        }
      }
    }
    return false
  } catch (error) {
    logger.warn('Failed to send result to parent channel', error)
    return false
  }
}
