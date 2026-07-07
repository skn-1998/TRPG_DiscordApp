/**
 * 統一イベント契約定義（唯一の定義源 / Single Source of Truth）
 *
 * 🎯 責務:
 * - live なタイプドバスイベント（10 種）の payload 型定義
 * - イベント名 → payload の map 型（EventMap）と厳密な EventName 型の提供
 * - EVENT_NAMES 定数（イベント名の単一ソース）の提供
 *
 * 📏 方針（E-4a: 2026-07-07）:
 * - 契約は「実際の emit サイトの payload」と「購読側が参照するフィールド」に一致させる。
 *   emit されない dead イベント・過剰な必須フィールドはここに置かない。
 * - 新イベントを追加するときは、payload 型 → EventMap エントリ → EVENT_NAMES の 3 点を揃えること。
 */

import type { Character } from '../../domains/character/models/character.model'

// ============================================================================
// 共通サポート型
// ============================================================================

/**
 * Requester情報（character.creation.requested の要求元 feature 情報）
 */
export interface EventRequester {
  featureId: FeatureId
  context: RequesterContext
}

export interface RequesterContext {
  channelId?: string
  guildId?: string
  userId?: string
  threadId?: string
  sectionType?: string
  triggeredBy?: string
  [key: string]: any
}

export type FeatureId = 'characterEdit' | 'characterThread' | 'gameSystem' | 'diceRoll' | 'discord'

/**
 * キャラクター作成データ（character.creation.requested の createData。
 * domains の CharacterCreationCoreService.createValidated 入力と構造互換）
 */
export interface CharacterCreationData {
  characterId?: string
  characterName: string
  gameSystemId?: string
  discordChannelId?: string
  discordUserId?: string
  threadId?: string
  status?: Record<string, any>
  parameter?: Record<string, any>
  skill?: Record<string, any>
  item?: Record<string, any>
  description?: Record<string, any>
  profileImageUrl?: string
  createdAt?: Date
  updatedAt?: Date
}

/** characterEdit.* イベントで使うセクション種別 */
export type CharacterEditSectionType = 'status' | 'parameter' | 'skill' | 'item' | 'basic'

// ============================================================================
// Character Events（作成・更新）
// ============================================================================

/**
 * キャラクター作成リクエスト
 * emit: channel-create-orchestrator.service / character-creation.service
 * on:   events/handlers/character.creation.requested（EventRegistryService 経由）
 */
export interface CharacterCreationRequestedEvent {
  characterId?: string
  createData: CharacterCreationData
  requester?: EventRequester
  userId?: string
  source: string
  timestamp: Date
}

/**
 * キャラクター作成完了
 * emit: character.creation.requested handler（emitSuccessEvent）/ character-embed-manager.service
 * on:   discord/events/handlers/character.creation.completed
 */
export interface CharacterCreationCompletedEvent {
  character: Character
  source: string
  timestamp: Date
}

/**
 * キャラクター更新完了
 * emit: character-modal-handler.service（{channelId, character, source, timestamp}）
 * on:   discord/events/handlers/character.update.completed
 * 注: 旧契約の type/characterId/changes 必須は実 payload と不一致だったため実態へ修正（E-4a）
 */
export interface CharacterUpdateCompletedEvent {
  channelId: string
  character: Character
  source: string
  timestamp: Date
}

// ============================================================================
// Discord Events
// ============================================================================

/**
 * Discordスレッド作成リクエスト
 * emit: domains/character/character.controller / discord/events/handlers/character.creation.completed /
 *       characterThread/services/character-thread-select.service
 * on:   discord/events/handlers/discord.thread.create.requested
 */
export interface DiscordThreadCreateRequestedEvent {
  character: Character
  channelId: string
  guildId: string
  creatorId: string
  displayType?: 'basic' | 'enhanced' | 'compact'
  source: string
  timestamp: Date
}

/**
 * Discord Embed 更新リクエスト
 * emit: discord/events/handlers/character.creation.completed / characterEdit/events/handlers/character-edit-feature.handler
 * on:   events/handlers/discord-integration.handler（ログ記録のみ）
 */
export interface DiscordEmbedUpdateRequestedEvent {
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

/**
 * Discord 通知リクエスト
 * emit: discord/events/handlers/character.creation.completed
 * on:   events/handlers/discord-integration.handler（ログ記録のみ）
 */
export interface DiscordNotificationRequestedEvent {
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

// ============================================================================
// CharacterEdit Feature Events（E-4a で正式契約化）
// ============================================================================

/**
 * characterEdit モーダル表示
 * emit: characterEdit/services/character-edit-event-emitter.service
 * on:   characterEdit/events/handlers/character-edit-feature.handler
 */
export interface CharacterEditModalOpenedEvent {
  characterId: string
  userId?: string
  sessionId?: string
  timestamp: Date
  modal: {
    sectionType: CharacterEditSectionType
    fieldKey: string
    currentValue?: any
  }
}

/**
 * characterEdit モーダル送信
 * emit: characterEdit/services/character-edit-event-emitter.service
 * on:   characterEdit/events/handlers/character-edit-feature.handler
 */
export interface CharacterEditModalSubmittedEvent {
  characterId: string
  userId?: string
  sessionId?: string
  timestamp: Date
  modal: {
    sectionType: CharacterEditSectionType
    fieldKey: string
    newValue: any
    oldValue?: any
  }
}

/**
 * characterEdit Embed 更新リクエスト
 * emit: characterEdit/services/character-edit-event-emitter.service / character-edit-feature.handler（modal.submitted 連鎖）
 * on:   characterEdit/events/handlers/character-edit-feature.handler
 */
export interface CharacterEditEmbedRefreshRequestedEvent {
  characterId: string
  userId?: string
  sessionId?: string
  timestamp: Date
  embed: {
    channelId: string
    embedType: 'enhanced' | 'compact' | 'status' | 'parameter'
    section?: CharacterEditSectionType
  }
}

/**
 * characterEdit エラー発生
 * emit: characterEdit/services/character-edit-event-emitter.service / character-edit-feature.handler（emitFeatureError）
 * on:   characterEdit/events/handlers/character-edit-feature.handler（ログ記録のみ）
 */
export interface CharacterEditErrorOccurredEvent {
  characterId: string
  userId?: string
  sessionId?: string
  timestamp: Date
  error: {
    code: string
    message: string
    operation?: string
    details?: any
    severity?: 'low' | 'medium' | 'high'
  }
}

// ============================================================================
// イベント名 → payload の map 型（live 10 種のみ）
// ============================================================================

export type EventMap = {
  // Character Events
  'character.creation.requested': CharacterCreationRequestedEvent
  'character.creation.completed': CharacterCreationCompletedEvent
  'character.update.completed': CharacterUpdateCompletedEvent
  // Discord Events
  'discord.thread.create.requested': DiscordThreadCreateRequestedEvent
  'discord.embed.update.requested': DiscordEmbedUpdateRequestedEvent
  'discord.notification.requested': DiscordNotificationRequestedEvent
  // CharacterEdit Feature Events
  'characterEdit.modal.opened': CharacterEditModalOpenedEvent
  'characterEdit.modal.submitted': CharacterEditModalSubmittedEvent
  'characterEdit.embed.refresh.requested': CharacterEditEmbedRefreshRequestedEvent
  'characterEdit.error.occurred': CharacterEditErrorOccurredEvent
}

/**
 * イベント名の厳密型（EventMap に存在するイベント名のみ許可）
 */
export type EventName = keyof EventMap

/**
 * 特定のイベント名に対応する payload 型を取得
 */
export type EventPayload<T extends EventName> = EventMap[T]

/**
 * 旧名互換 alias（unified-event-contracts の従来 API）
 */
export type GetEventType<T extends EventName> = EventMap[T]

// ============================================================================
// Event Name Constants（イベント名の単一ソース・live 10 種完備）
// ============================================================================

/**
 * イベント名定数。emit / on の第1引数に渡す文字列をここに集約し、直書き（magic string）を排除する。
 * ARCHITECTURE §9（feature event 名の直書きを避ける）/ §15（event name の文字列直書き追加を禁止）に対応。
 *
 * `satisfies Record<string, EventName>` により、契約に存在しないイベント名を
 * 登録しようとするとコンパイルエラーになる（タイポ防止・契約との同期保証）。
 */
export const EVENT_NAMES = {
  // Character Events
  CHARACTER_CREATION_REQUESTED: 'character.creation.requested',
  CHARACTER_CREATION_COMPLETED: 'character.creation.completed',
  CHARACTER_UPDATE_COMPLETED: 'character.update.completed',

  // Discord Events
  DISCORD_THREAD_CREATE_REQUESTED: 'discord.thread.create.requested',
  DISCORD_EMBED_UPDATE_REQUESTED: 'discord.embed.update.requested',
  DISCORD_NOTIFICATION_REQUESTED: 'discord.notification.requested',

  // CharacterEdit Feature Events
  CHARACTER_EDIT_MODAL_OPENED: 'characterEdit.modal.opened',
  CHARACTER_EDIT_MODAL_SUBMITTED: 'characterEdit.modal.submitted',
  CHARACTER_EDIT_EMBED_REFRESH_REQUESTED: 'characterEdit.embed.refresh.requested',
  CHARACTER_EDIT_ERROR_OCCURRED: 'characterEdit.error.occurred'
} as const satisfies Record<string, EventName>

export type EventNameConstant = (typeof EVENT_NAMES)[keyof typeof EVENT_NAMES]
