# Discord Core Services Documentation

## 📋 概要

TRPGサーバーのDiscord統合基盤を提供するコアサービス群のドキュメント。

---

## 🗂️ ファイル構成と役割

### index.ts
**役割**: Discord サービス群の統一エクスポート管理
- 新しいフォルダ構造（dice、monitoring、channel）のサービス統合
- 既存基盤サービスの維持
- 廃止済みサービスの履歴管理

**エクスポート構成**:
```typescript
// 新しいフォルダ構造のサービス
export * from './dice'           // ダイス処理統合
export * from './monitoring'     // パフォーマンス監視
export * from './channel'        // チャンネル管理

// 既存の基盤サービス（維持）
export { DiscordClientService }                 // Discord.js クライアント管理
export { CommandManagerService }                // コマンド管理
export { DiscordCommandRegistrationService }    // コマンド登録
export { DiscordGuildManagerService }           // ギルド管理
export { DiscordChannelManagerService }         // チャンネル統合オーケストレーター
export { DiscordInteractionHandlerService }     // インタラクション処理
```

### discord-client.service.ts
**役割**: Discord.js クライアント管理エンジン
**責務**: Discord との接続・通信管理、基本イベント処理

**主要機能**:
- **接続管理**: Discord へのログイン・切断処理
- **クライアント初期化**: 適切なIntentsとオプション設定
- **基本イベント処理**: Ready、ChannelCreateなどの基本イベント
- **イベント登録**: カスタムイベントハンドラーの登録機能
- **トークン管理**: 安全なトークン処理と設定検証
- **遅延初期化**: Webサーバー起動を妨げない初期化戦略

**設計パターン**: Singleton Pattern + Observer Pattern
- アプリケーション全体で単一のクライアントインスタンス
- イベント駆動アーキテクチャ

**主要メソッド**:
```typescript
// 明示的初期化（Webサーバーと分離）
initializeClient(): Promise<void>

// クライアントインスタンス取得
getClient(): Client

// イベントハンドラー登録
on(event: string, handler: (...args: any[]) => void): void
once(event: string, handler: (...args: any[]) => void): void
```

### discord-channel-manager.service.ts
**役割**: チャンネル操作統合オーケストレーター
**責務**: 専門サービス（channel/フォルダ）の統一インターフェース提供

**主要機能**:
- **サービス統合**: ChannelCreator、ChannelCache、MessageManagerの統合
- **インターフェース統一**: 外部モジュールへの一貫したAPI提供
- **エラーハンドリング**: 統一されたエラー処理と例外管理
- **パフォーマンス最適化**: キャッシュ活用とAPI呼び出し最適化
- **委譲パターン**: 適切な専門サービスへの処理振り分け

**アーキテクチャパターン**: Facade Pattern + Delegation Pattern
- 複雑なサブシステムへの統一アクセス
- 適切なサービスへの処理委譲

**委譲構造**:
```typescript
// チャンネル取得 → ChannelCacheService
getChannel(client: Client, channelId: string): Promise<Channel>

// メッセージ操作 → MessageManagerService
sendMessage(...): Promise<Message>
editMessage(...): Promise<Message>
deleteMessages(...): Promise<void>

// チャンネル管理 → ChannelCreatorService  
createChannel(...): Promise<Channel>
checkChannelPermissions(...): Promise<PermissionResult>
```

### command-manager.service.ts
**役割**: Discord コマンド管理エンジン
**責務**: Bot コマンドの登録・実行・管理

**主要機能**:
- **コマンド登録**: スラッシュコマンドの動的登録
- **実行管理**: CommandInteractionの処理と例外処理
- **オートコンプリート**: 自動補完機能の統合管理
- **エラーハンドリング**: コマンド実行エラーの統一処理
- **ライフサイクル管理**: コマンドの登録・更新・削除
- **REST API統合**: Discord REST API v10での効率的な登録

**設計パターン**: Command Pattern + Registry Pattern
- コマンド操作のオブジェクト化
- コマンドの動的登録・検索

**主要メソッド**:
```typescript
// コマンド管理
registerCommand(command: DiscordCommand): void
getCommand(name: string): DiscordCommand | undefined
getCommands(): DiscordCommand[]

// インタラクション処理
handleCommandInteraction(interaction: CommandInteraction): Promise<void>
handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void>
```

### discord-guild-manager.service.ts
**役割**: Discord ギルド（サーバー）管理エンジン
**責務**: ギルド関連操作の最適化と管理

**主要機能**:
- **ギルド情報管理**: サーバー設定とメタデータ管理
- **チャンネル一覧**: ギルド内チャンネルの効率的取得
- **権限管理**: ギルドレベルの権限確認と設定
- **キャッシュ戦略**: ギルド情報の効率的キャッシュ管理
- **パフォーマンス最適化**: API呼び出し頻度の最適化
- **メンバー管理**: ギルドメンバーの基本操作

**設計パターン**: Repository Pattern + Cache-Aside Pattern
- データアクセスの抽象化
- 効率的なキャッシュ戦略

**キャッシュ構成**:
```typescript
// ギルドキャッシュ構造
guildCache = Map<string, {
  guild: Guild
  channels: Map<string, GuildChannel>
  lastUpdate: number
}>

// TTL: 5分間
CACHE_TTL = 300000
```

### discord-command-registration.service.ts
**役割**: Discord コマンド登録専門エンジン
**責務**: スラッシュコマンドのDiscord APIへの登録

**主要機能**:
- **グローバル登録**: 全ギルドでのコマンド登録
- **ギルド固有登録**: 特定ギルド限定コマンド登録
- **バージョン管理**: コマンド定義の差分更新
- **登録状態監視**: 登録成功・失敗の詳細ログ
- **REST API最適化**: Discord REST API v10の効率利用
- **エラー復旧**: 登録失敗時の自動再試行

**設計パターン**: Builder Pattern + Strategy Pattern
- コマンド定義の段階的構築
- 登録戦略の選択

### discord-interaction-handler.service.ts
**役割**: Discord インタラクション統合処理エンジン
**責務**: 各種インタラクション（ボタン、モーダル、セレクトメニュー）の統一処理

**主要機能**:
- **インタラクション振り分け**: 適切なハンドラーへのルーティング
- **重複処理防止**: インタラクション重複実行の防止
- **エラーハンドリング**: 統一されたエラー処理とユーザー通知
- **ハンドラー管理**: 動的ハンドラー登録・検索
- **レスポンス管理**: Discord API制約に準拠したレスポンス管理
- **ログ統合**: 詳細なインタラクションログとデバッグ情報

**設計パターン**: Chain of Responsibility + Strategy Pattern
- インタラクション処理チェーン
- インタラクションタイプ別処理戦略

**処理フロー**:
```typescript
1. Interaction受信 → タイプ判定
2. 重複チェック → 処理済みフィルタリング
3. ハンドラー検索 → 適切なサービスへ委譲
4. エラーハンドリング → ユーザー通知・ログ出力
```

---

## 🏗️ アーキテクチャ設計

### サービス階層構造
```
Discord Core Services Layer
├── DiscordClientService (基盤層)
│   └── Discord.js Client管理
├── Command Layer (コマンド層)  
│   ├── CommandManagerService
│   └── DiscordCommandRegistrationService
├── Guild Layer (ギルド層)
│   └── DiscordGuildManagerService
├── Interaction Layer (インタラクション層)
│   └── DiscordInteractionHandlerService
└── Channel Orchestrator Layer (チャンネル統合層)
    └── DiscordChannelManagerService
        ├── ChannelCreatorService (channel/フォルダ)
        ├── ChannelCacheService (channel/フォルダ)
        └── MessageManagerService (channel/フォルダ)
```

### 専門フォルダとの統合
```
Core Services
├── /dice → ダイス処理統合サービス群
├── /monitoring → パフォーマンス監視サービス群  
└── /channel → チャンネル管理専門サービス群
```

### 依存関係フロー
```
External Clients
↓
DiscordChannelManagerService (統合インターフェース)
↓
Specialized Services (/dice, /monitoring, /channel)
↓  
Discord Core Services (this layer)
↓
DiscordClientService (Discord.js)
↓
Discord API
```

---

## 🚀 使用方法

### 基本的な使用パターン
```typescript
// 依存注入設定
constructor(
  private readonly discordClient: DiscordClientService,
  private readonly channelManager: DiscordChannelManagerService,
  private readonly guildManager: DiscordGuildManagerService,
  private readonly commandManager: CommandManagerService
) {}

// Discord クライアント初期化
await this.discordClient.initializeClient()
const client = this.discordClient.getClient()

// チャンネル操作（統合インターフェース）
const channel = await this.channelManager.getChannel(client, channelId)
await this.channelManager.sendMessage(client, channelId, 'Hello TRPG!')

// ギルド情報取得
const channels = await this.guildManager.getGuildChannels(client, guildId)
```

### 高度な使用パターン
```typescript
// コマンド登録・実行
const command = new TRPGCommand()
this.commandManager.registerCommand(command)

// インタラクション処理設定
this.discordClient.on('interactionCreate', async (interaction) => {
  if (interaction.isCommand()) {
    await this.commandManager.handleCommandInteraction(interaction)
  } else {
    await this.interactionHandler.handleInteraction(interaction)
  }
})

// 専門サービス直接利用（特殊用途）
const diceResult = await this.diceService.executeBasicNotation('1d100')
const performanceStats = await this.monitoringService.getPerformanceSummary()
```

### エラーハンドリングパターン
```typescript
try {
  await this.discordClient.initializeClient()
} catch (error) {
  this.logger.error('Discord initialization failed', error)
  // フォールバック処理またはアプリケーション終了
}

// 統合サービス使用時（null チェック）
const message = await this.channelManager.sendMessage(client, channelId, content)
if (!message) {
  this.logger.warn('Message send failed, handling gracefully')
  // 適切なフォールバック処理
}
```

---

## 📊 パフォーマンス特性

### レスポンス時間目安
- **Discord クライアント初期化**: ~2-5秒
- **チャンネル取得（キャッシュヒット）**: ~1-5ms
- **チャンネル取得（API フェッチ）**: ~50-200ms  
- **コマンド実行**: ~10-100ms
- **ギルド情報取得（キャッシュヒット）**: ~1-10ms

### キャッシュ効率
- **ギルドキャッシュヒット率**: 80-95%
- **チャンネルキャッシュヒット率**: 85-95%
- **キャッシュTTL**: 5分（設定可能）

### リソース使用量
- **メモリ使用量**: ~5-20MB（ギルドサイズに依存）
- **Discord API呼び出し**: レート制限遵守
- **同時接続**: WebSocket 1接続

---

## 🔧 設定とカスタマイズ

### 環境変数設定
```typescript
// Discord設定
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here

// キャッシュ設定
DISCORD_CACHE_TTL=300000          // キャッシュ有効期限（ms）
DISCORD_GUILD_CACHE_LIMIT=100     // ギルドキャッシュ数制限

// API設定
DISCORD_API_VERSION=10            // Discord REST API バージョン
DISCORD_RATE_LIMIT_TIMEOUT=60000  // レート制限タイムアウト
```

### クライアント設定カスタマイズ
```typescript
// Intents設定
const clientOptions: ClientOptions = {
  intents: [
    GatewayIntentBits.Guilds,           // ギルド情報
    GatewayIntentBits.GuildMessages,    // メッセージ
    GatewayIntentBits.MessageContent,   // メッセージ内容
    GatewayIntentBits.GuildMembers      // メンバー情報
  ],
  partials: [Partials.Channel],         // 部分データ対応
  presence: {                           // Bot ステータス
    status: 'online',
    activities: [{ name: 'TRPG Session', type: ActivityType.Playing }]
  }
}
```

### コマンド登録設定
```typescript
// グローバルコマンド vs ギルド固有コマンド
const registrationOptions = {
  global: true,                    // 全ギルドで利用可能
  guildId: 'specific_guild_id',    // 特定ギルドのみ
  overwrite: true,                 // 既存コマンド上書き
  timeout: 30000                   // 登録タイムアウト
}
```

---

## 🚨 トラブルシューティング

### よくある問題
1. **Discord初期化失敗**
   - 原因: トークン不正、ネットワーク問題、権限不足
   - 対処: トークン確認、ネットワーク診断、Bot権限設定確認

2. **コマンド登録失敗** 
   - 原因: API制限、重複登録、権限不足
   - 対処: レート制限確認、コマンド名重複チェック、権限見直し

3. **キャッシュヒット率低下**
   - 原因: TTL短すぎ、メモリ不足、頻繁なクリアー
   - 対処: TTL延長、メモリ増量、クリーンアップ頻度調整

4. **インタラクション処理失敗**
   - 原因: タイムアウト、重複処理、ハンドラー未登録
   - 対処: タイムアウト延長、重複防止確認、ハンドラー登録確認

### 診断コマンド
```typescript
// Discord接続状態確認
const client = discordClientService.getClient()
console.log('Client Ready:', client.isReady())
console.log('Guilds Count:', client.guilds.cache.size)

// キャッシュ状態確認
const guildCacheStats = guildManagerService.getCacheStats()
console.log('Guild Cache Stats:', guildCacheStats)

// コマンド登録状態確認
const commands = commandManagerService.getCommands()
console.log('Registered Commands:', commands.map(c => c.data.name))

// パフォーマンス監視
const performanceStats = monitoringService.getPerformanceSummary()
console.log('Performance Stats:', performanceStats)
```

### メンテナンス手順
```typescript
// キャッシュクリーンアップ
guildManagerService.cleanup()
channelCacheService.clearCache()

// コマンド再登録
await commandRegistrationService.registerAllCommands()

// Discord再接続
await discordClientService.getClient().destroy()
await discordClientService.initializeClient()

// システムリセット（緊急時）
monitoringService.resetMonitoring()
```

---

*最終更新: 2025-08-21*