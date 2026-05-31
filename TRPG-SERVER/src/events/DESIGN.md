# events/ 設計とバス一本化計画（DESIGN）

**作成日:** 2026-05-31 / ブランチ `refactor/events-bus-unification`（B-2: H2/H4）
**上位方針:** `src/ARCHITECTURE.md`（依存方向 `features → domains → core → shared`、`@Global`/`forwardRef` 原則禁止）
**経緯の履歴:** `AI.event.md`（※過去に「移行完了」と繰り返し記載しているが、実装は新旧並存。本書が現状の正本）

## 現状（2026-05-31 実コード調査）

イベント基盤は **新旧が並存**している。

| 機構                              | 場所                                         | 状態                            | 利用                                                           |
| --------------------------------- | -------------------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| **TypedEventService**             | `shared/application/typed-event.service.ts`  | **主流（統一先）**              | 145利用 / 41ファイル。EventEmitter2 を型安全ラップ             |
| **EventRegistryService**          | `events/event-registry.service.ts`           | 新・File-based 登録             | TypedEventService 経由でハンドラ自動登録                       |
| ~~レガシーバス（旧 global bus）~~ | ~~`events/bus/global-event-bus.service.ts`~~ | **削除済み（T2c, 2026-05-31）** | 全消費者が TypedEventService へ移行・dead 利用を撤去し本体削除 |
| **EventRouterService**            | `events/bus/event-router.service.ts`         | **デッド（即撤去可）**          | routing メソッドの呼び出し元ゼロ。登録/再exportのみ            |

**逆流依存の実態（audit の「contracts 逆流」は誤り。contracts 自体はクリーン）:**

- `events/handlers/*`（`character.creation.completed.ts` / `character.update.completed.ts`）が `discord/features/characterEdit`・`characterThread` のサービスを直接 import（events→features の逆転）。
- `events/events.module.ts` が `CharacterEditModule` / `CharacterThreadFeatureModule` を `forwardRef` import（events→features の逆転）。

## 目標アーキテクチャ

- **バスは TypedEventService 1系統**に統一（EventEmitter2 ラッパ）。レガシーバス（旧 global event bus）と `EventRouterService` は撤去済み（T1/T2c）。
- **登録は EventRegistryService（File-based handlers）に一本化**。手動 `on()` 登録は廃止。
- **依存方向を是正**：events 層は domains/core/shared のみに依存し、**discord/features に依存しない**。Discord UI 更新が必要な完了系ハンドラは、events 層から features を呼ぶのではなく、(a) discord 層側でイベントを購読する、または (b) ポート（interface トークン）越しに呼ぶ。
- `@Global`/`forwardRef` を増やさない（既存の UserDomain⇄AuthDomain 循環のみ許容）。

## 段階計画（各ステップ＝小さな PR、安全な順）

- **T1: デッドな EventRouterService 撤去**（低リスク・本PR）
  `event-router.service.ts` 削除、`events.module.ts` の import/providers/exports と `events/index.ts` の re-export を除去。利用ゼロを確認済み。
- **T2: レガシーバス（旧 global event bus）の消費者を TypedEventService へ移行 → レガシーバス撤去**（中〜高）✅ 完了
  到達可能性の精査（2026-05-31）で、2バスが別 EventEmitter2 で隔離されている前提のもと、各消費者を LIVE/DEAD/BRIDGE に分類した：
  - `CharacterEventHandler`（events/handlers/character-event.handler.ts）= **完全 DEAD**。listen 対象（character.updated/deleted/update.requested/deletion.requested/creation.failed）は全て TypedEventService 側で emit されレガシーバスには届かないため発火しない。
  - `DiscordIntegrationHandler` = **部分 LIVE**。`discord.embed.update.requested` と `discord.notification.requested` のみ、ブリッジ役がレガシーバスに emit→受信して実際の Discord 通知/Embed更新を行う**生フロー**。他の listen（channel/thread.create.requested 等）は未発行で DEAD。
  - `CharacterCreationCompletedHandler`（File-based, TypedEventService 登録）＝ **BRIDGE**。上記2イベントをレガシーバスへ emit。
  - `CharacterEditFeatureHandler`（discord/features, TypedEventService listen）＝ **BRIDGE**。`discord.embed.update.requested` をレガシーバスへ emit。
  - **サブステップ**:
    - **T2a**: 完全 DEAD の `CharacterEventHandler` を削除（events.module の providers/exports・index の re-export 除去）。低リスク。
    - **T2b**: 生フローを TypedEventService へ移設 — ブリッジ2件の `discord.embed.update.requested`/`discord.notification.requested` emit をレガシーバス→TypedEventService に、`DiscordIntegrationHandler` の当該2 listen を TypedEventService に揃える。DEAD な listen は除去。**⚠️ 実 Discord 通知/Embed 更新フローに触れ、E2E spec が削除済みで自動テストが無いため要手動確認**。
      - **✅ 完了（2026-05-31）**: `contracts/index.ts` の `CharacterEventContracts` に2イベントを型付き追加（payload はレガシーバス形式の `type` を除いた形＝`embedData`/`notification`/`channelId`/`timestamp`/`source` を保持）。producer 3箇所（`character.creation.completed.ts` の notification/embed.update、`character-edit-feature.handler.ts` の embed.update.refresh）を `typedEventService.emit('<name>', {...})` に移設。consumer `discord-integration.handler.ts` は `TypedEventService` を inject し当該2 listen を `typedEventService.on(...)` に変更（他 listen・レガシーバスへの emit は T2c 対象として不変）。当該2イベントは TypedEventService 側でブリッジ以外に producer 無しを確認（二重ハンドリング無し）。安全網30テストは挙動不変のまま緑（assert はバスのみ repoint、イベント名・payload・依存検証は不変）。build / check:circular（既存の UserDomain⇄AuthDomain のみ）OK。レガシーバス本体・DEAD listen の削除は T2c に残す。
    - **T2c**: 残存利用が消えたレガシーバス（旧 global event bus サービス）を削除（events.module/index/プロバイダ）。
      - **✅ 完了（2026-05-31, ブランチ `refactor/events-globalbus-removal-t2c`）**: T2b で生フローを TypedEventService へ移設済みのため、レガシーバスに残る listen/emit は全て dead（emit する者が居ない／listen する者が居ない）であることを実コードで確認のうえ撤去。
        - `discord-integration.handler.ts`: dead な7 listen（channel.create.requested/created・thread.create.requested/created・embed.updated・notification.sent・integration.error）と対応 private ハンドラ、レガシーバスへの全 emit（system.audit.logged / system.performance.metrics.collected / discord.integration.error / system.error.occurred / character.update.requested）を削除。残すのは TypedEventService の2 listen（embed.update.requested / notification.requested＝ログ処理）のみ。
        - `character.creation.completed.ts`: dead emit（system.audit.logged / system.error.occurred）と注入を削除。TypedEventService emit と Discord UI 直接呼び出しは保持。
        - `character-edit-feature.handler.ts`: dead emit を削除。`character.update.requested`（modal.submitted 経路）はレガシーバス行きの dead であり、**実際の modal→キャラ更新は `character-modal-handler.service.ts` が TypedEventService 経由で `character.update.requested` を emit→`CharacterUpdateRequestedHandler` が処理する別の LIVE 経路で機能している**ことを確認。よって挙動変更なしで除去。`system.error.occurred`（error.occurred 経路）も dead のため除去。
        - `events/bus/global-event-bus.service.ts` 削除、空になった `events/bus/` ディレクトリ削除、`events.module.ts` / `events/index.ts` の参照除去。
        - 安全網3 spec は dead な assert を落とし、LIVE な TypedEventService 経由の assert（イベント名・payload・依存呼び出し）は緑のまま維持。build / test / check:circular（UserDomain⇄AuthDomain の1件のみ）OK。
- **T3: events→features 逆流の解消**（設計重・高）
  完了系ハンドラ（`character.*.completed`）の Discord UI 更新を、ポート（interface＋DI トークン）越し、または discord 層購読へ移し、`events.module.ts` の feature import と handlers の `discord/features` import を撤去。
- **T4（任意）: TypedEventService の配置見直し**
  `shared/application` → ARCHITECTURE の目標 `core/events` への移動を検討（純粋層に DI service を置かない方針との整合）。影響大のため後回し可。
- **T5: 登録経路の最終統一とドキュメント整理**
  残存手動 `on()` を一掃、`AI.event.md` を現状に合わせて刷新（過剰な「完了」記述を訂正）。

各ステップ後に `pnpm run build` → `pnpm run check:circular`（UserDomain⇄AuthDomain のみ許容）→ 関連 spec で検証する。
