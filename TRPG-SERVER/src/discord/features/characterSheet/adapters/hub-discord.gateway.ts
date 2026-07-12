import { Injectable } from '@nestjs/common'
import type { MessageCreateOptions, MessageEditOptions, ThreadChannel } from 'discord.js'
import { DiscordClientService } from '../../../services/discord-client.service'

export interface HubMessageReference {
  id: string
}

@Injectable()
export class HubDiscordGateway {
  constructor(private readonly discordClientService: DiscordClientService) {}

  isReady(): boolean {
    return this.discordClientService.getClient().isReady()
  }

  async send(threadId: string, payload: MessageCreateOptions): Promise<HubMessageReference> {
    const channel = await this.fetchTextChannel(threadId)
    return channel.send(payload)
  }

  async edit(threadId: string, messageId: string, payload: MessageEditOptions): Promise<HubMessageReference> {
    const channel = await this.fetchTextChannel(threadId)
    const message = await channel.messages.fetch(messageId)
    return message.edit(payload)
  }

  private async fetchTextChannel(channelId: string): Promise<ThreadChannel> {
    const channel = await this.discordClientService.getClient().channels.fetch(channelId)
    if (channel === null || !channel.isThread()) {
      throw Object.assign(new Error(`Discord text channel is unavailable: ${channelId}`), { code: 50001 })
    }
    return channel
  }
}
