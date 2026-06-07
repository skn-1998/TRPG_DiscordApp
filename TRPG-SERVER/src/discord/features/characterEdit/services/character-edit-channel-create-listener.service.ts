import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Events, NonThreadGuildBasedChannel, ChannelType, TextChannel } from 'discord.js'
import { DiscordClientService } from '../../../services/discord-client.service'
import { ChannelCreateOrchestratorService } from './channel-create-orchestrator.service'

/**
 * Character Edit ChannelCreate Listener
 *
 * 目的: GuildText チャンネル作成を検出し ChannelCreateOrchestratorService へ委譲する。
 *
 * 経緯（ARCHITECTURE §8）:
 * - 旧: InteractionsService.handleChannelCreate（loadClient 経由で登録）が担っていたが、
 *   interactions core が feature の ChannelCreateOrchestratorService に依存する原因だった。
 * - 本 listener を characterEdit feature 側へ移すことで、InteractionsModule から
 *   CharacterEditModule import を撤去できる。挙動（GuildText 作成 → orchestrator.execute）は不変。
 *
 * 登録方式:
 * - OnModuleInit で DiscordClientService.on(ChannelCreate) にハンドラを登録する。
 *   login 前の登録だが ChannelCreate は login 後に届くため挙動は同一。
 */
@Injectable()
export class CharacterEditChannelCreateListenerService implements OnModuleInit {
  private readonly logger = new Logger(CharacterEditChannelCreateListenerService.name)

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly channelCreateOrchestratorService: ChannelCreateOrchestratorService
  ) {}

  onModuleInit(): void {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises -- discord.js の Client.on は async リスナーを await しない設計（handler 内で try/catch 済み）。fire-and-forget は意図的
    this.discordClientService.on(Events.ChannelCreate, async (channel: NonThreadGuildBasedChannel) => {
      if (channel.type !== ChannelType.GuildText) return

      const textChannel = channel as TextChannel
      this.logger.log(`チャンネル作成検出: ${textChannel.name} (${textChannel.id})`)

      try {
        await this.channelCreateOrchestratorService.execute(textChannel)
      } catch (error) {
        this.logger.error(`チャンネル作成処理でエラーが発生: ${textChannel.name}`, error)
      }
    })
    this.logger.log('ChannelCreateリスナーを登録しました。')
  }
}
