import { Logger } from '@nestjs/common'
import { ButtonInteraction, ChannelType, TextChannel } from 'discord.js'

/**
 * characterSheet feature のロール結果を実親チャンネルへ投稿する Discord adapter。
 * characterThread feature-local helper と同じ既存意味論を、この feature の境界内で維持する。
 */
export async function postRollResultToParentChannel(
  interaction: ButtonInteraction,
  message: string,
  logger: Pick<Logger, 'warn'>
): Promise<boolean> {
  try {
    const channel = interaction.channel
    if (
      channel === null ||
      (channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread) ||
      channel.parentId === null
    ) {
      return false
    }

    const parentChannel = await interaction.client.channels.fetch(channel.parentId)
    if (parentChannel === null || !parentChannel.isTextBased()) return false

    await (parentChannel as TextChannel).send({ content: message })
    return true
  } catch (error) {
    logger.warn('Failed to send result to parent channel', error)
    return false
  }
}
