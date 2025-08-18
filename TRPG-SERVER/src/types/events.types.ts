/**
 * Events関連の型定義
 * AI.architecture.mdの設計方針に基づくイベント型統一管理
 */

import { Character } from './character.types'
import { Discord } from './discord.types'
import { AttributeValue } from '../core/types/attribute.types'

/**
 * Events名前空間
 * システム内イベントの型を統一管理
 */
export namespace Events {
  /**
   * 基本イベント構造
   */
  export interface BaseEvent {
    /** イベントID（UUID） */
    eventId: string
    /** 相関ID（トレース用） */
    correlationId: string
    /** イベント発生日時 */
    timestamp: Date
    /** イベント発行者 */
    source: string
    /** イベントバージョン */
    version: string
  }

  /**
   * キャラクター作成イベント
   */
  export interface CharacterCreated extends BaseEvent {
    /** 作成されたキャラクター */
    character: Character.Entity
    /** Discord統合情報 */
    discordIntegration?: Discord.CharacterChannel
    /** 作成リクエスト情報 */
    requestInfo: {
      requestId: string
      requestedBy: string
      requestedAt: Date
    }
  }

  /**
   * キャラクター更新イベント
   */
  export interface CharacterUpdated extends BaseEvent {
    /** キャラクターID */
    characterId: string
    /** 変更内容 */
    changes: Array<{
      field: string
      oldValue: unknown
      newValue: unknown
      changeType: 'create' | 'update' | 'delete'
    }>
    /** 更新後のキャラクター */
    character: Character.Entity
    /** 更新理由 */
    reason?: string
    /** 更新者情報 */
    updatedBy: {
      userId: string
      username?: string
      source: 'discord' | 'api' | 'system'
    }
  }

  /**
   * キャラクター削除イベント
   */
  export interface CharacterDeleted extends BaseEvent {
    /** 削除されたキャラクターID */
    characterId: string
    /** 削除されたキャラクター（バックアップ用） */
    character: Character.Entity
    /** 削除理由 */
    reason: string
    /** 削除者情報 */
    deletedBy: {
      userId: string
      username?: string
      source: 'discord' | 'api' | 'system'
    }
    /** ソフト削除フラグ */
    softDelete: boolean
  }

  /**
   * Discord表示更新イベント
   */
  export interface DiscordDisplayUpdated extends BaseEvent {
    /** キャラクターID */
    characterId: string
    /** 更新されたEmbed */
    embed: Discord.Embed
    /** 表示オプション */
    displayOptions: Discord.DisplayOptions
    /** 更新対象チャンネル */
    channelInfo: Discord.ChannelInfo
    /** 更新トリガー */
    trigger: 'character_update' | 'display_refresh' | 'user_request' | 'system_maintenance'
  }

  /**
   * 属性値変更イベント
   */
  export interface AttributeValueChanged extends BaseEvent {
    /** キャラクターID */
    characterId: string
    /** セクション名 */
    section: 'status' | 'parameter' | 'skill' | 'item' | 'description'
    /** フィールド名 */
    fieldName: string
    /** 変更前の値 */
    oldValue?: AttributeValue
    /** 変更後の値 */
    newValue: AttributeValue
    /** 変更タイプ */
    changeType: 'increment' | 'decrement' | 'set' | 'reset'
    /** 変更量（数値の場合） */
    delta?: number
  }

  /**
   * Discord統合エラーイベント
   */
  export interface DiscordIntegrationError extends BaseEvent {
    /** エラーコード */
    errorCode: string
    /** エラーメッセージ */
    errorMessage: string
    /** エラー詳細 */
    errorDetails: {
      operation: string
      channelId?: string
      userId?: string
      characterId?: string
      stackTrace?: string
    }
    /** リトライ情報 */
    retryInfo?: {
      attemptCount: number
      maxAttempts: number
      nextRetryAt?: Date
    }
  }

  /**
   * システムイベント
   */
  export interface SystemEvent extends BaseEvent {
    /** イベントタイプ */
    eventType: 'startup' | 'shutdown' | 'maintenance' | 'backup' | 'health_check'
    /** イベント詳細 */
    details: Record<string, unknown>
    /** 影響レベル */
    severity: 'info' | 'warning' | 'error' | 'critical'
    /** 通知設定 */
    notifications?: Discord.NotificationSettings
  }

  /**
   * データ同期イベント
   */
  export interface DataSynchronized extends BaseEvent {
    /** 同期タイプ */
    syncType: 'character_backup' | 'discord_sync' | 'cache_refresh'
    /** 同期対象 */
    targets: string[]
    /** 同期結果 */
    result: {
      success: boolean
      processedCount: number
      errorCount: number
      duration: number
    }
    /** エラー詳細（存在する場合） */
    errors?: Array<{
      target: string
      error: string
    }>
  }
}

/**
 * イベント型の共用体型
 * すべてのイベント型を包括
 */
export type SystemEvent =
  | Events.CharacterCreated
  | Events.CharacterUpdated
  | Events.CharacterDeleted
  | Events.DiscordDisplayUpdated
  | Events.AttributeValueChanged
  | Events.DiscordIntegrationError
  | Events.SystemEvent
  | Events.DataSynchronized

/**
 * イベントハンドラー型
 */
export interface EventHandler<T extends Events.BaseEvent = SystemEvent> {
  /** ハンドラー名 */
  name: string
  /** 処理対象イベント型 */
  eventType: string
  /** ハンドラー実行 */
  handle(event: T): Promise<void>
  /** エラーハンドリング */
  onError?(event: T, error: Error): Promise<void>
}

/**
 * イベント発行者インターフェース
 */
export interface EventEmitter {
  /** イベント発行 */
  emit<T extends Events.BaseEvent>(eventType: string, event: T): Promise<void>
  /** イベントリスナー登録 */
  on<T extends Events.BaseEvent>(eventType: string, handler: EventHandler<T>): void
  /** イベントリスナー削除 */
  off(eventType: string, handler: EventHandler): void
}

/**
 * イベントストア
 * イベント永続化用
 */
export interface EventStore {
  /** イベント保存 */
  save(event: SystemEvent): Promise<void>
  /** イベント検索 */
  find(criteria: {
    eventType?: string
    source?: string
    correlationId?: string
    from?: Date
    to?: Date
  }): Promise<SystemEvent[]>
  /** イベント削除（アーカイブ） */
  archive(criteria: { olderThan: Date }): Promise<number>
}
