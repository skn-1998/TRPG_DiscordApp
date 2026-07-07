---
name: trpg-architecture
description: >-
  この dokcer-trpg-remix-app モノレポ（Discord 連携の TRPG 支援ツール）の全体像・アーキテクチャ・
  ディレクトリ構成・技術スタック・作業ルールを説明するためのスキル。「このリポジトリ（プロジェクト/
  フォルダ）の構成を教えて」「アーキテクチャ／全体像を説明して」「どこに何があるの」「TRPG-SERVER と
  trpg-remix-app の関係は？」「ドメイン構成は？」「依存関係・循環参照のルールは？」「オンボーディング
  したい」「どのドキュメントを見ればいい？」といった、構成理解・設計説明・案内を求める依頼で必ず使う。
  バックエンドの domains/discord/events 構成とイベント駆動設計、フロントの Remix + Mantine 構成、
  正本ドキュメント(AI.*.md)の在り処を正確に答えたいときに参照する。個別機能の実装・バグ修正そのものが
  目的のときは不要（ただし着手前に全体像を掴みたい場合は使ってよい）。
---

# TRPG アプリ アーキテクチャ・ガイド

`dokcer-trpg-remix-app` モノレポ全体の役割と構成を、素早く正確に説明するためのスキル。
まずこの地図で方向づけし、詳細は「正本ドキュメント(AI.*.md)」を開いて確認する。推測で断言しない。
**構成の最終確認: 2026-06-07**（`src/` 直下・`discord/` 配下・`features/` 化は移行で増減するため、
断言前に実ディレクトリと AI.*.md を必ず確認する）。

回答は日本語。コマンドは `npm` ではなく `pnpm` を使う。

## このリポジトリは何か

**Discord 連携の TRPG（テーブルトークRPG）支援ツール**。pnpm モノレポで、Docker（dev/prod の
マルチステージ + nginx リバースプロキシ）で動かす。主役は 2 パッケージ：

- **TRPG-SERVER/** … NestJS 製バックエンド。**Discord ボット**と **Web API** の両方を担う。Port 3000。
- **trpg-remix-app/** … Remix(Vite) + React + TypeScript の Web フロントエンド。Port 5173。

補助：`nginx/`（リバースプロキシ/SSL, Port 80/443）、`e2e/`、`document/`（横断ドキュメント）、
`docker-compose*.yml`、PowerShell エイリアス `docker-aliases.ps1`（`dcr`/`dcup`/`dcl`/`dch` 等）。

## 正本ドキュメントは AI.*.md（最重要）

設計の一次情報は各パッケージの **`AI.md` と `AI.*.md`**。ルート `CLAUDE.md` も「作業前に必ず `AI.md`
を確認し、テーマに応じて `AI.*.md`（例: `AI.domain.md`, `AI.discord.md`, `AI.test.md`）も読む」「作業
終了後は状況を `AI.*.md` に必ず記載する」と定めている。このスキルは安定した骨格の地図にすぎないので、
具体仕様・最新状況は該当 `AI.*.md` / `document/` を開いて確認する。

## 作業ルール（ルート CLAUDE.md）

- 日本語で対応し、`pnpm` を使う。着手前に `AI.md`／関連 `AI.*.md` を読み、終了後に状況を `AI.*.md` へ記載する。
- **TRPG-SERVER で `pnpm run build` 後は `pnpm run start:dev` と `pnpm run check:circular` を実行**し、
  依存関係（循環参照）を確認する。`check:circular` は `madge --circular` による検出。
- **循環依存はゼロ**（`check:circular` は「No circular dependency found!」が正常）。かつて許容していた
  UserDomain ⇄ AuthDomain の循環は **H6（2026-06-01）で解消済み**（トークン検証を `JwtTokenService`/
  `AuthTokenModule` へ切り出し、UserModule→AuthModule を撤去）。以後、いかなる循環参照も禁止。

## バックエンド：TRPG-SERVER（NestJS）

レイヤード（Controller → Service → Repository → Model(Mongoose Schema)）＋ ドメイン別モジュール ＋
イベント駆動（`TypedEventService` = EventEmitter2 の型安全ラッパー、現在は `core/events` に集約）。
`src/` 直下の実ディレクトリは **config, core, discord, domains, events, shared, types, utils**
（`auth/`・`middleware/` は廃止済み＝auth は `domains/auth` に統合）。主な構成：

```
src/
├── domains/        ドメイン本体（Controller-Service-Repository・dto/models/repositories 等）
│   ├── auth        認証・認可（JWT, guards, strategies）
│   ├── character   キャラクター管理
│   ├── user        ユーザー管理
│   └── dice-roll   ダイスロール履歴
├── discord/        Discord ボット。今は層化モジュール化（discord-facade.service もここ）
│   ├── commands/      スラッシュコマンド（薄いアダプタ）
│   ├── events/        button/modal/select（薄いアダプタ）
│   ├── interactions/  registry・handlers（if 分岐 → Registry 委譲方式へ移行中）
│   ├── features/      characterEdit, characterThread, diceRoll, gameSystem, userDefinedDice（ロジック集約）
│   ├── services/      channel, dice, monitoring（Discord API 抽象化）
│   └── application/ controllers/ dto/ models/ schemas/ interfaces/ static/ utils/
├── events/         イベント契約・handlers・middleware・schemas ＋ EventRegistryService
├── core/           横断基盤（database, dto, events〔TypedEventService〕, http〔Interceptor＋例外フィルタ〕,
│                    interfaces, shared, testing, types）
├── config/         型安全な設定（AppConfigService / 環境変数バリデーション）※将来 core/config へ移設予定
├── shared/  types/  utils/   ※shared=純粋関数の単一ホーム、utils は段階的に解消中
```

主要ドメイン: **auth, character, user, dice-roll, discord**。
技術スタック（AI.md 概要より）: NestJS v10、TypeScript、**MongoDB（Mongoose）**、
JWT + Discord OAuth2（passport-discord）、**discord.js v14**、**bcdice**（ダイス計算）、
class-validator/transformer、Swagger。※package.json には pg/typeorm・dynamoose 等の依存も含まれるが、
設計ドキュメント上の主データストアは MongoDB。実際の利用範囲は該当コードで確認する。

主なコマンド：`pnpm run build`(nest build) → `pnpm run start:dev` → `pnpm run check:circular`。
テストは `pnpm run test`(Jest, `*.spec.ts`)、E2E は `pnpm run test:e2e` / `test:e2e:tc`(testcontainers, MongoDB)。

### バックエンドの設計の要点
- ドメインは Controller-Service-Repository で統一。横断連携は `TypedEventService` のイベント駆動で疎結合化
  （`forwardRef` による直接循環依存を段階的に排除済み）。
- Discord 層は「Commands/Events = 薄いアダプタ」「Features = ビジネスロジック」の分離が方針。
  Interactions は `if` 分岐から **Registry 委譲方式**へ移行中（`interactions/registry`・`handlers`）。
- `src/ARCHITECTURE.md`（最新の全体方針）が依存方向の正本：`features → domains → core → shared`、
  `@Global`/`forwardRef` 原則禁止、events/discord/domains/shared の責務境界を定義。なお `features/` は
  **目標の最上位ディレクトリ**で、現状はまだ物理的には `domains/` + `discord/`（移行は Step 単位で進行中）。
- イベント基盤は `TypedEventService` 1系統（`core/events`）に統一済み（旧3系統バスは撤去）。エラー処理は
  `core/http` の Interceptor＋例外フィルタへ移行済み（グローバル化は残課題）。**現状の真実は `AI.refactor.md` が正本**。

## フロントエンド：trpg-remix-app（Remix）

Feature ベース構成。`app/` の主な構成：

```
app/
├── routes/      Remix フラットルーティング（_auth.login, _index, _user.*, character+, _nest-route.* 等）
├── features/    機能単位（auth, character, characterTemplate, users, scenario, discord, mock）
├── components/  再利用 UI（Elements/Layouts 等）
├── lib/         API クライアント（api-client.ts / api-response.util.ts。axios で NestJS と通信、型安全レスポンス）
├── store/       状態管理（Zustand + Immer）
├── hooks/  config/  types/  styles/  utils/  static/
```

技術スタック（trpg-remix-app/AI.md より）: Remix v2(Vite) + React + TypeScript、**Mantine v7**（UI。
Tailwind ではない点に注意）、**Zustand + Immer**（状態）、axios、fuse.js。
テストは Jest（ユニットはほぼ未整備）/ Playwright（E2E）。テーマは `THEME.md`、設計・規約は `trpg-remix-app/AI.md`。
コマンド：`pnpm run dev` / `build` / `typecheck` / `test`。

## 全体のデータフロー

- Web：ブラウザ → nginx → Remix(loader/action) → `app/lib`(axios) → NestJS API(3000)
  → `domains/*` の Service → Repository → MongoDB。認証は Discord OAuth2 → JWT(Cookie)。
- Discord：discord.js Gateway → `discord/interactions`(registry→handlers) または `commands`/`events`
  → `discord/features`（diceRoll は bcdice 利用）→ 必要に応じて `domains/*`。
- 横断連携は `TypedEventService`（イベント契約 `AppEventContracts`）で発行・受信。

## 正本ドキュメントの場所（深掘り用ポインタ）

AI.md が定める鮮度順：**現状の真実 = `AI.refactor.md`** → `src/ARCHITECTURE.md` →
`src/events/AI.event.md`＋`DESIGN.md` → `AI.test.md`。
`AI.architecture.md` / `src/AI.architecture.md` は **2025 年の履歴（陳腐化を含む）** なので最新確認には使わない。

- ルート: `CLAUDE.md`（方針）、`README.md`（Docker 構成）、`AGENTS.md`
- バックエンド（正本）: `TRPG-SERVER/AI.refactor.md`（リファクタ進捗・現状・残課題＝最優先）、
  `src/ARCHITECTURE.md`（依存方向・横断コード/型の置き場所決定表の正本）、
  `src/events/AI.event.md`・`src/events/DESIGN.md`（イベント基盤）、
  `src/discord/DESIGN.md`・`src/discord/AI.discord.md`・`src/discord/interactions/README.md`・`MIGRATION_GUIDE.md`（Discord 層）、
  `AI.test.md`（テスト/カバレッジ）、`AI.types.md`、`AI.domain.md`、`AI.character.md`、`AI.development.md`、`AI.md`（概要・索引）
- バックエンド（補助・レビュー）: `TRPG-SERVER/docs/`（`guides/` `history/` `refactor/` `reviews/`）。
  特に `docs/reviews/feature-inventory-2026-06-05.md`（実コード根拠の機能棚卸し）と `docs/README.md`（索引）。
- フロントエンド: `trpg-remix-app/AI.md`、`AI.test.md`、`THEME.md`；`app/features/*/AI.*.md`
  （`character/AI.character.md`, `characterTemplate/AI.{feature,api,ui,types,security}.md` 等）
- 横断スナップショット: `document/`（`project-status.md`, `backend-trpg-server.md`, `frontend-trpg-remix-app.md`,
  `interaction-registry.md`, `dice-roll-flow.md`, `open-issues-next.md`, `phase0-character-sheet.md`, `playwright-learning.md`）

## ドメイン別 設計ガイドスキル（実装・レビュー時はこちらへ）

構成の説明はこのスキルで足りるが、**特定ドメインのコードを実装・変更・レビューするときは対応する
ドメインスキルを起動**する（責務・公開API・やらないこと・既知の落とし穴を定義。下位モデル/Codex への
委譲時は該当スキルの「やらないこと」「落とし穴」を委譲プロンプトに注入する）：

- `trpg-domain-auth` … 認証・JWT・OAuth・AuthTokenModule（Auth⇄User 循環の再導入禁止）
- `trpg-domain-user` … ユーザー情報・characterIds・Discord トークン保管
- `trpg-domain-character` … キャラクター CRUD・属性セクション・projection の罠（S-1）
- `trpg-domain-dice-roll` … ロール履歴の永続化・保存キーの意味論（計算はしない）
- `trpg-domain-discord` … Bot アプリケーション層・customId 契約・handler 追加手順・イベント RPC 禁止

## 回答のしかた
- 聞かれた粒度に合わせる。「全体像」なら 2 パッケージ + データフローを簡潔に。「依存関係のルール」なら
  レイヤー方向（features→domains→core→shared）と UserDomain/AuthDomain 循環の扱いを中心に。
  「どこに何が」なら上のツリーで案内する。
- ドメインやディレクトリは移行途中で増減し得る。厳密に答える前に該当ディレクトリ（例
  `TRPG-SERVER/src/domains/`）を一度確認し、仕様の詳細は該当 `AI.*.md` を一次情報として読む。
