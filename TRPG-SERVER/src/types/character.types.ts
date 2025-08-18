/**
 * Character関連の型定義
 * AI.architecture.mdの設計方針に基づくモジュラー型定義
 */

import { AttributeSection, AttributeValue } from '../core/types/attribute.types'
import { Discord } from './discord.types'

/**
 * Character名前空間
 * キャラクター関連の型を統一管理
 */
export namespace Character {
  /**
   * 基本エンティティ
   * データベースモデルと対応
   */
  export interface Entity {
    /** キャラクターID（UUID） */
    characterId: string
    /** キャラクター名 */
    characterName: string
    /** ゲームシステムID */
    gameSystemId: string
    /** Discord関連情報 */
    discord?: {
      userId: string
      channelId?: string
      editChannelId?: string
      threadId?: string
    }
    /** ステータス（体力、魔力など） */
    status: AttributeSection
    /** パラメータ（基本能力値など） */
    parameter?: AttributeSection
    /** スキル */
    skill?: AttributeSection
    /** アイテム */
    item?: AttributeSection
    /** 説明・設定 */
    description?: AttributeSection
    /** 作成日時 */
    createdAt: Date
    /** 更新日時 */
    updatedAt: Date
  }

  /**
   * 作成リクエスト
   * 新規キャラクター作成時の必須項目
   */
  export interface CreateRequest {
    /** キャラクター名 */
    characterName: string
    /** ゲームシステムID */
    gameSystemId: string
    /** DiscordユーザーID */
    discordUserId: string
    /** Discordチャンネル情報（オプショナル） */
    discord?: {
      channelId?: string
      threadId?: string
    }
    /** 初期ステータス（オプショナル） */
    initialData?: {
      status?: Record<string, Partial<AttributeValue>>
      parameter?: Record<string, Partial<AttributeValue>>
      skill?: Record<string, Partial<AttributeValue>>
      item?: Record<string, Partial<AttributeValue>>
      description?: Record<string, Partial<AttributeValue>>
    }
  }

  /**
   * 更新リクエスト
   * 既存キャラクターの部分更新
   */
  export interface UpdateRequest {
    /** 対象キャラクターID */
    characterId: string
    /** 更新データ */
    updates: {
      characterName?: string
      gameSystemId?: string
      discord?: Partial<Entity['discord']>
      status?: Record<string, Partial<AttributeValue>>
      parameter?: Record<string, Partial<AttributeValue>>
      skill?: Record<string, Partial<AttributeValue>>
      item?: Record<string, Partial<AttributeValue>>
      description?: Record<string, Partial<AttributeValue>>
    }
    /** 更新理由（オプショナル） */
    reason?: string
  }

  /**
   * 検索条件
   */
  export interface SearchCriteria {
    /** キャラクターID */
    characterId?: string
    /** キャラクター名（部分一致） */
    characterName?: string
    /** ゲームシステムID */
    gameSystemId?: string
    /** DiscordユーザーID */
    discordUserId?: string
    /** Discordチャンネル情報 */
    discord?: {
      channelId?: string
      threadId?: string
    }
    /** 作成日時範囲 */
    createdAt?: {
      from?: Date
      to?: Date
    }
  }

  /**
   * 表示用データ
   * UI表示に最適化されたデータ構造
   */
  export interface DisplayData extends Entity {
    /** 計算済み表示値 */
    computed: {
      /** ステータス表示値 */
      status: Record<string, number>
      /** パラメータ表示値 */
      parameter: Record<string, number>
      /** スキル表示値 */
      skill: Record<string, number>
    }
    /** 表示設定 */
    display: Discord.DisplayOptions
  }

  /**
   * サマリー情報
   * 一覧表示用の軽量データ
   */
  export interface Summary {
    /** キャラクターID */
    characterId: string
    /** キャラクター名 */
    characterName: string
    /** ゲームシステムID */
    gameSystemId: string
    /** Discordユーザー情報 */
    discord?: {
      userId: string
      username?: string
      channelId?: string
    }
    /** 主要ステータス */
    primaryStats?: Record<string, number>
    /** 最終更新日時 */
    lastUpdated: Date
  }

  /**
   * バックアップデータ
   * データ保護用の完全なスナップショット
   */
  export interface Backup {
    /** バックアップID */
    backupId: string
    /** キャラクターデータ */
    character: Entity
    /** バックアップ作成理由 */
    reason: string
    /** 作成者 */
    createdBy: string
    /** 作成日時 */
    createdAt: Date
    /** メタデータ */
    metadata: {
      version: string
      source: string
      automatic: boolean
    }
  }

  /**
   * 操作履歴
   */
  export interface AuditLog {
    /** 履歴ID */
    logId: string
    /** キャラクターID */
    characterId: string
    /** 操作タイプ */
    operation: 'create' | 'update' | 'delete' | 'restore'
    /** 変更内容 */
    changes: {
      field: string
      oldValue: unknown
      newValue: unknown
    }[]
    /** 操作者 */
    performer: {
      userId: string
      username?: string
      source: 'discord' | 'api' | 'system'
    }
    /** 操作日時 */
    timestamp: Date
    /** IPアドレス（可能な場合） */
    ipAddress?: string
  }
}

/**
 * Character関連ユーティリティ型
 */
export type CharacterId = string
export type GameSystemId = string

/**
 * キャラクター操作結果
 */
export interface CharacterOperationResult<T = Character.Entity> {
  /** 成功フラグ */
  success: boolean
  /** 結果データ */
  character?: T
  /** エラー情報 */
  error?: {
    code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'PERMISSION_DENIED' | 'CONFLICT' | 'INTERNAL_ERROR'
    message: string
    details?: Record<string, unknown>
  }
  /** 操作メタデータ */
  metadata: {
    operation: string
    timestamp: Date
    duration?: number
  }
}
