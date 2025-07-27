# Discord Features構成案

## 🎯 目標
bulletproof-reactのfeatures構成を参考に、Discord Bot機能を機能別に整理し、保守性・拡張性を向上させる。

## 📊 現在の状況分析

### 現在のdiscordディレクトリ構成
```
src/discord/
├── commands/                    # スラッシュコマンド
├── events/                      # Discordイベント処理
├── application/                 # アプリケーション層
├── services/                    # 共通サービス
├── components/                  # UIコンポーネント
├── models/                      # データモデル
├── dto/                        # データ転送オブジェクト
├── utils/                      # ユーティリティ
├── interfaces/                  # 型定義
├── static/                     # 静的ファイル
├── discord.module.ts           # メインモジュール
├── discord.service.ts          # メインサービス
├── discord.controller.ts       # メインコントローラー
└── discord.type.ts            # メイン型定義
```

### 問題点
1. **機能別の分離が不明確**: 関連する機能が複数のディレクトリに分散
2. **責務の重複**: 類似機能が複数箇所に存在
3. **拡張性の制限**: 新機能追加時の構造が不明確
4. **bulletproof-reactとの一貫性不足**: フロントエンドとの設計思想の違い

## 🏗️ 新しいfeatures構成案

```
src/discord/
├── features/
│   ├── commands/                    # スラッシュコマンド機能
│   │   ├── api/
│   │   │   ├── commands.service.ts
│   │   │   ├── commands.controller.ts
│   │   │   └── commands.module.ts
│   │   ├── components/
│   │   │   ├── character-thread/
│   │   │   │   ├── character-thread.service.ts
│   │   │   │   └── character-thread.service.spec.ts
│   │   │   ├── dice-roll/
│   │   │   │   ├── dice-roll.service.ts
│   │   │   │   └── dice-roll.service.spec.ts
│   │   │   ├── dice-result/
│   │   │   │   ├── dice-result.service.ts
│   │   │   │   └── dice-result.service.spec.ts
│   │   │   ├── user-defined-dice/
│   │   │   │   ├── user-defined-dice.service.ts
│   │   │   │   └── user-defined-dice.service.spec.ts
│   │   │   ├── select-game-system/
│   │   │   │   ├── select-game-system.service.ts
│   │   │   │   └── select-game-system.service.spec.ts
│   │   │   └── dice-from-context-menu/
│   │   │       ├── dice-from-context-menu.service.ts
│   │   │       └── dice-from-context-menu.service.spec.ts
│   │   ├── types/
│   │   │   ├── command.types.ts
│   │   │   └── interaction.types.ts
│   │   ├── utils/
│   │   │   ├── command.utils.ts
│   │   │   └── validation.utils.ts
│   │   └── index.ts
│   │
│   ├── interactions/                 # Discordインタラクション機能
│   │   ├── api/
│   │   │   ├── interactions.service.ts
│   │   │   ├── interactions.controller.ts
│   │   │   └── interactions.module.ts
│   │   ├── components/
│   │   │   ├── buttons/
│   │   │   │   ├── character-dice/
│   │   │   │   │   ├── character-dice-buttons.service.ts
│   │   │   │   │   └── character-dice-buttons.service.spec.ts
│   │   │   │   ├── character-tab/
│   │   │   │   │   ├── character-tab-buttons.service.ts
│   │   │   │   │   └── character-tab-buttons.service.spec.ts
│   │   │   │   ├── dice-page/
│   │   │   │   │   ├── dice-page-buttons.service.ts
│   │   │   │   │   └── dice-page-buttons.service.spec.ts
│   │   │   │   └── character-info/
│   │   │   │       ├── chara-info-button.service.ts
│   │   │   │       └── chara-info-button.service.spec.ts
│   │   │   ├── modals/
│   │   │   │   ├── character-info/
│   │   │   │   │   ├── add-chara-info.service.ts
│   │   │   │   │   └── add-chara-info.service.spec.ts
│   │   │   │   └── custom-dice/
│   │   │   │       ├── custom-dice-modal.service.ts
│   │   │   │       └── custom-dice-modal.service.spec.ts
│   │   │   ├── selects/
│   │   │   │   ├── character-channel/
│   │   │   │   │   ├── character-channel.service.ts
│   │   │   │   │   └── character-channel.service.spec.ts
│   │   │   │   ├── dice-character/
│   │   │   │   │   ├── dice-character-select.service.ts
│   │   │   │   │   └── dice-character-select.service.spec.ts
│   │   │   │   └── character-info/
│   │   │   │       ├── change-chara-info.service.ts
│   │   │   │       └── change-chara-info.service.spec.ts
│   │   │   └── select-menus/
│   │   │       └── dice-page/
│   │   │           ├── dice-page-select-menu.service.ts
│   │   │           └── dice-page-select-menu.service.spec.ts
│   │   ├── types/
│   │   │   ├── interaction.types.ts
│   │   │   └── button.types.ts
│   │   ├── utils/
│   │   │   ├── interaction.utils.ts
│   │   │   └── validation.utils.ts
│   │   └── index.ts
│   │
│   ├── channels/                    # チャンネル管理機能
│   │   ├── api/
│   │   │   ├── channels.service.ts
│   │   │   ├── channels.controller.ts
│   │   │   └── channels.module.ts
│   │   ├── components/
│   │   │   ├── character-channel/
│   │   │   │   ├── character-channel-create.service.ts
│   │   │   │   └── character-channel-create.service.spec.ts
│   │   │   └── dice-roll-channel/
│   │   │       ├── diceroll-channel-create.service.ts
│   │   │       └── diceroll-channel-create.service.spec.ts
│   │   ├── types/
│   │   │   └── channel.types.ts
│   │   ├── utils/
│   │   │   └── channel.utils.ts
│   │   └── index.ts
│   │
│   ├── pagination/                  # ページネーション機能
│   │   ├── api/
│   │   │   ├── pagination.service.ts
│   │   │   └── pagination.module.ts
│   │   ├── components/
│   │   │   └── dice-roll/
│   │   │       ├── dice-roll-pagination.service.ts
│   │   │       └── dice-roll-pagination.service.spec.ts
│   │   ├── types/
│   │   │   └── pagination.types.ts
│   │   ├── utils/
│   │   │   └── pagination.utils.ts
│   │   └── index.ts
│   │
│   └── integration/                 # Discord統合機能
│       ├── api/
│       │   ├── discord-integration.service.ts
│       │   ├── discord-integration.service.spec.ts
│       │   └── integration.module.ts
│       ├── components/
│       │   └── prototype/
│       │       ├── discord-character-name/
│       │       │   ├── discord-character-name.prototype.ts
│       │       │   └── discord-character-name.prototype.spec.ts
│       │       └── discord-prototype.module.ts
│       ├── types/
│       │   └── integration.types.ts
│       ├── utils/
│       │   └── integration.utils.ts
│       └── index.ts
│
├── shared/                          # 共有機能
│   ├── services/                    # 共通サービス
│   │   ├── discord-client.service.ts
│   │   ├── command-manager.service.ts
│   │   ├── discord-command-registration.service.ts
│   │   ├── discord-ui.service.ts
│   │   └── discord-facade.service.ts
│   ├── models/                      # データモデル
│   │   ├── game-system.model.ts
│   │   └── user-defined-dice.model.ts
│   ├── dto/                        # データ転送オブジェクト
│   │   ├── create-channel.dto.ts
│   │   ├── post-character.dto.ts
│   │   └── send-message.dto.ts
│   ├── interfaces/                  # 型定義
│   │   ├── discord-client.interface.ts
│   │   ├── discord-interaction.interface.ts
│   │   └── discord-interaction-types.interface.ts
│   ├── utils/                      # ユーティリティ
│   │   ├── convertToJSON.ts
│   │   ├── convertToJSON.spec.ts
│   │   ├── dice.util.ts
│   │   ├── discord.util.ts
│   │   ├── discord.utils.ts
│   │   ├── file.util.ts
│   │   ├── table-dice.util.ts
│   │   ├── tableDice.ts
│   │   ├── dice.ts
│   │   ├── createCategory.ts
│   │   ├── getCategory.ts
│   │   ├── loadJsonFile.ts
│   │   ├── searchChannelID.ts
│   │   └── dice-roll.interface.ts
│   ├── static/                     # 静的ファイル
│   │   └── gameSystemList.json
│   └── index.ts
│
├── discord.module.ts                # メインモジュール
├── discord.service.ts               # メインサービス
├── discord.controller.ts            # メインコントローラー
└── discord.type.ts                 # メイン型定義
```

##  構成の特徴

### 1. **機能別分離**
- **commands**: スラッシュコマンド関連の機能を集約
- **interactions**: Discordインタラクション（ボタン、モーダル、セレクト）を集約
- **channels**: チャンネル管理機能を集約
- **pagination**: ページネーション機能を集約
- **integration**: Discord統合機能を集約

### 2. **bulletproof-reactパターンの適用**
各feature内で以下の構造を統一：
- **api/**: API層（サービス、コントローラー、モジュール）
- **components/**: 機能別コンポーネント
- **types/**: 型定義
- **utils/**: ユーティリティ関数
- **index.ts**: エクスポート管理

### 3. **sharedディレクトリ**
- 複数のfeatureで共有される機能を集約
- 共通サービス、モデル、DTO、インターフェース、ユーティリティ

##  移行戦略

### Phase 1: 構造整理
1. **sharedディレクトリの作成**
   - 共通サービス、モデル、DTO、インターフェース、ユーティリティを移動
2. **featuresディレクトリの作成**
   - 各機能別ディレクトリの作成

### Phase 2: 機能別移行
1. **commands feature**
   - 既存のcommands/ディレクトリを移行
   - コンポーネント別のサブディレクトリ作成
2. **interactions feature**
   - 既存のevents/ディレクトリを移行
   - インタラクション種別別のサブディレクトリ作成
3. **channels feature**
   - チャンネル関連機能を集約
4. **pagination feature**
   - ページネーション機能を集約
5. **integration feature**
   - 統合機能を集約

### Phase 3: モジュール統合
1. **各featureのindex.ts作成**
   - エクスポート管理の統一
2. **メインモジュールの更新**
   - 新しい構造に対応したモジュール設定

##  期待される効果

### 1. **保守性の向上**
- 機能別の明確な分離
- 関連ファイルの集約
- 変更影響範囲の限定

### 2. **拡張性の向上**
- 新機能追加時の構造が明確
- 既存機能への影響を最小化
- 再利用可能なコンポーネント設計

### 3. **開発効率の向上**
- ファイル検索の効率化
- 機能別の開発チーム分離が可能
- テストの構造化

### 4. **bulletproof-reactとの一貫性**
- フロントエンドとの設計思想統一
- 開発者間の学習コスト削減
- プロジェクト全体の一貫性確保

##  実装優先順位

### 高優先度
1. **sharedディレクトリの作成**
2. **commands featureの移行**
3. **interactions featureの移行**

### 中優先度
1. **channels featureの移行**
2. **pagination featureの移行**
3. **integration featureの移行**

### 低優先度
1. **型定義の最適化**
2. **ユーティリティ関数の整理**
3. **テスト構造の調整**

##  技術的考慮事項

### 1. **モジュール依存関係**
```typescript
// 各featureの独立性を保ちながら、必要な依存関係を管理
@Module({
  imports: [
    SharedModule,
    CommandsModule,
    InteractionsModule,
    ChannelsModule,
    PaginationModule,
    IntegrationModule
  ],
  exports: [DiscordService]
})
export class DiscordModule {}
```

### 2. **型安全性の確保**
```typescript
// 各featureで独自の型定義を持つ
// features/commands/types/command.types.ts
export interface CommandContext {
  interaction: ChatInputCommandInteraction;
  guild: Guild;
  channel: TextChannel;
}

// features/interactions/types/interaction.types.ts
export interface InteractionContext {
  interaction: ButtonInteraction | ModalSubmitInteraction | StringSelectMenuInteraction;
  guild: Guild;
  channel: TextChannel;
}
```

### 3. **エラーハンドリングの統一**
```typescript
// shared/utils/error-handler.ts
export class DiscordErrorHandler {
  static handleCommandError(error: unknown, context: string): void {
    // 統一されたエラーハンドリング
  }
  
  static handleInteractionError(error: unknown, context: string): void {
    // 統一されたインタラクションエラーハンドリング
  }
}
```

##  移行完了基準

### ✅ 完了条件
- [ ] 全featureの構造化完了
- [ ] 既存機能の動作確認
- [ ] テストケースの更新
- [ ] モジュール依存関係の最適化
- [ ] 型安全性の確保
- [ ] エラーハンドリングの統一

### 📊 進行状況追跡
```typescript
const migrationProgress = {
  'Phase 1': '0% - 構造整理開始前',
  'Phase 2': '0% - 機能別移行開始前',
  'Phase 3': '0% - モジュール統合開始前',
  'Overall': '0% - 移行開始前'
}
```

この構成により、Discord Bot機能の保守性・拡張性が大幅に向上し、bulletproof-reactとの一貫性も確保できます。
```

AI.features.mdファイルを作成しました。このファイルには、bulletproof-reactのfeatures構成を参考にしたDiscord Bot機能の新しい構成案が詳細に記載されています。

## 主な特徴

1. **機能別分離**: commands、interactions、channels、pagination、integrationの5つの主要機能に分離
2. **bulletproof-reactパターン適用**: 各feature内でapi/、components/、types/、utils/の統一構造
3. **sharedディレクトリ**: 共通機能の集約
4. **段階的移行戦略**: Phase 1-3に分けた実装計画
5. **期待される効果**: 保守性・拡張性・開発効率の向上

この構成案により、現在のdiscordディレクトリの複雑な構造を整理し、bulletproof-reactとの一貫性を保ちながら、より保守性の高いアーキテクチャを実現できます。 