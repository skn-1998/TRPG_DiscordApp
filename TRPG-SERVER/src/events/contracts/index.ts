/**
 * Events Contracts Index
 * 全イベント契約のエクスポート
 */

// Character Domain Events
export * from './character-events.contract'

// Discord Integration Events
export * from './discord-events.contract'

// System Events
export * from './system-events.contract'

// ============================================================================
// Global Event Union Type
// ============================================================================

import { CharacterDomainEventType } from './character-events.contract'
import { DiscordIntegrationEventType } from './discord-events.contract'
import { SystemEventType } from './system-events.contract'

export type GlobalEventType = CharacterDomainEventType | DiscordIntegrationEventType | SystemEventType

// ============================================================================
// TypedEventService互換性のための型定義
// ============================================================================

// Character関連のイベント契約（TypedEventService用）
export interface CharacterEventContracts {
  // Character検索関連
  'character.findByChannelId.requested': {
    channelId: string
    source: 'character-channel-service' | 'character-tab-buttons-service' | 'discord-facade' | string
    timestamp: Date
    tabType?: string
  }

  'character.findByChannelId.completed': {
    channelId: string
    character: any
    source: string
    timestamp: Date
  }

  'character.findByChannelId.failed': {
    channelId: string
    error: string
    source: string
    timestamp: Date
  }

  'character.findById.requested': {
    characterId: string
    source: string
    timestamp: Date
  }

  'character.findById.completed': {
    characterId: string
    character: any
    source: string
    timestamp: Date
  }

  'character.findById.failed': {
    characterId: string
    error: string
    source: string
    timestamp: Date
  }

  'character.findByName.requested': {
    characterName: string
    source: string
    timestamp: Date
  }

  'character.findByName.completed': {
    characterName: string
    character: any
    source: string
    timestamp: Date
  }

  'character.findByName.failed': {
    characterName: string
    error: string
    source: string
    timestamp: Date
  }

  // Character更新関連
  'character.update.requested': {
    channelId: string
    updateData: any
    userId?: string
    source: string
    timestamp: Date
  }

  'character.update.completed': {
    channelId: string
    character: any
    source: string
    timestamp: Date
  }

  'character.update.failed': {
    channelId: string
    error: string
    source: string
    timestamp: Date
  }

  // Character作成関連
  'character.creation.requested': {
    createData: {
      characterName: string
      gameSystemId?: string
      discordUserId?: string
      discordChannelId?: string
      threadId?: string
      status?: Record<string, any>
      parameter?: Record<string, any>
      skill?: Record<string, any>
      item?: Record<string, any>
      description?: Record<string, any>
    }
    requester?: any
    userId: string
    source: string
    timestamp: Date
  }

  'character.creation.completed': {
    character: any
    source: string
    timestamp: Date
  }

  'character.creation.failed': {
    createData: {
      characterName: string
      gameSystemId?: string
      discordUserId?: string
      discordChannelId?: string
      threadId?: string
      status?: Record<string, any>
      parameter?: Record<string, any>
      skill?: Record<string, any>
      item?: Record<string, any>
      description?: Record<string, any>
    }
    error: string
    source: string
    timestamp: Date
  }

  // Character更新イベント（汎用）
  'character.updated': {
    character: any
    updateType: string
    channelId?: string
    source: string
    timestamp: Date
  }

  // Character作成イベント（汎用）
  'character.created': {
    character: any
    source: string
    timestamp: Date
  }

  // Character削除イベント（汎用）
  'character.deleted': {
    character: any
    source: string
    timestamp: Date
  }

  // Discord関連のイベント
  'discord.character.display.requested': {
    character: any
    channelId: string
    guildId: string
    requesterId: string
    displayType?: 'basic' | 'enhanced' | 'compact'
    source: string
    timestamp: Date
  }

  'discord.embed.character.update.requested': {
    character: any
    channelId: string
    displayType?: 'basic' | 'enhanced' | 'compact'
    source: string
    timestamp: Date
  }

  'discord.thread.create.requested': {
    character: any
    channelId: string
    guildId: string
    creatorId: string
    displayType?: 'basic' | 'enhanced' | 'compact'
    source: string
    timestamp: Date
  }

  // Discord Embed 更新リクエスト（生フロー: ブリッジ役 → DiscordIntegrationHandler）
  // レガシーバス形式の `type` フィールドを除いた payload（イベント名は emit 第1引数で表現）
  'discord.embed.update.requested': {
    timestamp: Date
    source: 'discord' | 'system'
    channelId?: string
    embedData: {
      channelId: string
      characterId: string
      embedType: 'character' | 'status' | 'enhanced' | 'parameter' | 'compact'
      updateMode: 'create' | 'update' | 'refresh'
    }
  }

  // Discord 通知リクエスト（生フロー: ブリッジ役 → DiscordIntegrationHandler）
  'discord.notification.requested': {
    timestamp: Date
    source: 'discord' | 'system'
    channelId?: string
    notification: {
      type: 'character.created' | 'character.updated' | 'character.deleted' | 'system.alert'
      channelId: string
      title: string
      message: string
      color?: number
      characterId?: string
    }
  }

  // すべてのイベント名を許可（any型で）
  [eventName: string]: any
}

// 統合されたイベント契約
export type AppEventContracts = CharacterEventContracts

// イベント名の型
export type EventName = string

// 特定のイベントの引数の型を取得するヘルパー型
export type EventPayload<T extends EventName> = T extends keyof AppEventContracts ? AppEventContracts[T] : any

// イベントハンドラーの型
export type TypedEventHandler<T extends EventName> = (payload: EventPayload<T>) => Promise<void> | void

// イベントリスナーの型
export interface TypedEventListener<T extends EventName> {
  event: T
  handler: TypedEventHandler<T>
}

// ============================================================================
// Event Category Mapping
// ============================================================================

export const EVENT_CATEGORIES = {
  CHARACTER: 'character',
  DISCORD: 'discord',
  SYSTEM: 'system'
} as const

export type EventCategory = (typeof EVENT_CATEGORIES)[keyof typeof EVENT_CATEGORIES]

export const getEventCategory = (eventType: string): EventCategory | null => {
  if (eventType.startsWith('character.')) return EVENT_CATEGORIES.CHARACTER
  if (eventType.startsWith('discord.')) return EVENT_CATEGORIES.DISCORD
  if (eventType.startsWith('system.')) return EVENT_CATEGORIES.SYSTEM
  return null
}

// ============================================================================
// Event Priority Levels
// ============================================================================

export const EVENT_PRIORITY = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  CRITICAL: 4
} as const

export type EventPriority = (typeof EVENT_PRIORITY)[keyof typeof EVENT_PRIORITY]

// ============================================================================
// Event Name Constants（イベント名の単一ソース）
// ============================================================================

/**
 * イベント名定数。emit / on の第1引数に渡す文字列をここに集約し、直書き（magic string）を排除する。
 * ARCHITECTURE §9（feature event 名の直書きを避ける）/ §15（event name の文字列直書き追加を禁止）に対応。
 *
 * `satisfies Record<string, keyof CharacterEventContracts>` により、契約に存在しないイベント名を
 * 登録しようとするとコンパイルエラーになる（タイポ防止・契約との同期保証）。
 */
export const EVENT_NAMES = {
  // Character lifecycle（汎用通知）
  CHARACTER_UPDATED: 'character.updated',
  CHARACTER_DELETED: 'character.deleted',

  // Character find/update（レガシー event-handler 用）
  CHARACTER_UPDATE_FAILED: 'character.update.failed',
  CHARACTER_FIND_BY_CHANNEL_ID_COMPLETED: 'character.findByChannelId.completed',
  CHARACTER_FIND_BY_CHANNEL_ID_FAILED: 'character.findByChannelId.failed',
  CHARACTER_FIND_BY_ID_COMPLETED: 'character.findById.completed',
  CHARACTER_FIND_BY_ID_FAILED: 'character.findById.failed',
  CHARACTER_FIND_BY_NAME_COMPLETED: 'character.findByName.completed',
  CHARACTER_FIND_BY_NAME_FAILED: 'character.findByName.failed',

  // Discord integration
  DISCORD_THREAD_CREATE_REQUESTED: 'discord.thread.create.requested',
  DISCORD_CHARACTER_DISPLAY_REQUESTED: 'discord.character.display.requested'
} as const satisfies Record<string, keyof CharacterEventContracts>

export type EventNameConstant = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES]

export const getEventPriority = (eventType: string): EventPriority => {
  // Critical events
  if (
    eventType.includes('.error.') ||
    eventType.includes('.failed') ||
    eventType.includes('.critical') ||
    eventType.includes('security.alert')
  ) {
    return EVENT_PRIORITY.CRITICAL
  }

  // High priority events
  if (eventType.includes('.requested') || eventType.includes('.degraded') || eventType.includes('rate.limit')) {
    return EVENT_PRIORITY.HIGH
  }

  // Normal priority events
  if (eventType.includes('.created') || eventType.includes('.updated') || eventType.includes('.deleted')) {
    return EVENT_PRIORITY.NORMAL
  }

  // Default to low priority
  return EVENT_PRIORITY.LOW
}
