/**
 * 統一イベント契約定義
 *
 * 🎯 責務:
 * - 全イベントの型定義一元管理
 * - TypeScript型安全性の保証
 * - イベント契約のSingle Source of Truth
 */

/**
 * 基本イベント構造
 */
export interface BaseEvent {
  timestamp: Date
  source: string
  correlationId?: string
  userId?: string
  sessionId?: string
}

/**
 * Requester情報（共通）
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
 * キャラクター作成データ（統一型）
 */
export interface CharacterCreationData {
  characterId?: string
  characterName: string
  gameSystemId?: string // オプショナルに変更
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

/**
 * キャラクター更新データ
 */
export interface CharacterUpdateData {
  characterName?: string
  status?: Record<string, any>
  parameter?: Record<string, any>
  skill?: Record<string, any>
  item?: Record<string, any>
  description?: Record<string, any>
  profileImageUrl?: string
  updatedAt?: Date
}

/**
 * キャラクターモデル（統一型）
 */
export interface Character {
  characterId: string
  characterName: string
  gameSystemId: string
  discordChannelId?: string
  discordUserId?: string
  discordThreadId?: string
  threadId?: string
  status: Record<string, any>
  parameter: Record<string, any>
  skill: Record<string, any>
  item: Record<string, any>
  description?: Record<string, any>
  profileImageUrl?: string
  createdAt: Date
  updatedAt: Date
}

/**
 * Discord チャンネル作成データ
 */
export interface DiscordChannelCreateData {
  name: string
  type?: 'text' | 'voice' | 'category' | 'forum' | 'thread'
  parentId?: string
  topic?: string
  nsfw?: boolean
  position?: number
  permissionOverwrites?: any[]
  rateLimitPerUser?: number
  autoArchiveDuration?: number
  reason?: string
}

/**
 * エラー情報
 */
export interface EventError {
  code: string
  message: string
  details?: any
  stack?: string
  timestamp: Date
}

// ===== Character Events =====

/**
 * キャラクター作成リクエスト
 */
export interface CharacterCreationRequestedEvent extends BaseEvent {
  type: 'character.creation.requested'
  characterId?: string
  createData: CharacterCreationData
  requester?: EventRequester
}

/**
 * キャラクター作成完了
 */
export interface CharacterCreationCompletedEvent extends BaseEvent {
  type: 'character.creation.completed'
  characterId: string
  character: Character
}

/**
 * キャラクター作成失敗
 */
export interface CharacterCreationFailedEvent extends BaseEvent {
  type: 'character.creation.failed'
  createData: CharacterCreationData
  error: EventError
}

/**
 * キャラクター更新リクエスト
 */
export interface CharacterUpdateRequestedEvent extends BaseEvent {
  type: 'character.update.requested'
  characterId?: string
  channelId?: string
  updateData: CharacterUpdateData
}

/**
 * キャラクター更新完了
 */
export interface CharacterUpdateCompletedEvent extends BaseEvent {
  type: 'character.update.completed'
  characterId: string
  character: Character
  changes: Array<{
    field: string
    oldValue: any
    newValue: any
  }>
}

/**
 * キャラクター更新失敗
 */
export interface CharacterUpdateFailedEvent extends BaseEvent {
  type: 'character.update.failed'
  characterId?: string
  channelId?: string
  updateData: CharacterUpdateData
  error: EventError
}

/**
 * キャラクター削除要求
 */
export interface CharacterDeletionRequestedEvent extends BaseEvent {
  type: 'character.deletion.requested'
  characterId: string
  userId: string
  reason?: string
  source: 'discord' | 'web' | 'api'
}

/**
 * キャラクター削除完了
 */
export interface CharacterDeletionCompletedEvent extends BaseEvent {
  type: 'character.deletion.completed'
  characterId: string
  deletedCharacterData: {
    characterName: string
    discordChannelId?: string
    discordUserId?: string
  }
}

/**
 * キャラクター削除失敗
 */
export interface CharacterDeletionFailedEvent extends BaseEvent {
  type: 'character.deletion.failed'
  characterId: string
  userId: string
  reason?: string
  error: EventError
}

/**
 * キャラクター検索リクエスト（チャンネルID）
 */
export interface CharacterFindByChannelIdRequestedEvent extends BaseEvent {
  type: 'character.findByChannelId.requested'
  channelId: string
}

/**
 * キャラクター検索完了（チャンネルID）
 */
export interface CharacterFindByChannelIdCompletedEvent extends BaseEvent {
  type: 'character.findByChannelId.completed'
  channelId: string
  character: Character | null
}

/**
 * キャラクター検索失敗（チャンネルID）
 */
export interface CharacterFindByChannelIdFailedEvent extends BaseEvent {
  type: 'character.findByChannelId.failed'
  channelId: string
  error: EventError
}

/**
 * キャラクター検索リクエスト（ID）
 */
export interface CharacterFindByIdRequestedEvent extends BaseEvent {
  type: 'character.findById.requested'
  characterId: string
}

/**
 * キャラクター検索完了（ID）
 */
export interface CharacterFindByIdCompletedEvent extends BaseEvent {
  type: 'character.findById.completed'
  characterId: string
  character: Character | null
}

/**
 * キャラクター検索失敗（ID）
 */
export interface CharacterFindByIdFailedEvent extends BaseEvent {
  type: 'character.findById.failed'
  characterId: string
  error: EventError
}

/**
 * キャラクター名検索リクエスト
 */
export interface CharacterFindByNameRequestedEvent extends BaseEvent {
  type: 'character.findByName.requested'
  characterName: string
}

/**
 * キャラクター名検索完了
 */
export interface CharacterFindByNameCompletedEvent extends BaseEvent {
  type: 'character.findByName.completed'
  characterName: string
  character: Character | null
}

/**
 * キャラクター名検索失敗
 */
export interface CharacterFindByNameFailedEvent extends BaseEvent {
  type: 'character.findByName.failed'
  characterName: string
  error: string
}

// ===== Discord Events =====

/**
 * Discordチャンネル作成リクエスト
 */
export interface DiscordChannelCreateRequestedEvent extends BaseEvent {
  type: 'discord.channel.create.requested'
  guildId: string
  channelData: DiscordChannelCreateData
  context?: {
    characterId?: string
    purpose?: string
    requesterId?: string
  }
}

/**
 * Discordチャンネル作成完了
 */
export interface DiscordChannelCreateCompletedEvent extends BaseEvent {
  type: 'discord.channel.create.completed'
  guildId: string
  channelId: string
  channel: {
    id: string
    name: string
    type: string
    parentId?: string
    position?: number
  }
  context?: any
}

/**
 * Discordチャンネル作成失敗
 */
export interface DiscordChannelCreateFailedEvent extends BaseEvent {
  type: 'discord.channel.create.failed'
  guildId: string
  channelData: DiscordChannelCreateData
  error: EventError
  context?: any
}

/**
 * Discordキャラクター表示リクエスト
 */
export interface DiscordCharacterDisplayRequestedEvent extends BaseEvent {
  type: 'discord.character.display.requested'
  character: Character
  channelId: string
  guildId: string
  requesterId: string
  displayType: 'basic' | 'enhanced' | 'summary'
}

// ===== System Events =====

/**
 * イベント処理失敗
 */
export interface EventProcessingFailedEvent extends BaseEvent {
  type: 'event.processing.failed'
  eventName: string
  handlerName: string
  correlationId: string
  error: string
  originalEvent: any
}

/**
 * デッドレターキュー
 */
export interface EventDeadLetterEvent extends BaseEvent {
  type: 'event.dead.letter'
  eventName: string
  handlerName: string
  correlationId: string
  originalEvent: any
  finalError: string
  retryCount: number
}

/**
 * 全イベント型の統合
 */
export type UnifiedEvent =
  // Character Events
  | CharacterCreationRequestedEvent
  | CharacterCreationCompletedEvent
  | CharacterCreationFailedEvent
  | CharacterUpdateRequestedEvent
  | CharacterUpdateCompletedEvent
  | CharacterUpdateFailedEvent
  | CharacterDeletionRequestedEvent
  | CharacterDeletionCompletedEvent
  | CharacterDeletionFailedEvent
  | CharacterFindByChannelIdRequestedEvent
  | CharacterFindByChannelIdCompletedEvent
  | CharacterFindByChannelIdFailedEvent
  | CharacterFindByIdRequestedEvent
  | CharacterFindByIdCompletedEvent
  | CharacterFindByIdFailedEvent
  | CharacterFindByNameRequestedEvent
  | CharacterFindByNameCompletedEvent
  | CharacterFindByNameFailedEvent
  // Discord Events
  | DiscordChannelCreateRequestedEvent
  | DiscordChannelCreateCompletedEvent
  | DiscordChannelCreateFailedEvent
  | DiscordCharacterDisplayRequestedEvent
  // System Events
  | EventProcessingFailedEvent
  | EventDeadLetterEvent

/**
 * イベント名からイベント型へのマッピング
 */
export type EventMap = {
  // Character Events
  'character.creation.requested': CharacterCreationRequestedEvent
  'character.creation.completed': CharacterCreationCompletedEvent
  'character.creation.failed': CharacterCreationFailedEvent
  'character.update.requested': CharacterUpdateRequestedEvent
  'character.update.completed': CharacterUpdateCompletedEvent
  'character.update.failed': CharacterUpdateFailedEvent
  'character.deletion.requested': CharacterDeletionRequestedEvent
  'character.deletion.completed': CharacterDeletionCompletedEvent
  'character.deletion.failed': CharacterDeletionFailedEvent
  'character.findByChannelId.requested': CharacterFindByChannelIdRequestedEvent
  'character.findByChannelId.completed': CharacterFindByChannelIdCompletedEvent
  'character.findByChannelId.failed': CharacterFindByChannelIdFailedEvent
  'character.findById.requested': CharacterFindByIdRequestedEvent
  'character.findById.completed': CharacterFindByIdCompletedEvent
  'character.findById.failed': CharacterFindByIdFailedEvent
  'character.findByName.requested': CharacterFindByNameRequestedEvent
  'character.findByName.completed': CharacterFindByNameCompletedEvent
  'character.findByName.failed': CharacterFindByNameFailedEvent
  // Discord Events
  'discord.channel.create.requested': DiscordChannelCreateRequestedEvent
  'discord.channel.create.completed': DiscordChannelCreateCompletedEvent
  'discord.channel.create.failed': DiscordChannelCreateFailedEvent
  'discord.character.display.requested': DiscordCharacterDisplayRequestedEvent
  // System Events
  'event.processing.failed': EventProcessingFailedEvent
  'event.dead.letter': EventDeadLetterEvent
}

/**
 * イベント名の型
 */
export type EventName = keyof EventMap

/**
 * 特定のイベント名に対応するイベント型を取得
 */
export type GetEventType<T extends EventName> = EventMap[T]
