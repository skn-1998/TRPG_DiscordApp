/**
 * Character Edit Feature Events Contract
 * characterEdit機能内部のイベント契約定義
 */

import { FeatureRequester } from '../../../../../events/contracts/character-events.contract'

export interface CharacterEditFeatureEvent {
  characterId: string
  timestamp: Date
  userId?: string
  sessionId?: string
}

// ============================================================================
// Character Creation Events (Global Bridge Integration)
// ============================================================================

export interface CharacterEditCreationRequestedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.creation.requested'
  createData: {
    characterName: string
    gameSystemId?: string
    discordChannelId?: string
    discordUserId?: string
    threadId?: string
    status?: any
    parameter?: any
    skill?: any
    item?: any
  }
  editContext: {
    channelId: string
    sectionType?: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    triggeredBy: 'modal' | 'button' | 'select_menu' | 'channel_create'
  }
  originalRequester?: FeatureRequester // Event Bridge経由の場合
}

export interface CharacterEditCreationCompletedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.creation.completed'
  character: {
    characterId: string
    characterName: string
    gameSystemId?: string
    discordUserId: string
    discordChannelId?: string
    threadId?: string
    status?: any
    parameter?: any
    skill?: any
    item?: any
  }
  editContext: {
    channelId: string
    sectionType?: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    triggeredBy: 'modal' | 'button' | 'select_menu' | 'channel_create'
  }
  originalRequester?: FeatureRequester // Event Bridge経由の場合
}

export interface CharacterEditCreationFailedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.creation.failed'
  createData: {
    characterName: string
    gameSystemId?: string
    discordChannelId?: string
    discordUserId?: string
    threadId?: string
    status?: any
    parameter?: any
    skill?: any
    item?: any
  }
  error: {
    code: string
    message: string
    details?: any
  }
  editContext: {
    channelId: string
    sectionType?: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    triggeredBy: 'modal' | 'button' | 'select_menu' | 'channel_create'
  }
  originalRequester?: FeatureRequester // Event Bridge経由の場合
}

// ============================================================================
// Modal Events
// ============================================================================

export interface CharacterEditModalOpenedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.modal.opened'
  modal: {
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    fieldKey: string
    currentValue?: any
  }
}

export interface CharacterEditModalSubmittedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.modal.submitted'
  modal: {
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    fieldKey: string
    newValue: any
    oldValue?: any
  }
}

export interface CharacterEditModalClosedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.modal.closed'
  modal: {
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    fieldKey: string
    cancelled: boolean
  }
}

// ============================================================================
// Section Events
// ============================================================================

export interface CharacterEditSectionSelectedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.section.selected'
  section: {
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    displayMode: 'list' | 'add' | 'edit'
  }
}

export interface CharacterEditFieldSelectedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.field.selected'
  field: {
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    fieldKey: string
    action: 'edit' | 'add' | 'delete'
  }
}

// ============================================================================
// Validation Events
// ============================================================================

export interface CharacterEditValidationStartedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.validation.started'
  validation: {
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    fieldKey: string
    value: any
  }
}

export interface CharacterEditValidationCompletedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.validation.completed'
  validation: {
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    fieldKey: string
    value: any
    isValid: boolean
    errors?: string[]
  }
}

// ============================================================================
// Embed Update Events
// ============================================================================

export interface CharacterEditEmbedRefreshRequestedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.embed.refresh.requested'
  embed: {
    channelId: string
    embedType: 'enhanced' | 'compact' | 'status' | 'parameter'
    section?: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
  }
}

export interface CharacterEditEmbedUpdatedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.embed.updated'
  embed: {
    channelId: string
    messageId?: string
    embedType: 'enhanced' | 'compact' | 'status' | 'parameter'
    success: boolean
    updateMode: 'create' | 'update' | 'refresh'
  }
}

// ============================================================================
// Session Management Events
// ============================================================================

export interface CharacterEditSessionCreatedEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.session.created'
  session: {
    sessionId: string
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    fieldKey: string
    expiresAt: Date
  }
}

export interface CharacterEditSessionExpiredEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.session.expired'
  session: {
    sessionId: string
    sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    fieldKey: string
  }
}

// ============================================================================
// Error Events
// ============================================================================

export interface CharacterEditErrorEvent extends CharacterEditFeatureEvent {
  type: 'characterEdit.error.occurred'
  error: {
    code: string
    message: string
    operation: string
    details?: any
    severity: 'low' | 'medium' | 'high'
  }
}

// ============================================================================
// Union Types
// ============================================================================

export type CharacterEditFeatureEventType =
  | CharacterEditCreationRequestedEvent
  | CharacterEditCreationCompletedEvent
  | CharacterEditCreationFailedEvent
  | CharacterEditModalOpenedEvent
  | CharacterEditModalSubmittedEvent
  | CharacterEditModalClosedEvent
  | CharacterEditSectionSelectedEvent
  | CharacterEditFieldSelectedEvent
  | CharacterEditValidationStartedEvent
  | CharacterEditValidationCompletedEvent
  | CharacterEditEmbedRefreshRequestedEvent
  | CharacterEditEmbedUpdatedEvent
  | CharacterEditSessionCreatedEvent
  | CharacterEditSessionExpiredEvent
  | CharacterEditErrorEvent

// ============================================================================
// Event Type Guards
// ============================================================================

export const isCharacterEditModalEvent = (event: any): boolean => event.type?.startsWith('characterEdit.modal.')

export const isCharacterEditSectionEvent = (event: any): boolean =>
  event.type?.startsWith('characterEdit.section.') || event.type?.startsWith('characterEdit.field.')

export const isCharacterEditValidationEvent = (event: any): boolean =>
  event.type?.startsWith('characterEdit.validation.')

export const isCharacterEditEmbedEvent = (event: any): boolean => event.type?.startsWith('characterEdit.embed.')

export const isCharacterEditSessionEvent = (event: any): boolean => event.type?.startsWith('characterEdit.session.')

export const isCharacterEditFeatureEvent = (event: any): event is CharacterEditFeatureEventType =>
  event.type?.startsWith('characterEdit.')
