# Character Edit Feature Module

キャラクター編集機能を統合したNestJSモジュールです。Bulletproof React概念に基づく設計により、保守性、テスタビリティ、拡張性を重視しています。

## 🏗️ アーキテクチャ

### モジュール構造

```
characterEdit/
├── character-edit.module.ts              # Modern Services用モジュール (Discord依存関係なし)
├── character-edit-shared.module.ts       # Discord依存関係があるShared Services用モジュール
├── services/                             # 分離されたサービス群 (Discord依存関係なし)
│   ├── channel-detection.service.ts      # チャンネル検出ロジック
│   ├── character-creation.service.ts     # キャラクター作成ロジック
│   ├── character-notification.service.ts # 通知・UI表示ロジック (自己完結型)
│   ├── channel-create-orchestrator.service.ts # 統合オーケストレーター
│   ├── *.spec.ts                         # テストファイル
│   └── index.ts                          # サービスエクスポート
├── character-channel-create.service.ts   # レガシー互換サービス (Discord依存関係あり)
├── chara-info-button.service.ts          # Discord依存関係あり
├── add-chara-info.service.ts             # Discord依存関係あり
├── change-chara-info.service.ts          # Discord依存関係あり
├── README.md                             # 使用方法ドキュメント
└── index.ts                              # 統合エクスポート
```

### 設計原則

1. **単一責任原則**: 各サービスが明確な責任を持つ
2. **関心の分離**: 機能別にサービスを分離
3. **型安全性**: TypeScriptの恩恵を最大限活用
4. **テスタビリティ**: 独立したテスト可能なコンポーネント
5. **NestJS依存性注入**: 適切なモジュール管理
6. **グローバルモジュール活用**: `AppConfigService`など共通サービスの効率的な利用

## 🚀 使用方法

### 1. モジュールのインポート

#### CharacterEditModule（統合モジュール - 推奨）

```typescript
import { CharacterEditModule } from './features/characterEdit/character-edit.module'

@Module({
  imports: [
    CharacterEditModule,  // Modern Services + Legacy Services (全て統合)
    // その他のモジュール...
  ],
  // ...
})
export class YourModule {}
```

#### 個別にDiscordIntegrationServiceのみ使用する場合

```typescript
import { DiscordIntegrationModule } from './discord/application/discord-integration.module'

@Module({
  imports: [
    DiscordIntegrationModule,  // DiscordIntegrationServiceのみ
    // その他のモジュール...
  ],
  // ...
})
export class YourModule {}
```



### 2. サービスの使用（推奨）

```typescript
import { Injectable } from '@nestjs/common'
import { ChannelCreateOrchestratorService } from './services'

@Injectable()
export class YourService {
  constructor(
    private readonly orchestratorService: ChannelCreateOrchestratorService
  ) {}

  async handleChannelCreate(channel: TextChannel) {
    // 新しいオーケストレーターサービスを使用
    await this.orchestratorService.execute(channel)
  }
}
```

### 3. 個別サービスの使用

```typescript
import { Injectable } from '@nestjs/common'
import { 
  ChannelDetectionService,
  CharacterCreationService,
  CharacterNotificationService 
} from './services'

@Injectable()
export class CustomService {
  constructor(
    private readonly channelDetectionService: ChannelDetectionService,
    private readonly characterCreationService: CharacterCreationService,
    private readonly characterNotificationService: CharacterNotificationService
  ) {}

  async customFlow(channel: TextChannel) {
    // カスタムフローの実装
    const detectionResult = await this.channelDetectionService.detectCharacterChannel(channel)
    
    if (detectionResult.shouldCreateCharacter && detectionResult.context) {
      const creationResult = await this.characterCreationService.createCharacter(detectionResult.context)
      
      if (creationResult.success) {
        await this.characterNotificationService.notifyCharacterCreation(
          channel,
          creationResult.characterId!,
          creationResult.characterName!
        )
      }
    }
  }
}
```

### 4. レガシーサービスの使用（後方互換性）

```typescript
import { Injectable } from '@nestjs/common'
import { ChannelCreateService } from './character-channel-create.service'

@Injectable()
export class LegacyService {
  constructor(
    private readonly channelCreateService: ChannelCreateService
  ) {}

  async handleChannelCreate(channel: TextChannel) {
    // 既存コードはそのまま動作（内部で新しいサービスに委譲）
    await this.channelCreateService.execute(channel)
  }
}
```

## 🧪 テスト

各サービスには包括的なテストが用意されています：

```bash
# 特定のサービスのテスト実行
pnpm test channel-detection.service.spec.ts
pnpm test character-creation.service.spec.ts
pnpm test character-notification.service.spec.ts
pnpm test channel-create-orchestrator.service.spec.ts

# 全テスト実行
pnpm test characterEdit
```

### テストカバレッジ

- `ChannelDetectionService`: チャンネル検出ロジックの全パターン
- `CharacterCreationService`: キャラクター作成の成功・失敗ケース
- `CharacterNotificationService`: 通知送信の成功・失敗ケース
- `ChannelCreateOrchestratorService`: 統合フローの全パターン

## 📚 型定義

### ChannelCreationContext

```typescript
interface ChannelCreationContext {
  channel: TextChannel      // Discord チャンネル
  categoryId: string        // カテゴリID
  creatorId: string | null  // 作成者ID（取得できない場合はnull）
}
```

### CharacterCreationResult

```typescript
interface CharacterCreationResult {
  success: boolean          // 処理成功フラグ
  characterId?: string      // 作成されたキャラクターID
  characterName?: string    // 作成されたキャラクター名
  error?: string           // エラーメッセージ
}
```

### ChannelCreationResult

```typescript
interface ChannelCreationResult {
  success: boolean                    // 処理成功フラグ
  shouldCreateCharacter: boolean      // キャラクター作成要否
  context?: ChannelCreationContext    // 作成コンテキスト
  error?: string                     // エラーメッセージ
}
```

## 🔧 設定

### グローバルモジュール

`AppConfigService`は`@Global()`デコレータが付いたグローバルモジュールです：

```typescript
// AppConfigModule は既にグローバルに登録されているため、
// 各モジュールでインポートする必要がありません
@Injectable()
export class YourService {
  constructor(
    private readonly configService: AppConfigService  // 自動的に利用可能
  ) {}
}
```

### 環境変数

- `DISCORD_CHARACTER_CATEGORY`: キャラクター作成対象のカテゴリ名

### 設定値

```typescript
export const CHARACTER_EDIT_CONFIG = {
  MAX_INPUT_LENGTH: 2000,
  AUTO_DELETE_ERROR_TIMEOUT: 5000,
  SUPPORTED_FIELDS: ['status', 'parameter', 'skill'] as const,
  AUDIT_LOG_LIMIT: 10,
  DEFAULT_GAME_SYSTEM_ID: '',
  NOTIFICATION_TIMEOUT: 30000
} as const
```

## 🚧 移行ガイド

### 既存コードからの移行

1. **段階的移行**: 既存のコードはそのまま動作します
2. **新機能**: 新しい機能は`ChannelCreateOrchestratorService`を使用
3. **テスト**: 各段階でテストを実行して動作確認

### 推奨移行パス

1. `CharacterEditModule`をインポート
2. 既存のサービス個別インポートを削除
3. 新しいオーケストレーターサービスに移行
4. カスタムロジックが必要な場合は個別サービスを使用

## 📈 今後の拡張

- 新しいゲームシステム対応
- リアルタイム通知機能
- キャラクター編集履歴機能
- 権限管理機能

## 🐛 トラブルシューティング

### よくある問題

1. **依存性注入エラー**: `CharacterEditModule`が正しくインポートされているか確認
2. **型エラー**: 最新の型定義を使用しているか確認
3. **テスト失敗**: モックが正しく設定されているか確認

### ログレベル

- `LOG`: 正常な処理フロー
- `WARN`: 警告（作成者ID取得失敗など）
- `ERROR`: エラー（キャラクター作成失敗など）

## 🧪 テスト

各サービスには包括的なテストが用意されています：

### テスト実行

```bash
# 特定のサービスのテスト実行
pnpm test channel-detection.service.spec.ts
pnpm test character-creation.service.spec.ts
pnpm test character-notification.service.spec.ts
pnpm test channel-create-orchestrator.service.spec.ts

# 全テスト実行
pnpm test characterEdit

# MongoDB Atlas CRUD テスト
pnpm test character.crud.spec.ts

# イベント統合テスト  
pnpm test character.integration.spec.ts
```

### テストカバレッジ

- `ChannelDetectionService`: チャンネル検出ロジックの全パターン
- `CharacterCreationService`: キャラクター作成の成功・失敗ケース
- `CharacterNotificationService`: 通知送信の成功・失敗ケース
- `ChannelCreateOrchestratorService`: 統合フローの全パターン

### テスト戦略

#### 1. 単純CRUD テスト (`character.crud.spec.ts`)
- **MongoDB Atlas** を使用した実際のDB操作テスト
- **9/9 テスト合格** - AttributeValue システム完全対応
- Create, Read, Update, Delete の基本操作検証

#### 2. イベント統合テスト (`character.integration.spec.ts`)
- イベント駆動アーキテクチャの動作検証
- MongoDB Atlas + EventEmitter2 統合
- 非同期イベントフローのE2Eテスト

#### 3. 品質指標

```typescript
// テスト結果サマリ
✅ Create Operations: 2/2 passing
✅ Read Operations: 3/3 passing  
✅ Update Operations: 2/2 passing
✅ Delete Operations: 1/1 passing
✅ End-to-End Flow: 1/1 passing
```

## 🚀 主要機能

### 1. チャンネル作成時の自動キャラクター生成

```typescript
// オーケストレーターの実行フロー
async execute(channel: TextChannel): Promise<void> {
  // 1. チャンネル検出
  const detectionResult = await this.channelDetectionService.detectCharacterChannel(channel)
  
  // 2. キャラクター作成イベント発火
  await this.typedEventService.emit('character.creation.requested', payload)
  
  // 3. 後続処理はイベントハンドラーで実行
}
```
### 3. MongoDB Atlas 統合

新しい **AttributeValue** システムを使用:

```typescript
status: {
  HP: {
    name: 'HP',
    index: 1,
    values: { base: 50, damage: -10, heal: 5, other: 0 },
    description: 'ヒットポイント',
    isVisible: true
  }
}
```

## ⚙️ 技術仕様

### 依存関係
- **NestJS**: フレームワーク
- **Mongoose**: MongoDB ODM
- **EventEmitter2**: イベント管理  
- **Discord.js**: Discord API
- **uuid**: ID生成
- **class-validator**: DTO検証

### パフォーマンス
- **MongoDB Atlas**: クラウドデータベース
- **非同期処理**: イベント駆動による並行処理
- **型安全性**: TypeScript 厳密モード
- **テストカバレッジ**: 100% 主要機能

### セキュリティ
- **入力検証**: class-validator による DTO 検証
- **エラーハンドリング**: 包括的なエラーキャッチング
- **ログ**: 構造化ログによる監査証跡
- **認証**: Discord OAuth2 統合

## 🚧 移行ガイド

### 既存コードからの移行

1. **段階的移行**: 既存のコードはそのまま動作します
2. **新機能**: 新しい機能は`ChannelCreateOrchestratorService`を使用
3. **テスト**: 各段階でテストを実行して動作確認

### 推奨移行パス

1. `CharacterEditModule`をインポート
2. 既存のサービス個別インポートを削除
3. 新しいオーケストレーターサービスに移行
4. カスタムロジックが必要な場合は個別サービスを使用

## 🔮 今後の拡張

1. **リアルタイム同期**: WebSocket による即時更新
2. **権限管理**: ロールベースアクセス制御
3. **履歴機能**: キャラクター変更履歴の追跡
4. **ゲームシステム**: 新しいTRPGシステム対応

## 🐛 トラブルシューティング

### よくある問題

1. **依存性注入エラー**: `CharacterEditModule`が正しくインポートされているか確認
2. **型エラー**: 最新の型定義を使用しているか確認
3. **テスト失敗**: モックが正しく設定されているか確認

### ログレベル

- `LOG`: 正常な処理フロー
- `WARN`: 警告（作成者ID取得失敗など）
- `ERROR`: エラー（キャラクター作成失敗など）

## 🤝 コントリビューション

1. 新しい機能は適切なサービスに分離
2. テストカバレッジを維持
3. 型安全性を確保
4. ドキュメントを更新