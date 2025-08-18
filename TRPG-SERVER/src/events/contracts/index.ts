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
