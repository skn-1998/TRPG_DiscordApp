# Discord Interactions Layer

**最終更新**: 2026-05-30

Discord.js のボタン・セレクトメニュー・モーダルインタラクションを処理するレイヤー。

> 全体設計・リファクタ計画は [../DESIGN.md](../DESIGN.md) を参照。

---

## 役割（目標）

**InteractionsModule はルーティング基盤のみを提供する。**

- 受け取った interaction を `InteractionRegistryService` 経由で登録済み handler に渡す
- feature 固有の adapter / pagination / UI 生成は **各 feature module が所有**

---

## 構成

```
interactions/
├── registry/
│   ├── interaction-registry.service.ts   # customId → handler ルーティング
│   └── pattern-matcher.service.ts        # 優先度付きパターンマッチ
├── handlers/
│   ├── base/interaction-handler.base.ts  # Handler 基底クラス
│   ├── character-edit/                   # feature 側へ移管済み（履歴上の参照）
│   ├── dice-roll/                        # feature 側へ移管済み（履歴上の参照）
│   └── character-thread/                 # feature 側へ移管済み（履歴上の参照）
├── interactions.controller.ts            # Legacy entrypoint（service locator 経路は撤去済み）
├── interactions.service.ts               # メトリクス + Registry 委譲（characterEdit 特例分岐は P1-A で撤去済み）
├── interactions.module.ts                # slim 化進行中（feature module import は撤去済み・詳細は AI.refactor.md）
├── button/                               # Legacy（Phase 0/1 で整理）
├── select/
├── modal/
└── channel/
```

---

## ルーティングフロー

### 現状（As-Is）

```
DiscordInteractionHandlerService
  → InteractionsService.execute()（特例 if あり）
    → InteractionRegistryService.route()
      → Handler → Adapter / Legacy Service
```

### 目標（To-Be）

```
core/interaction-dispatcher
  → InteractionRegistryService.route()
    → features/*/handlers → features/*/adapters
```

詳細は [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)。

---

## Handler の書き方

```typescript
@Injectable()
export class DicePagePrevHandler extends ButtonInteractionHandler {
  constructor(private readonly executor: DicePagePrevButtonService) {
    super()
  }

  getCustomIdPattern(): string {
    return DicePageCustomId.patterns.prev // custom-id 定数を参照（Phase 0 以降）
  }

  async execute(interaction: ButtonInteraction): Promise<void> {
    await this.executor.execute(interaction)
  }
}
```

- **Handler**: ルーティング + 1 行委譲
- **Adapter/Executor**: Discord 応答処理
- **customId**: Factory / Parser / pattern 定数に集約（[DESIGN.md §6](../DESIGN.md#6-customid-契約)）

---

## 登録方法

各 FeatureModule の `onModuleInit()` で `interactionRegistry.registerHandlers([...])` を呼ぶ。

**現状**: diceRoll / characterEdit / characterThread の handlers は feature module 側で provide し、feature 側から Registry に登録する。InteractionsModule 側の handler 自動探索（ModuleRef 経由）は撤去済み。

`InteractionsService.execute()` の characterEdit 特例分岐、InteractionsModule の monitoring / dice service re-export、feature module import はいずれも P1-A で撤去済み（進捗の正本は `AI.refactor.md`）。残る slim 化（Map キャッシュ廃止等）は Phase 2 で継続する。

---

## デバッグ

```typescript
interactionRegistry.debugInfo() // handler 一覧 + 実行統計
interactionRegistry.getStatistics() // 未登録 customId 集計含む
```

未登録 customId は `type:customId` 単位で集計される（例: `button:dice-prev*msg*ch`）。

---

## テスト

| ファイル                                | 内容                           |
| --------------------------------------- | ------------------------------ |
| `registry/*.spec.ts`                    | Registry / PatternMatcher 単体 |
| `handlers/base/*.spec.ts`               | マッチスコア・pattern 判定     |
| `handlers/handlers.integration.spec.ts` | 全 handler の pattern 登録確認 |

feature 単位のテスト方針は [DESIGN.md §8](../DESIGN.md#8-テスト戦略)。
