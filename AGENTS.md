# Codex Project Rules

このリポジトリで Codex が作業するときのルール。

## 作業前に読むもの

TRPG-SERVER を触る場合は、最初に次を確認する。

1. `TRPG-SERVER/AI.md`
2. `TRPG-SERVER/src/ARCHITECTURE.md`
3. 対象領域の設計書
   - Discord: `TRPG-SERVER/src/discord/DESIGN.md`
   - Discord interactions: `TRPG-SERVER/src/discord/interactions/README.md`
   - Interactions migration: `TRPG-SERVER/src/discord/interactions/MIGRATION_GUIDE.md`
   - Events: `TRPG-SERVER/src/events/DESIGN.md`（未作成なら作成を優先）

既存設計と矛盾する実装を入れない。矛盾を見つけた場合は、先に設計文書を更新するか、ユーザーに確認する。

## 基本方針

- NestJS は feature / domain 中心で整理する。
- 依存方向は原則 `features -> domains -> core -> shared`。
- `core` / `events` / `interactions` は feature 実装を所有しない。
- feature 固有の handler / adapter / presenter / pagination / ports は feature 側に置く。
- domain service は Discord、HTTP response、UI、interaction、feature-local event orchestration を知らないようにする。

## 禁止事項

新規コードで以下を追加しない。

- 新規 `forwardRef`
- 新規 `@Global()` module
- 新規 `EventEmitterModule.forRoot()`
- feature provider を `core` / `shared` / `events` / `interactions` module に登録
- customId / event name の文字列直書き
- domain service から Discord / interaction / UI への依存
- 新規 `process.env` 直接参照
- service locator 的な `ModuleRef.get(...)`

既存の違反を触る場合は、局所修正で増やさず、段階的に減らす。

## 設計ルール

### Events

- event bus は 1 系統に寄せる。
- `EventsModule` は feature module を import しない。
- feature module が event registry / bus を import し、自分の handler を登録する。
- `GlobalEventBusService` / `EventRouterService` は legacy として扱う。
- `TypedEventService.on()` の直接登録は registry 経由へ寄せる。

### Discord

- `InteractionsModule` は feature module を import しない。
- feature 側が `InteractionRegistryService` を import して handler を明示登録する。
- customId は Factory / Parser / Handler pattern 定数で管理する。
- handler は routing と executor への委譲に限定する。
- dice-roll pagination は 1-indexed page state を前提にする。

### Config

- 設定値は `AppConfigService` に寄せる。
- 新規コードで Nest の `ConfigService` を直接 inject しない。
- `process.env` 直接参照は config module / env validation / test bootstrap に限定する。

### Shared / Utils / Types

- `shared/utils` は副作用なしの純粋関数だけにする。
- DI service は `utils` に置かない。
- feature / domain 固有型は各 feature / domain 配下に置く。
- `types` は本当に横断的な型だけに限定する。

## 実装時の進め方

- 既存の未追跡・変更済みファイルを勝手に戻さない。
- 変更は目的に対して最小限にする。
- 大きな再設計は設計書更新から始め、実装は 1 境界ずつ進める。
- `/discord`、`/events`、`/domains` を同時に大きく動かさない。
- manual edit は `apply_patch` を使う。

## Claude への作業委譲

Codex が Claude に直接処理を実行させることはできない。  
Claude へ作業を渡す場合は、Codex は **ハンドオフ文書を作成・更新する**。

委譲が向いている作業:

- 長時間の実装作業
- 大量ファイルの機械的移動
- 設計書に沿った段階的リファクタ
- テスト修正を含む反復作業

委譲前に Codex が必ず行うこと:

1. 現在の目的を 1 文で書く
2. 関連設計書を列挙する
3. 変更してよい範囲 / 触らない範囲を明記する
4. 既知の未追跡・変更済みファイルがある場合は注意を書く
5. 実行すべきテストコマンドを書く
6. 完了条件を書く

ハンドオフ先は原則として `TRPG-SERVER/CLAUDE_HANDOFF.md` を使う。  
一時的な短い委譲なら、ユーザーへ以下の形式で返す。

```md
## Claude Handoff

目的:

参照:

変更範囲:

触らない範囲:

注意:

検証:

完了条件:
```

Claude が作業する場合も、`CLAUDE.md`、`TRPG-SERVER/AI.md`、`TRPG-SERVER/src/ARCHITECTURE.md` の順に確認する。

## テスト方針

変更範囲に応じて focused test を実行する。

例:

```powershell
cd TRPG-SERVER
pnpm test -- src/discord/components/pagination/dice-roll-pagination.service.spec.ts --runInBand
pnpm test -- src/discord/interactions/handlers/handlers.integration.spec.ts --runInBand
```

typecheck を実行した場合、既存の unrelated error が出ることがある。失敗した場合は、今回の変更に起因するかを切り分けて報告する。

```powershell
cd TRPG-SERVER
pnpm exec tsc --noEmit --pretty false
```

## ドキュメント更新

設計や移行方針を変えた場合は、該当する文書も更新する。

- 全体方針: `TRPG-SERVER/src/ARCHITECTURE.md`
- 索引・最新メモ: `TRPG-SERVER/AI.md`
- Discord: `TRPG-SERVER/src/discord/DESIGN.md`
- Events: `TRPG-SERVER/src/events/DESIGN.md`
