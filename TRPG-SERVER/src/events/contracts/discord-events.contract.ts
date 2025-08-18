/**
 * Discord Integration Events Contract
 * Discord連携システムレベルのイベント契約定義
 */

export interface DiscordIntegrationEvent {
  timestamp: Date
  source: 'discord' | 'system'
  guildId?: string
  channelId?: string
  userId?: string
}

// ============================================================================
// Discord Channel Events
// ============================================================================

export interface DiscordChannelCreateRequestedEvent extends DiscordIntegrationEvent {
  type: 'discord.channel.create.requested'
  channelData: {
    name: string
    guildId: string
    topic?: string
    parentId?: string
    type?: 'text' | 'voice' | 'thread'
  }
  characterId?: string
}

export interface DiscordChannelCreatedEvent extends DiscordIntegrationEvent {
  type: 'discord.channel.created'
  channel: {
    id: string
    name: string
    guildId: string
    type: string
  }
  characterId?: string
}

export interface DiscordChannelUpdateRequestedEvent extends DiscordIntegrationEvent {
  type: 'discord.channel.update.requested'
  channelData: {
    channelId: string
    name?: string
    topic?: string
  }
  characterId?: string
}

// ============================================================================
// Discord Thread Events
// ============================================================================

export interface DiscordThreadCreateRequestedEvent extends DiscordIntegrationEvent {
  type: 'discord.thread.create.requested'
  threadData: {
    name: string
    channelId: string
    autoArchiveDuration?: number
    message?: string
  }
  characterId?: string
}

export interface DiscordThreadCreatedEvent extends DiscordIntegrationEvent {
  type: 'discord.thread.created'
  thread: {
    id: string
    name: string
    channelId: string
    guildId: string
  }
  characterId?: string
}

// ============================================================================
// Discord Embed Events
// ============================================================================

export interface DiscordEmbedUpdateRequestedEvent extends DiscordIntegrationEvent {
  type: 'discord.embed.update.requested'
  embedData: {
    channelId: string
    characterId: string
    embedType: 'character' | 'status' | 'enhanced' | 'parameter' | 'compact'
    updateMode: 'create' | 'update' | 'refresh'
  }
}

export interface DiscordEmbedUpdatedEvent extends DiscordIntegrationEvent {
  type: 'discord.embed.updated'
  embed: {
    messageId: string
    channelId: string
    characterId: string
    embedType: string
    success: boolean
  }
}

// ============================================================================
// Discord Message Events
// ============================================================================

export interface DiscordMessageSendRequestedEvent extends DiscordIntegrationEvent {
  type: 'discord.message.send.requested'
  messageData: {
    channelId: string
    content?: string
    embeds?: any[]
    components?: any[]
    ephemeral?: boolean
  }
}

export interface DiscordMessageSentEvent extends DiscordIntegrationEvent {
  type: 'discord.message.sent'
  message: {
    id: string
    channelId: string
    success: boolean
  }
}

// ============================================================================
// Discord Notification Events
// ============================================================================

export interface DiscordNotificationRequestedEvent extends DiscordIntegrationEvent {
  type: 'discord.notification.requested'
  notification: {
    type: 'character.created' | 'character.updated' | 'character.deleted' | 'system.alert'
    channelId: string
    title: string
    message: string
    color?: number
    characterId?: string
  }
}

export interface DiscordNotificationSentEvent extends DiscordIntegrationEvent {
  type: 'discord.notification.sent'
  notification: {
    messageId: string
    channelId: string
    type: string
    success: boolean
  }
}

// ============================================================================
// Discord Error Events
// ============================================================================

export interface DiscordIntegrationErrorEvent extends DiscordIntegrationEvent {
  type: 'discord.integration.error'
  error: {
    code: string
    message: string
    operation: string
    details?: any
  }
}

export interface DiscordRateLimitEvent extends DiscordIntegrationEvent {
  type: 'discord.rate.limit'
  rateLimit: {
    limit: number
    remaining: number
    resetAfter: number
    bucket: string
  }
}

// ============================================================================
// Union Types
// ============================================================================

export type DiscordIntegrationEventType =
  | DiscordChannelCreateRequestedEvent
  | DiscordChannelCreatedEvent
  | DiscordChannelUpdateRequestedEvent
  | DiscordThreadCreateRequestedEvent
  | DiscordThreadCreatedEvent
  | DiscordEmbedUpdateRequestedEvent
  | DiscordEmbedUpdatedEvent
  | DiscordMessageSendRequestedEvent
  | DiscordMessageSentEvent
  | DiscordNotificationRequestedEvent
  | DiscordNotificationSentEvent
  | DiscordIntegrationErrorEvent
  | DiscordRateLimitEvent

// ============================================================================
// Event Type Guards
// ============================================================================

export const isDiscordChannelEvent = (event: any): boolean => event.type?.startsWith('discord.channel.')

export const isDiscordThreadEvent = (event: any): boolean => event.type?.startsWith('discord.thread.')

export const isDiscordEmbedEvent = (event: any): boolean => event.type?.startsWith('discord.embed.')

export const isDiscordIntegrationEvent = (event: any): event is DiscordIntegrationEventType =>
  event.type?.startsWith('discord.')
