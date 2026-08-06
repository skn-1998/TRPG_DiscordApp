import 'server-only'

import type { DiscordGuildsPayloadWire, SuccessEnvelope } from '@trpg/api-contract'
import { apiClient } from '../../../lib/api-client.server'

interface DiscordPostCharacterResult {
  success: boolean
  messageId?: string
  error?: string
}

export async function getDiscordServers(): Promise<DiscordGuildsPayloadWire> {
  const response = await apiClient.get<SuccessEnvelope<DiscordGuildsPayloadWire>>('/users/discord/guilds')
  return response.data.data
}

export async function postCharacterToDiscord(
  characterId: string,
  guildId: string
): Promise<DiscordPostCharacterResult> {
  const response = await apiClient.post<DiscordPostCharacterResult>('/discord/post-character', {
    characterId,
    guildId
  })
  return response.data
}
