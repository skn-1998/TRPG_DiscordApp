/**
 * Discord関連の型定義
 * AI.architecture.mdの設計方針に基づく具体型定義
 */

/**
 * Discord名前空間
 * Discord API関連の型を統一管理
 */
export namespace Discord {
  /**
   * Discord Embedフィールド
   */
  export interface EmbedField {
    /** フィールド名 */
    name: string
    /** フィールド値 */
    value: string
    /** インライン表示フラグ */
    inline?: boolean
  }

  /**
   * Discord Embed型
   * Discord.js EmbedBuilderと互換性を保つ
   */
  export interface Embed {
    /** タイトル */
    title?: string
    /** 説明文 */
    description?: string
    /** 色（16進数） */
    color?: number
    /** フィールド配列 */
    fields?: EmbedField[]
    /** サムネイル画像 */
    thumbnail?: {
      url: string
      height?: number
      width?: number
    }
    /** メイン画像 */
    image?: {
      url: string
      height?: number
      width?: number
    }
    /** フッター */
    footer?: {
      text: string
      icon_url?: string
    }
    /** 作成者情報 */
    author?: {
      name: string
      url?: string
      icon_url?: string
    }
    /** タイムスタンプ */
    timestamp?: string
    /** URL */
    url?: string
  }

  /**
   * 表示オプション
   * UIの表示制御用設定
   */
  export interface DisplayOptions {
    /** アバター表示フラグ */
    showAvatar: boolean
    /** タイムスタンプ表示フラグ */
    showTimestamp: boolean
    /** コンパクトモードフラグ */
    compactMode: boolean
    /** 色テーマ */
    theme?: 'light' | 'dark' | 'auto'
    /** アニメーション有効フラグ */
    enableAnimations?: boolean
  }

  /**
   * Discordチャンネル情報
   */
  export interface ChannelInfo {
    /** チャンネルID */
    channelId: string
    /** チャンネル名 */
    channelName?: string
    /** ギルドID */
    guildId?: string
    /** チャンネルタイプ */
    type?: 'text' | 'voice' | 'thread' | 'category'
  }

  /**
   * Discordユーザー情報
   */
  export interface UserInfo {
    /** ユーザーID */
    userId: string
    /** ユーザー名 */
    username?: string
    /** 表示名 */
    displayName?: string
    /** アバターURL */
    avatarUrl?: string
  }

  /**
   * キャラクター-Discordチャンネル関連付け
   */
  export interface CharacterChannel {
    /** Discordチャンネル情報 */
    channel: ChannelInfo
    /** Discordユーザー情報 */
    user: UserInfo
    /** キャラクターID */
    characterId: string
    /** 権限設定 */
    permissions?: string[]
    /** 作成日時 */
    createdAt: Date
    /** 最終更新日時 */
    updatedAt?: Date
  }

  /**
   * イベント通知設定
   */
  export interface NotificationSettings {
    /** 通知有効フラグ */
    enabled: boolean
    /** 通知チャンネルID */
    notificationChannelId?: string
    /** 通知レベル */
    level: 'all' | 'important' | 'critical'
    /** メンション設定 */
    mentions: {
      users: boolean
      roles: boolean
      everyone: boolean
    }
  }
}

/**
 * Discord関連ユーティリティ型
 */
export type DiscordId = string
export type GuildId = string
export type ChannelId = string
export type UserId = string

/**
 * Discord操作結果
 */
export interface DiscordOperationResult<T = unknown> {
  /** 成功フラグ */
  success: boolean
  /** 結果データ */
  data?: T
  /** エラー情報 */
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  /** 操作タイムスタンプ */
  timestamp: Date
}
