/**
 * Character Domain Events Contract
 * グローバルレベルのキャラクター関連イベント契約定義
 */

export interface CharacterDomainEvent {
  characterId: string
  timestamp: Date
  source: 'discord' | 'web' | 'api' | 'system'
  userId?: string
}

// ============================================================================
// Character Lifecycle Events
// ============================================================================

export interface CharacterCreatedEvent extends CharacterDomainEvent {
  type: 'character.created'
  character: {
    characterId: string
    characterName: string
    gameSystemId: string
    discordUserId: string
    discordChannelId?: string
    threadId?: string
    status?: any
    parameter?: any
    skill?: any
    item?: any
  }
}

export interface CharacterUpdatedEvent extends CharacterDomainEvent {
  type: 'character.updated'
  character: {
    characterId: string
    characterName: string
    gameSystemId: string
    discordUserId: string
    discordChannelId?: string
    threadId?: string
    status?: any
    parameter?: any
    skill?: any
    item?: any
  }
  changes: {
    field: string
    oldValue: any
    newValue: any
  }[]
}

export interface CharacterDeletedEvent extends CharacterDomainEvent {
  type: 'character.deleted'
  deletedCharacterData: {
    characterId: string
    characterName: string
    discordUserId: string
    discordChannelId?: string
    threadId?: string
  }
}

// ============================================================================
// Feature Requester Types
// ============================================================================

export type FeatureId = 'characterEdit' | 'characterThread' | 'gameSystem' | 'diceRoll'

export interface FeatureRequester {
  featureId: FeatureId
  context: any // feature固有のコンテキスト
}

// ============================================================================
// Character Request Events
// ============================================================================

export interface CharacterCreationRequestedEvent extends CharacterDomainEvent {
  type: 'character.creation.requested'
  createData: {
    characterName: string
    gameSystemId: string
    discordChannelId?: string
    discordUserId?: string
    threadId?: string
    status?: any
    parameter?: any
    skill?: any
    item?: any
  }
  requester: FeatureRequester // 要求元feature情報
}

export interface CharacterUpdateRequestedEvent extends CharacterDomainEvent {
  type: 'character.update.requested'
  updateData: {
    characterName?: string
    gameSystemId?: string
    status?: any
    parameter?: any
    skill?: any
    item?: any
  }
  requester?: FeatureRequester // 要求元feature情報（オプション）
}

export interface CharacterDeletionRequestedEvent extends CharacterDomainEvent {
  type: 'character.deletion.requested'
  reason?: string
}

// ============================================================================
// Character Error Events
// ============================================================================

export interface CharacterCreationFailedEvent extends CharacterDomainEvent {
  type: 'character.creation.failed'
  error: {
    code: string
    message: string
    details?: any
  }
  createData: any
}

export interface CharacterUpdateFailedEvent extends CharacterDomainEvent {
  type: 'character.update.failed'
  error: {
    code: string
    message: string
    details?: any
  }
  updateData: any
}

export interface CharacterNotFoundEvent extends CharacterDomainEvent {
  type: 'character.not.found'
  searchCriteria: {
    characterId?: string
    channelId?: string
    characterName?: string
    userId?: string
  }
}

// ============================================================================
// Union Types
// ============================================================================

export type CharacterDomainEventType =
  | CharacterCreatedEvent
  | CharacterUpdatedEvent
  | CharacterDeletedEvent
  | CharacterCreationRequestedEvent
  | CharacterUpdateRequestedEvent
  | CharacterDeletionRequestedEvent
  | CharacterCreationFailedEvent
  | CharacterUpdateFailedEvent
  | CharacterNotFoundEvent

// ============================================================================
// Event Type Guards
// ============================================================================

export const isCharacterCreatedEvent = (event: any): event is CharacterCreatedEvent =>
  event.type === 'character.created'

export const isCharacterUpdatedEvent = (event: any): event is CharacterUpdatedEvent =>
  event.type === 'character.updated'

export const isCharacterDeletedEvent = (event: any): event is CharacterDeletedEvent =>
  event.type === 'character.deleted'

export const isCharacterDomainEvent = (event: any): event is CharacterDomainEventType =>
  event.type?.startsWith('character.')
