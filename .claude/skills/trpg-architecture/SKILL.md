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
- **UserDomain ⇄ AuthDomain の循環参照は許容**（現状 1 件のみ検出される既知の循環）。
  それ以外の循環参照は禁止。なお `src/ARCHITECTURE.md` では「AuthModule⇄UserModule は将来の解消対象」
  と位置づけられている（＝今は許容、目標は解消）。

## バックエンド：TRPG-SERVER（NestJS）

レイヤード（Controller → Service → Repository → Model(Mongoose Schema)）＋ ドメイン別モジュール ＋
イベント駆動（`TypedEventService` = EventEmitter2 の型安全ラッパー）。`src/` の主な構成：

```
src/
├── domains/        ドメイン本体。各 *.module/*.controller/*.service・dto/models/repositories 等
│   ├── auth        認証・認可（JWT, guards, strategies）
│   ├── character   キャラクター管理
│   ├── user        ユーザー管理
│   └── dice-roll   ダイスロール履歴
├── discord/        Discord ボット（下記）。※ドメインとしても "discord" を数える
│   ├── commands/      スラッシュコマンド（薄いアダプタ）
│   ├── events/        button/modal/select（薄いアダプタ）
│   ├── interactions/  registry/handlers（Registry 方式へ移行中）
│   ├── features/      characterEdit, characterThread, diceRoll, gameSystem, userDefinedDice（ロジック集約）
│   └── services/      channel, dice, monitoring（Discord API 抽象化）
├── events/         イベント基盤（bus, contracts, handlers, middleware, schemas）
├── core/           横断基盤（database, dto, interfaces, shared services, testing, types）
├── config/         型安全な設定（AppConfigService / 環境変数バリデーション）
├── auth/  middleware/  shared/  types/  utils/
```

主要ドメイン: **auth, character, user, dice-roll, discord**。
技術スタック（AI.architecture.md より）: NestJS v10、TypeScript、**MongoDB（Mongoose）**、
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
  `@Global`/`forwardRef` 原則禁止、events/discord/domains/shared の責務境界を定義。

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
テストは Jest（ユニット, 整備途上）/ Playwright（E2E）。テーマは `THEME.md`、規約は `document/coding-rules.md`。
コマンド：`pnpm run dev` / `build` / `typecheck` / `test`。

## 全体のデータフロー

- Web：ブラウザ → nginx → Remix(loader/action) → `app/lib`(axios) → NestJS API(3000)
  → `domains/*` の Service → Repository → MongoDB。認証は Discord OAuth2 → JWT(Cookie)。
- Discord：discord.js Gateway → `discord/interactions`(registry→handlers) または `commands`/`events`
  → `discord/features`（diceRoll は bcdice 利用）→ 必要に応じて `domains/*`。
- 横断連携は `TypedEventService`（イベント契約 `AppEventContracts`）で発行・受信。

## 正本ドキュメントの場所（深掘り用ポインタ）

- ルート: `CLAUDE.md`（方針）、`README.md`（Docker 構成）、`AGENTS.md`
- バックエンド: `TRPG-SERVER/AI.md`（概要・最新メモ）、`AI.architecture.md`、`AI.domain.md`、
  `AI.development.md`、`AI.test.md`、`AI.types.md`、`AI.features.md`、`AI.character.md`；
  `src/ARCHITECTURE.md`（全体方針・依存方向の正本）、`src/discord/AI.discord.md`・`src/discord/DESIGN.md`、
  `src/events/AI.event.md`
- フロントエンド: `trpg-remix-app/AI.md`、`AI.test.md`、`THEME.md`、`document/coding-rules.md`；
  `app/features/*/AI.*.md`
- 横断スナップショット: `document/`（`project-status.md`, `backend-trpg-server.md`,
  `frontend-trpg-remix-app.md`, `interaction-registry.md`, `dice-roll-flow.md`, `open-issues-next.md`）

## 回答のしかた
- 聞かれた粒度に合わせる。「全体像」なら 2 パッケージ + データフローを簡潔に。「依存関係のルール」なら
  レイヤー方向（features→domains→core→shared）と UserDomain/AuthDomain 循環の扱いを中心に。
  「どこに何が」なら上のツリーで案内する。
- ドメインやディレクトリは移行途中で増減し得る。厳密に答える前に該当ディレクトリ（例
  `TRPG-SERVER/src/domains/`）を一度確認し、仕様の詳細は該当 `AI.*.md` を一次情報として読む。
