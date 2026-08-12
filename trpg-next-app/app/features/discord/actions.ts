'use server'

import { requireJwt } from '../../lib/auth-guard.server'
import {
  extractApiErrorMessages,
  GENERIC_NETWORK_ERROR_MESSAGE,
  getResponseStatus
} from '../../lib/api-response.util'
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
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      servers: [],
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
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
    const status = getResponseStatus(error)
    const messages = status === undefined ? [GENERIC_NETWORK_ERROR_MESSAGE] : extractApiErrorMessages(error)
    return {
      success: false,
      error: messages.length > 0 ? messages.join(' / ') : GENERIC_NETWORK_ERROR_MESSAGE
    }
  }
}
