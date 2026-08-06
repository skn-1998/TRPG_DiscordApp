'use server'

import { requireJwt } from '../../lib/auth-guard.server'
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
  } catch {
    return {
      servers: [],
      error: 'サーバー一覧の取得に失敗しました'
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
  } catch {
    return {
      success: false,
      error: 'キャラクターの投稿中にエラーが発生しました'
    }
  }
}
