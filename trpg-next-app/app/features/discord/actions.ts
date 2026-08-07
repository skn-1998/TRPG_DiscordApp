'use server'

import { requireJwt } from '../../lib/auth-guard.server'
import { extractApiErrorMessages } from '../../lib/api-response.util'
import {
  getDiscordServers,
  postCharacterToDiscord as postCharacterToDiscordRequest
} from './api/discord.service.server'

export async function loadDiscordServers(): Promise<{
  servers: Array<{ value: string; label: string }>
  error: string | null
}> {
  await requireJwt()

  try {
    const response = await getDiscordServers()
    return {
      servers: response.guilds.map((guild) => ({ value: guild.id, label: guild.name })),
      error: null
    }
  } catch (error) {
    return {
      servers: [],
      error: extractApiErrorMessages(error).join(' / ')
    }
  }
}

export async function postCharacterToDiscord(characterId: string, guildId: string): Promise<{
  success: boolean
  messageId?: string
  error?: string
}> {
  await requireJwt()

  try {
    return await postCharacterToDiscordRequest(characterId, guildId)
  } catch (error) {
    return {
      success: false,
      error: extractApiErrorMessages(error).join(' / ')
    }
  }
}
