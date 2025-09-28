# Monitoring Services Documentation

## 📋 概要

TRPGサーバーのパフォーマンス監視とアラート管理を行うサービス群のドキュメント。

---

## 🗂️ ファイル構成と役割

### index.ts
**役割**: 監視サービス群のエクスポート管理
- 各監視サービスのエクスポート統合
- 外部モジュールからのアクセスポイント
- PerformanceOrchestratorServiceを推奨インターフェースとして提供

**提供内容**:
```typescript
export { MetricsCollectorService } from './metrics-collector.service'
export { AlertManagerService } from './alert-manager.service'
export { DiscordMonitorService } from './discord-monitor.service'
export { PerformanceOrchestratorService } from './performance-orchestrator.service'
export { PerformanceOrchestratorService as MonitoringService } from './performance-orchestrator.service' // 推奨エイリアス
```

### performance-orchestrator.service.ts
**役割**: パフォーマンス監視の統合オーケストレーター
**責務**: 監視サービス群の統合管理とヘルスチェック

**主要機能**:
- **システム監視統合**: 各監視サービスの協調動作
- **ヘルスチェック**: システム全体の健康状態監視
- **パフォーマンス測定**: レスポンス時間・エラー率の追跡
- **アラート統合**: 閾値監視とアラート発行の統合管理
- **定期監視**: スケジュール実行による継続監視
- **イベント発行**: 監視結果のイベント駆動通知

**アーキテクチャパターン**: Orchestrator Pattern + Observer Pattern
- 複数監視サービスの協調実行
- イベント駆動による状態変化通知

**主要メソッド**:
```typescript
// Discord API監視開始
startDiscordApiMonitoring(operation: string, method: string): DiscordApiMetrics

// システムヘルス取得
getSystemHealth(): SystemHealthStatus

// パフォーマンスサマリー取得
getPerformanceSummary(): PerformanceSummary

// 定期監視（5分間隔）
@Interval(300000)
performPeriodicHealthCheck(): Promise<void>
```

### metrics-collector.service.ts
**役割**: メトリクス収集エンジン
**責務**: システムメトリクスの収集と保存

**主要機能**:
- **API監視**: Discord API呼び出しの監視
- **レスポンス時間測定**: 各操作の実行時間追跡
- **エラー率計算**: 成功/失敗率の統計計算
- **リソース監視**: CPU・メモリ使用量の追跡
- **統計データ生成**: 平均値・最大値・最小値の計算
- **データ保存**: メトリクス履歴の管理

**設計パターン**: Repository Pattern + Strategy Pattern
- メトリクスデータの抽象化された保存
- 監視対象別の収集戦略

**メトリクス種別**:
- **Discord API**: 呼び出し回数、レスポンス時間、エラー率
- **System**: CPU使用率、メモリ使用量、アップタイム
- **Application**: 処理時間、同時実行数、キューサイズ

### alert-manager.service.ts
**役割**: アラート管理エンジン
**責務**: 閾値監視とアラート発行

**主要機能**:
- **閾値監視**: 設定値を超えた場合のアラート発行
- **アラートレベル管理**: INFO, WARN, ERROR, CRITICALの分類
- **重複抑制**: 同一アラートの連続発行防止
- **アラート履歴**: 発行履歴の管理と分析
- **通知統合**: Discord通知、ログ出力の統合
- **自動復旧検知**: 問題解決時の自動通知

**アラート条件**:
- **レスポンス時間**: >1000ms で WARN、>3000ms で ERROR
- **エラー率**: >5% で WARN、>10% で CRITICAL
- **メモリ使用量**: >80% で WARN、>90% で CRITICAL
- **API制限**: Discord API制限に近づいた場合

**設計パターン**: Observer Pattern + State Pattern
- メトリクス変化の監視
- アラート状態の管理

### discord-monitor.service.ts
**役割**: Discord特化監視エンジン
**責務**: Discord.js固有の監視と最適化

**主要機能**:
- **接続状態監視**: WebSocket接続の安定性監視
- **API制限監視**: レート制限の追跡と予測
- **ギルド状態監視**: ギルド接続状態の監視
- **イベント監視**: Discord.jsイベントの統計
- **パフォーマンス最適化**: 接続プール・キャッシュの最適化
- **障害検知**: 接続断・API障害の自動検知

**Discord.js統合機能**:
- Client状態の継続監視
- WebSocketハートビート監視
- シャード状態管理（将来対応）
- キャッシュサイズ最適化

**監視対象**:
- **接続**: WebSocket状態、再接続頻度
- **API**: 呼び出し頻度、制限残数、エラー詳細
- **キャッシュ**: ギルド・チャンネル・ユーザーキャッシュサイズ
- **イベント**: 受信イベント数、処理時間

---

## 🏗️ アーキテクチャ設計

### サービス間依存関係
```
PerformanceOrchestratorService (統合層)
├── MetricsCollectorService (収集層)
├── AlertManagerService (通知層)
└── DiscordMonitorService (Discord専門層)
```

### 外部依存関係
```
External Dependencies
├── @nestjs/schedule - 定期実行
├── @nestjs/event-emitter - イベント通知
├── Discord.js Client - Discord監視
└── Node.js Process - システムリソース監視
```

### データフロー
```
1. MetricsCollectorService → データ収集
2. AlertManagerService → 閾値チェック
3. DiscordMonitorService → Discord特化監視
4. PerformanceOrchestratorService → 統合判定・通知
```

---

## 🚀 使用方法

### 基本的な使用パターン
```typescript
// 依存注入
constructor(
  private readonly performanceOrchestrator: PerformanceOrchestratorService
) {}

// Discord API監視開始
const metrics = this.performanceOrchestrator.startDiscordApiMonitoring('sendMessage', 'POST')
try {
  await discordApiCall()
  metrics.end(true) // 成功
} catch (error) {
  metrics.end(false) // 失敗
}

// システムヘルス確認
const health = this.performanceOrchestrator.getSystemHealth()
if (health.status === 'critical') {
  this.logger.error('システムが危険な状態です', health.issues)
}
```

### パフォーマンス監視パターン
```typescript
// 処理時間監視
const startTime = Date.now()
const metrics = this.performanceOrchestrator.startDiscordApiMonitoring('complexOperation', 'PROCESS')

try {
  await complexOperation()
  metrics.end(true)
} catch (error) {
  metrics.end(false)
  throw error
}

// パフォーマンスサマリー取得
const summary = this.performanceOrchestrator.getPerformanceSummary()
this.logger.log(`平均レスポンス時間: ${summary.discord.avgResponseTime}ms`)
```

### カスタムアラート設定
```typescript
// AlertManagerServiceを直接使用する場合
constructor(
  private readonly alertManager: AlertManagerService
) {}

// カスタム閾値でアラート発行
if (customMetric > threshold) {
  await this.alertManager.triggerAlert('CUSTOM_METRIC_HIGH', {
    level: 'WARN',
    message: `カスタムメトリクスが閾値を超過: ${customMetric}`,
    metadata: { threshold, actual: customMetric }
  })
}
```

---

## 📊 監視項目と閾値

### システムメトリクス
| 項目 | 正常 | 警告 | 危険 | 単位 |
|------|------|------|------|------|
| CPU使用率 | <70% | 70-85% | >85% | % |
| メモリ使用量 | <70% | 70-85% | >85% | % |
| レスポンス時間 | <500ms | 500-1000ms | >1000ms | ms |
| エラー率 | <1% | 1-5% | >5% | % |

### Discord特化メトリクス
| 項目 | 正常 | 警告 | 危険 | 単位 |
|------|------|------|------|------|
| WebSocket接続 | 安定 | 再接続<3回/分 | 再接続>3回/分 | 回数 |
| API制限残数 | >50% | 20-50% | <20% | % |
| ハートビート | <100ms | 100-300ms | >300ms | ms |
| イベント処理 | <50ms | 50-200ms | >200ms | ms |

### アラートレベル定義
- **INFO**: 情報通知、ログのみ
- **WARN**: 注意が必要、運用継続可能
- **ERROR**: 問題発生、対処が必要
- **CRITICAL**: 緊急事態、即座の対応が必要

---

## 🔧 設定とカスタマイズ

### 監視間隔設定
```typescript
// 定期監視間隔（PerformanceOrchestratorService）
@Interval(300000) // 5分間隔
performPeriodicHealthCheck()

@Interval(60000) // 1分間隔  
performQuickHealthCheck()

@Interval(900000) // 15分間隔
performDetailedAnalysis()
```

### 閾値カスタマイズ
```typescript
// AlertManagerServiceの閾値設定
const thresholds = {
  responseTime: { warn: 1000, error: 3000 },
  errorRate: { warn: 0.05, critical: 0.10 },
  memoryUsage: { warn: 0.80, critical: 0.90 }
}
```

### ログレベル制御
```typescript
// 環境変数による制御
MONITOR_LOG_LEVEL=debug  // debug, info, warn, error
MONITOR_ALERT_LEVEL=warn // info, warn, error, critical
MONITOR_DISCORD_VERBOSE=true // Discord詳細ログ
```

---

## 🚨 トラブルシューティング

### よくある問題
1. **高いレスポンス時間**
   - 原因: Discord API制限、ネットワーク遅延
   - 対処: 制限チェック、再試行ロジック確認

2. **メモリ使用量増加**
   - 原因: キャッシュサイズ、メモリリーク
   - 対処: キャッシュクリア、GC強制実行

3. **アラート多発**
   - 原因: 閾値設定、重複抑制の問題
   - 対処: 閾値調整、抑制時間延長

### 診断コマンド
```typescript
// システム状態詳細取得
const health = await performanceOrchestrator.getSystemHealth()
console.log('System Health:', JSON.stringify(health, null, 2))

// パフォーマンス統計取得
const summary = await performanceOrchestrator.getPerformanceSummary()
console.log('Performance Summary:', JSON.stringify(summary, null, 2))
```

---

*最終更新: 2025-08-21*