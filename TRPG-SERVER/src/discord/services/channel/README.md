# Channel Services Documentation

## 📋 概要

TRPGサーバーのDiscordチャンネル管理を行うサービス群のドキュメント。

---

## 🗂️ ファイル構成と役割

### index.ts
**役割**: チャンネルサービス群のエクスポート管理
- 各チャンネルサービスのエクスポート統合
- 外部モジュールからのアクセスポイント
- DiscordChannelManagerServiceオーケストレーター経由での統合利用を推奨

**提供内容**:
```typescript
export { ChannelCreatorService } from './channel-creator.service'
export { ChannelCacheService } from './channel-cache.service'  
export { MessageManagerService } from './message-manager.service'

// 注意: チャンネル管理はDiscordChannelManagerServiceオーケストレーターを通じて統合利用
```

### channel-creator.service.ts
**役割**: チャンネル作成・権限管理エンジン
**責務**: チャンネル作成・設定、権限管理・アクセス制御、カテゴリ管理

**主要機能**:
- **チャンネル作成**: テキスト・ボイス・カテゴリチャンネルの作成
- **スレッド管理**: パブリック・プライベートスレッドの作成と管理
- **権限管理**: ユーザー・ロール別の詳細権限設定
- **チャンネル設定**: 名前、トピック、制限の動的設定
- **チャンネル削除**: 安全なチャンネル削除とクリーンアップ
- **情報取得**: チャンネル詳細情報の包括的取得

**アーキテクチャパターン**: Factory Pattern + Builder Pattern
- チャンネルタイプ別の作成戦略
- 複雑な設定の段階的構築

**主要メソッド**:
```typescript
// チャンネル情報取得
getChannelInfo(client: Client, channelId: string): Promise<ChannelInfo | null>

// チャンネル作成
createChannel(client: Client, guildId: string, name: string, options?: ChannelOptions): Promise<TextChannel | NewsChannel | null>

// スレッド作成
createThread(client: Client, channelId: string, name: string, options?: ThreadOptions): Promise<ThreadChannel | null>

// 権限確認・設定
checkChannelPermissions(client: Client, channelId: string, userId: string, permissions: string[]): Promise<PermissionCheck>
setChannelPermissions(client: Client, channelId: string, targetId: string, permissions: PermissionSettings, isRole?: boolean): Promise<boolean>

// カテゴリ管理
createCategory(client: Client, guildId: string, name: string, options?: CategoryOptions): Promise<CategoryChannel | null>
```

### channel-cache.service.ts
**役割**: チャンネルキャッシュ管理エンジン
**責務**: チャンネル情報のキャッシュ管理、メッセージキャッシュの最適化、パフォーマンス向上とメモリ効率化

**主要機能**:
- **インテリジェントキャッシュ**: TTLベースの自動キャッシュ管理
- **メッセージキャッシュ**: チャンネル別メッセージの効率的キャッシュ
- **メモリ最適化**: 動的サイズ制限とLRU回収戦略
- **パフォーマンス監視**: キャッシュ統計とメモリ使用量追跡
- **自動メンテナンス**: 定期的なキャッシュクリーンアップ
- **Snowflake処理**: Discordの雪片IDからタイムスタンプ抽出

**設計パターン**: Cache-Aside Pattern + LRU Eviction Strategy
- オンデマンドキャッシュ更新
- 最近使用頻度に基づく回収

**キャッシュ設定**:
```typescript
// 環境変数による動的設定
CACHE_TTL: 300000 // 5分
MESSAGE_CACHE_LIMIT: 30 // メッセージ数制限
MAX_CHANNEL_CACHE: 50 // チャンネル数制限
```

**主要メソッド**:
```typescript
// キャッシュからチャンネル取得
getChannel(client: Client, channelId: string): Promise<TextChannel | NewsChannel | ThreadChannel | null>

// メッセージキャッシュ操作
getMessageFromCache(channelId: string, messageId: string): Promise<Message | null>
addMessageToCache(channelId: string, message: Message): void
removeMessageFromCache(channelId: string, messageId: string): void

// キャッシュメンテナンス
getCacheStats(): CacheStatistics
clearCache(): void
performMaintenance(): Promise<void>
```

### message-manager.service.ts
**役割**: メッセージ管理エンジン
**責務**: メッセージ送信・編集・削除、Embed・コンポーネント管理、メッセージ履歴操作

**主要機能**:
- **リッチメッセージ送信**: テキスト・Embed・コンポーネント付きメッセージ
- **メッセージ編集**: 動的コンテンツ更新とコンポーネント変更
- **一括削除**: 効率的なメッセージクリーンアップ
- **履歴管理**: メッセージ履歴取得とフィルタリング
- **リアクション管理**: 絵文字リアクション追加・管理
- **自動クリーンアップ**: 期間指定での古いメッセージ削除

**設計パターン**: Command Pattern + Batch Processing
- メッセージ操作のコマンド化
- 大量操作の効率的バッチ処理

**主要メソッド**:
```typescript
// メッセージ操作
sendMessage(client: Client, channelId: string, content: string, options?: MessageOptions): Promise<Message>
editMessage(client: Client, channelId: string, messageId: string, content?: string, options?: EditOptions): Promise<Message>
deleteMessage(client: Client, channelId: string, messageId: string): Promise<void>

// 一括操作
deleteMessages(client: Client, channelId: string, messageIds: string[], reason?: string): Promise<void>
deleteOldMessages(client: Client, channelId: string, daysOld: number, limit?: number): Promise<number>

// 履歴・リアクション
getMessageHistory(client: Client, channelId: string, options?: HistoryOptions): Promise<Message[]>
addReaction(client: Client, channelId: string, messageId: string, emoji: string): Promise<void>
```

---

## 🏗️ アーキテクチャ設計

### サービス間依存関係
```
DiscordChannelManagerService (オーケストレーター層)
├── ChannelCreatorService (作成・権限層)
├── ChannelCacheService (キャッシュ層)
└── MessageManagerService (メッセージ層)
```

### 外部依存関係
```
External Dependencies
├── Discord.js Client - Discord API操作
├── ErrorHandler Utils - エラーハンドリング
├── AppConfigService - 設定管理
└── Node.js Timers - キャッシュメンテナンス
```

### データフロー
```
1. ChannelCreatorService → チャンネル作成・権限設定
2. ChannelCacheService → パフォーマンス最適化
3. MessageManagerService → メッセージ処理
4. DiscordChannelManagerService → 統合制御・調整
```

---

## 🚀 使用方法

### 基本的な使用パターン（推奨）
```typescript
// 統合オーケストレーター経由（推奨）
constructor(
  private readonly discordChannelManager: DiscordChannelManagerService
) {}

// チャンネル作成
const channel = await this.discordChannelManager.createChannel(guildId, 'new-channel', {
  type: ChannelType.GuildText,
  topic: 'TRPG discussion channel'
})

// メッセージ送信
await this.discordChannelManager.sendMessage(channel.id, 'Welcome!', {
  embeds: [welcomeEmbed]
})
```

### 個別サービス使用（特殊用途）
```typescript
// 個別サービス直接使用
constructor(
  private readonly channelCreator: ChannelCreatorService,
  private readonly channelCache: ChannelCacheService,
  private readonly messageManager: MessageManagerService
) {}

// キャッシュ経由チャンネル取得
const channel = await this.channelCache.getChannel(client, channelId)

// 権限チェック
const permissions = await this.channelCreator.checkChannelPermissions(
  client, channelId, userId, ['VIEW_CHANNEL', 'SEND_MESSAGES']
)

// メッセージクリーンアップ
const deletedCount = await this.messageManager.deleteOldMessages(
  client, channelId, 7, 100
)
```

### 高度な使用パターン
```typescript
// 複合操作例: カテゴリ付きチャンネル作成
const category = await this.channelCreator.createCategory(client, guildId, 'TRPG Sessions')
const channel = await this.channelCreator.createChannel(client, guildId, 'session-1', {
  parent: category.id,
  type: ChannelType.GuildText,
  permissions: [
    {
      id: roleId,
      allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
      deny: ['MANAGE_MESSAGES']
    }
  ]
})

// キャッシュ統計監視
const stats = this.channelCache.getCacheStats()
if (stats.memoryUsageEstimate > 1000) {
  await this.channelCache.performMaintenance()
}
```

---

## 📊 パフォーマンス特性

### レスポンス時間目安
- **チャンネル取得（キャッシュヒット）**: ~1ms
- **チャンネル取得（APIフェッチ）**: ~50-150ms
- **チャンネル作成**: ~100-300ms
- **メッセージ送信**: ~50-100ms
- **一括メッセージ削除**: ~200-500ms（100件）

### キャッシュ効率
- **ヒット率**: 85-95%（典型的な使用パターン）
- **メモリ使用量**: ~2KB/チャンネル + ~1KB/メッセージ
- **TTL**: 5分（環境変数で調整可能）

### 制限事項
- **Discord API制限**: レート制限遵守
- **一括削除**: 最大100件/リクエスト
- **キャッシュサイズ**: デフォルト50チャンネル + 30メッセージ/チャンネル
- **メッセージ履歴**: 最大取得数制限あり

---

## 🔧 設定とカスタマイズ

### 環境変数設定
```typescript
// キャッシュ設定
DISCORD_CACHE_TTL=300000          // キャッシュ有効期限（ms）
DISCORD_MESSAGE_CACHE_LIMIT=30    // メッセージキャッシュ数
DISCORD_CHANNEL_CACHE_LIMIT=50    // チャンネルキャッシュ数

// メンテナンス設定
DISCORD_CLEANUP_INTERVAL=60000    // クリーンアップ間隔（ms）
DISCORD_MEMORY_THRESHOLD=1000     // メモリ閾値（KB）
```

### カスタムチャンネル設定
```typescript
// チャンネル作成オプション
const channelOptions = {
  type: ChannelType.GuildText,
  parent: categoryId,
  topic: 'Custom topic',
  nsfw: false,
  rateLimitPerUser: 30,
  permissions: [
    {
      id: '@everyone',
      deny: ['SEND_MESSAGES']
    },
    {
      id: playerRoleId,
      allow: ['VIEW_CHANNEL', 'SEND_MESSAGES']
    }
  ]
}
```

### メッセージオプション設定
```typescript
// リッチメッセージ設定
const messageOptions = {
  embeds: [
    new EmbedBuilder()
      .setTitle('TRPG Session')
      .setDescription('Session started!')
      .setColor(0x00FF00)
  ],
  components: [
    new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('join-session')
          .setLabel('Join Session')
          .setStyle(ButtonStyle.Primary)
      )
  ]
}
```

---

## 🚨 トラブルシューティング

### よくある問題
1. **チャンネル作成失敗**
   - 原因: 権限不足、名前重複、制限到達
   - 対処: 権限確認、名前一意性チェック、制限確認

2. **キャッシュミス率上昇**
   - 原因: TTL短すぎ、メモリ不足、頻繁なクリーンアップ
   - 対処: TTL延長、メモリ増量、閾値調整

3. **メッセージ送信失敗**
   - 原因: レート制限、権限不足、コンテンツ制限
   - 対処: 再試行ロジック、権限確認、コンテンツ検証

### 診断コマンド
```typescript
// キャッシュ状態確認
const cacheStats = channelCacheService.getCacheStats()
console.log('Cache Statistics:', JSON.stringify(cacheStats, null, 2))

// チャンネル権限確認
const permissions = await channelCreatorService.checkChannelPermissions(
  client, channelId, userId, ['VIEW_CHANNEL', 'SEND_MESSAGES']
)
console.log('Permission Check:', permissions)

// メモリ使用量確認
const stats = channelCacheService.getCacheStats()
if (stats.memoryUsageEstimate > 1000) {
  console.warn('High memory usage detected:', stats.memoryUsageEstimate, 'KB')
}
```

### メンテナンスタスク
```typescript
// 定期メンテナンス
await channelCacheService.performMaintenance()

// 古いメッセージクリーンアップ
const deletedCount = await messageManagerService.deleteOldMessages(
  client, channelId, 30, 1000
)

// キャッシュリセット
channelCacheService.clearCache()
```

---

*最終更新: 2025-08-21*