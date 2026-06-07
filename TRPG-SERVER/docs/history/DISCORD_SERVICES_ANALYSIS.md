# Discord Services ディレクトリ分析・統合提案

## ⚠️ 状態注記（2026-06-03 更新）

提案の Phase2(dice)/3(monitoring)/4(channel) は実装済み。

**Phase1「`discord-facade.service` 廃止／`TypedEventService` で完全代替」は撤回（事実誤認）。** 下記 §「即座に廃止可能なファイル > 1. discord-facade.service.ts」の `emitEvent(...)` 代替例は実コードに存在しない（facade にイベント発行メソッドは無い）。facade の実責務は `initializeDiscord()` 起動オーケストレーション＋REST `DiscordController` の裏付け（verify/send/create/info）＋ヘルス集約で、`TypedEventService` では置換不能。**`DiscordFacadeService` は存続で確定**（正本は `src/discord/DESIGN.md` §4.5）。実際の廃止対象は `DiscordService`（@deprecated ラッパー）で、移行手順は DESIGN.md Phase 4 を参照。本ファイルの当該記述は歴史的経緯として残置するが**鵜呑みにしないこと**。

## 📊 概要

`discord/services`ディレクトリ内の18ファイルを分析し、重複処理の特定、features統合可能性の調査、廃止対象の洗い出しを実施しました。

**分析結果**:

- 🚨 **即座に廃止可能**: 2ファイル
- 🔄 **統合対象**: 9ファイル → 3ファイルに統合
- ✅ **維持対象**: 7ファイル

## 🚨 即座に廃止可能なファイル

> 🛑 **履歴・撤回済み（2026-06-06／現役 TODO ではない）**: この節の「即座に廃止可能」判定は撤回済み。
> `discord-facade.service.ts` は**存続で確定**（上部の状態注記参照・正本は `src/discord/DESIGN.md` §4.5）。
> `discord-embed-handler.service.ts` の扱いも本書ではなく現行設計書を正とすること。以下は当時の提案の記録。

### 1. `discord-facade.service.ts`

**廃止理由**: PHASE3で段階的廃止予定、TypedEventServiceで完全代替可能

```typescript
// 現在の呼び出し方法
await this.discordFacadeService.emitEvent('character.created', event)

// 置換後
await this.typedEventService.emit('character.creation.completed', event)
```

### 2. `discord-embed-handler.service.ts`

**廃止理由**: File-based Event Handlersで代替済み、中間レイヤーとして不要

```typescript
// 削除対象のコメント通り
// "CharacterUIServiceを呼び出すため、この中間レイヤーは不要"
```

## 🔄 統合対象ファイル群

### グループ1: ダイス処理統合 (優先度: 高)

**統合対象**:

- `dice-calculation-handler.service.ts` (統一ダイス計算)
- `flexible-dice-calculator.service.ts` (柔軟ダイス計算)
- `preset-dice-handler.service.ts` (プリセットダイス)

**重複内容**:

- キャラクター値代入処理
- 数式解析ロジック
- エラーハンドリング

**統合後フォルダ構造**: `dice/`

```
discord/services/dice/
├── dice-calculation.service.ts    # 計算ロジック
├── dice-parser.service.ts         # 数式解析
├── dice-preset.service.ts         # プリセット処理
├── dice-orchestrator.service.ts   # 統合管理
└── index.ts                       # エクスポート管理
```

```typescript
// dice-orchestrator.service.ts
@Injectable()
export class DiceOrchestratorService {
  constructor(
    private readonly calculationService: DiceCalculationService,
    private readonly parserService: DiceParserService,
    private readonly presetService: DicePresetService
  ) {}

  async executeRoll(request: DiceRollRequest): Promise<DiceRollResult>
  async handlePresetInteraction(interaction: ButtonInteraction): Promise<void>
}
```

### グループ2: パフォーマンス監視統合 (優先度: 中)

**統合対象**:

- `discord-performance-monitor.service.ts` (Discord API監視)
- `performance-metrics-integration.service.ts` (システム全体メトリクス)
- `alert-system.service.ts` (アラート管理)

**重複内容**:

- メトリクス収集ロジック
- アラート機能
- パフォーマンス監視

**統合後フォルダ構造**: `monitoring/`

```
discord/services/monitoring/
├── metrics-collector.service.ts   # メトリクス収集
├── alert-manager.service.ts       # アラート管理
├── discord-monitor.service.ts     # Discord API監視
├── performance-orchestrator.service.ts # 統合管理
└── index.ts                       # エクスポート管理
```

```typescript
// performance-orchestrator.service.ts
@Injectable()
export class PerformanceOrchestratorService {
  constructor(
    private readonly metricsCollector: MetricsCollectorService,
    private readonly alertManager: AlertManagerService,
    private readonly discordMonitor: DiscordMonitorService
  ) {}

  async collectSystemMetrics(): Promise<SystemMetrics>
  async processAlert(alert: AlertEvent): Promise<void>
}
```

### グループ3: チャンネル管理統合 (優先度: 中)

**統合対象**:

- `discord-channel-manager.service.ts` (オーケストレーター - 廃止)
- `channel-creator.service.ts` (維持)
- `channel-cache.service.ts` (維持)
- `message-manager.service.ts` (維持)

**統合方針**: 不要な中間レイヤー`discord-channel-manager.service.ts`を廃止し、フォルダ構造で整理

**統合後フォルダ構造**: `channel/`

```
discord/services/channel/
├── channel-creator.service.ts     # チャンネル作成・権限管理
├── channel-cache.service.ts       # キャッシュ管理
├── message-manager.service.ts     # メッセージ管理
└── index.ts                       # エクスポート管理
```

**注**: オーケストレーションは呼び出し元（applicationレイヤー）で実装

## 🎯 featuresディレクトリとの重複分析

### characterEdit機能との重複

| services                                      | features/characterEdit                   | 重複内容                 | 対応方針                               |
| --------------------------------------------- | ---------------------------------------- | ------------------------ | -------------------------------------- |
| `channel-creator.service.ts`                  | `channel-create-orchestrator.service.ts` | チャンネル作成・権限管理 | 基盤機能はservices、特定機能はfeatures |
| `discord-embed-handler.service.ts` (廃止済み) | `character-embed-manager.service.ts`     | Embed更新処理            | featuresに統合済み                     |

### characterThread機能との重複

| services                     | features/characterThread       | 重複内容                  | 対応方針                             |
| ---------------------------- | ------------------------------ | ------------------------- | ------------------------------------ |
| `message-manager.service.ts` | `character-display.service.ts` | メッセージ送信・Embed作成 | 基盤機能はservices、UI処理はfeatures |

### ダイス機能との重複

| services                | features/diceRoll    | 重複内容                     | 対応方針                                       |
| ----------------------- | -------------------- | ---------------------------- | ---------------------------------------------- |
| 3つのダイス関連サービス | `diceRoll/services/` | ダイス計算ロジック・結果処理 | 共通ロジックはservicesに統合、UI処理はfeatures |

## 📈 期待される改善効果

### パフォーマンス向上

- **メモリ使用量**: 30-40%削減 (冗長サービス廃止)
- **レスポンス時間**: 15-25%改善 (中間レイヤー除去)
- **コード重複**: 70%削減 (ダイス処理統合)

### 保守性向上

- **依存関係**: 簡素化 (中間レイヤー除去)
- **テストしやすさ**: 向上 (責務の明確化)
- **デバッグ効率**: 向上 (呼び出しチェーン短縮)

## 🛠️ 移行計画

> 🛑 **履歴・現役 TODO ではない（2026-06-06）**: 以下の Phase 1〜4 は 2026 年前半の提案であり、
> **そのままの作業指示として使わないこと**。Phase 2(dice)/3(monitoring)/4(channel) は実装済み、
> **Phase 1（facade 廃止）は撤回**（facade は存続）。現状の移行方針は `src/discord/DESIGN.md` /
> `src/discord/interactions/MIGRATION_GUIDE.md` / `AI.refactor.md` を正とする。

### Phase 1: 廃止対象削除 (影響範囲: 小)

1. `discord-facade.service.ts` → TypedEventServiceに置換
2. `discord-embed-handler.service.ts` → 削除 (既に無効化済み)

**所要時間**: 1-2日
**リスク**: 低

### Phase 2: ダイス処理統合 (影響範囲: 中)

1. `services/dice/`フォルダ構造作成
2. 既存3サービスの機能別分割・統合
3. `DiceOrchestratorService`でファサード実装
4. 呼び出し元の更新

**所要時間**: 4-6日
**リスク**: 中 (ダイス機能の回帰テスト必要)

### Phase 3: パフォーマンス監視統合 (影響範囲: 大)

1. `services/monitoring/`フォルダ構造作成
2. 既存3サービスの機能別分割・統合
3. `PerformanceOrchestratorService`でファサード実装
4. 監視・アラート機能の検証

**所要時間**: 6-8日
**リスク**: 高 (監視システムの継続性が重要)

### Phase 4: チャンネル管理整理 (影響範囲: 中)

1. `services/channel/`フォルダ構造作成
2. `discord-channel-manager.service.ts`廃止
3. 既存3サービスをフォルダに移動
4. 呼び出し元をindex.tsから直接インポートに変更

**所要時間**: 2-3日
**リスク**: 低 (移動のみ、機能変更なし)

## ⚠️ 注意点とリスク管理

### 移行時の注意事項

1. **段階的移行**: 一度に全て変更せず、Phaseごとに実施
2. **十分なテスト**: 統合後の機能テスト、パフォーマンステスト実施
3. **ロールバック準備**: 各Phase完了後にロールバックポイント作成
4. **ドキュメント更新**: API仕様書、アーキテクチャ図の更新

### テスト要求

- [ ] 統合後の機能テスト
- [ ] パフォーマンステスト
- [ ] 既存feature機能の回帰テスト
- [ ] Discord API呼び出しの正常性確認
- [ ] エラーハンドリングの検証

## 📋 実装チェックリスト

> 🛑 **履歴・現役 TODO ではない（2026-06-06）**: 以下のチェックボックスは当時の提案の作業項目であり、
> **未完了タスクの一覧ではない**。`discord-facade.service.ts` 削除系の項目は撤回済み。実施状況は本書ではなく
> `AI.refactor.md` と各設計書を参照すること。

### Phase 1: 廃止対象削除

- [ ] `discord-facade.service.ts`の呼び出し箇所特定
- [ ] TypedEventServiceへの置換実装
- [ ] `discord-embed-handler.service.ts`の参照確認・削除
- [ ] 削除後の動作確認

### Phase 2: ダイス処理統合

- [ ] `services/dice/`フォルダ構造作成
- [ ] `dice-calculation.service.ts`の設計・実装
- [ ] `dice-parser.service.ts`の設計・実装
- [ ] `dice-preset.service.ts`の設計・実装
- [ ] `dice-orchestrator.service.ts`のファサード実装
- [ ] `index.ts`でのエクスポート管理設定
- [ ] 既存ダイス関連サービスからのマイグレーション
- [ ] diceRoll/userDefinedDice featuresとの連携確認
- [ ] ダイス機能の統合テスト

### Phase 3: パフォーマンス監視統合

- [ ] `services/monitoring/`フォルダ構造作成
- [ ] `metrics-collector.service.ts`の設計・実装
- [ ] `alert-manager.service.ts`の設計・実装
- [ ] `discord-monitor.service.ts`の設計・実装
- [ ] `performance-orchestrator.service.ts`のファサード実装
- [ ] `index.ts`でのエクスポート管理設定
- [ ] 既存監視機能のマイグレーション
- [ ] アラート機能の継続性確認
- [ ] 監視データの整合性検証

### Phase 4: チャンネル管理整理

- [ ] `services/channel/`フォルダ構造作成
- [ ] `channel-creator.service.ts`のフォルダ移動
- [ ] `channel-cache.service.ts`のフォルダ移動
- [ ] `message-manager.service.ts`のフォルダ移動
- [ ] `index.ts`でのエクスポート管理設定
- [ ] `discord-channel-manager.service.ts`の使用箇所特定・削除
- [ ] インポート文の更新（フォルダ構造対応）
- [ ] チャンネル関連機能の動作確認

## 🎯 成功指標

- **ファイル数削減**: 18個 → 13個 (28%削減)
- **テストカバレッジ**: 90%以上維持
- **パフォーマンス**: ベースライン比較で改善確認
- **メンテナンス工数**: 開発者フィードバックによる改善確認

## 📁 最終的なフォルダ構造

```
discord/services/
├── dice/                           # ダイス処理統合
│   ├── dice-calculation.service.ts
│   ├── dice-parser.service.ts
│   ├── dice-preset.service.ts
│   ├── dice-orchestrator.service.ts
│   └── index.ts
├── monitoring/                     # パフォーマンス監視統合
│   ├── metrics-collector.service.ts
│   ├── alert-manager.service.ts
│   ├── discord-monitor.service.ts
│   ├── performance-orchestrator.service.ts
│   └── index.ts
├── channel/                        # チャンネル管理整理
│   ├── channel-creator.service.ts
│   ├── channel-cache.service.ts
│   ├── message-manager.service.ts
│   └── index.ts
├── discord-client.service.ts       # 基盤サービス（維持）
├── discord-guild-manager.service.ts
├── discord-interaction-handler.service.ts
├── command-manager.service.ts
├── discord-command-registration.service.ts
├── dice-notation-handler.service.ts
└── index.ts                        # 全体エクスポート管理
```

**改善効果**:

- **18ファイル → 13ファイル + 3フォルダ構造** (28%削減)
- **巨大ファイル問題の解決**: 責務分離による適切なファイルサイズ
- **保守性向上**: 関連機能のグループ化による理解しやすさ
- **import管理**: index.tsによる統一インターフェース

この分析により、Discord servicesディレクトリの大幅な整理と最適化が可能になります。フォルダ構造による管理により、巨大ファイル化を避けながら、段階的な実装でリスクを最小化し、保守性とパフォーマンスの向上を実現できます。
