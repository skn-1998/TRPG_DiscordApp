---
name: trpg-architecture
description: >-
  この dokcer-trpg-remix-app モノレポ（Discord 連携の TRPG 支援ツール）の全体像・アーキテクチャ・
  ディレクトリ構成・技術スタック・作業ルールを説明するためのスキル。「このリポジトリ（プロジェクト/
  フォルダ）の構成を教えて」「アーキテクチャ／全体像を説明して」「どこに何があるの」「TRPG-SERVER と
  trpg-next-app の関係は？」「ドメイン構成は？」「依存関係・循環参照のルールは？」「オンボーディング
  したい」「どのドキュメントを見ればいい？」といった、構成理解・設計説明・案内を求める依頼で必ず使う。
  バックエンドの domains/discord/events 構成とイベント駆動設計、フロントの Next.js + Mantine 構成、
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
- **trpg-next-app/** … Next.js 16(App Router) + React 19 + TypeScript の Web フロントエンド。
  コンテナ内 Port 3000（local dev は 3100）。旧 trpg-remix-app は 2026-08 の Next 移行で撤去
  （経緯 = `document/NEXT_MIGRATION_PLAN.md`）。

補助：`nginx/`（リバースプロキシ/SSL, Port 80/443）、`e2e/`、`document/`（横断ドキュメント）、
`docker-compose*.yml`、PowerShell エイリアス `docker-aliases.ps1`（`dcr`/`dcup`/`dcl`/`dch` 等）。

## 正本ドキュメントは AI.*.md（最重要）

設計の一次情報は各パッケージの **`AI.md` と `AI.*.md`**。ルート `AGENTS.md` も「作業前に必ず `AI.md`
を確認し、テーマに応じて `AI.*.md`（例: `AI.domain.md`, `AI.discord.md`, `AI.test.md`）も読む」「作業
終了後は状況を `AI.*.md` に必ず記載する」と定めている。このスキルは安定した骨格の地図にすぎないので、
具体仕様・最新状況は該当 `AI.*.md` / `document/` を開いて確認する。

## 作業ルール（ルート AGENTS.md）

- 日本語で対応し、`pnpm` を使う。着手前に `AI.md`／関連 `AI.*.md` を読み、終了後に状況を `AI.*.md` へ記載する。
- **TRPG-SERVER で `pnpm run build` 後は `pnpm run start:dev` と `pnpm run check:circular` を実行**し、
  依存関係（循環参照）を確認する。`check:circular` は `madge --circular` による検出。
- **循環依存はゼロ**（`check:circular` は「No circular dependency found!」が正常）。かつて許容していた
  UserDomain ⇄ AuthDomain の循環は **H6（2026-06-01）で解消済み**（トークン検証を `JwtTokenService`/
  `AuthTokenModule` へ切り出し、UserModule→AuthModule を撤去）。以後、いかなる循環参照も禁止。

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

## フロントエンド：trpg-next-app（Next.js）

App Router + feature ベース構成。`app/` の主な構成：

```
app/
├── (App Router ルート)  login, auth/callback(Route Handler), user/*, templates/*（page.tsx / route.ts）
├── features/    機能単位（auth, character, characterTemplate, discord, users）。actions.ts = Server Actions
├── components/  再利用 UI（Layouts 等）
├── lib/         サーバ専用 API クライアント（api-client.server.ts / auth-guard.server.ts /
│                api-response.util.ts。axios で NestJS と通信・jwt は cookies() 直読み）
├── config/  styles/
```

技術スタック（trpg-next-app/AI.md が正本）: Next.js 16(App Router) + React 19 + TypeScript、
**Mantine 9**（UI。Tailwind ではない点に注意）、axios。状態は React ローカル state のみ。
テストは Jest（server 層と純関数中心）。ブラウザから TRPG-SERVER を直接叩かず、
通信は RSC / Server Action / Route Handler に限る（機械強制 = eslint 層規約）。
コマンド：`pnpm run dev`（port 3100）/ `build` / `typecheck` / `lint` / `test`。

## 全体のデータフロー

- Web：ブラウザ → nginx → Next.js(RSC/Server Action/Route Handler) → `app/lib`(axios) → NestJS API(3000)
  → `domains/*` の Service → Repository → MongoDB。認証は Discord OAuth2 → JWT(Cookie)。
- Discord：discord.js Gateway → `discord/interactions`(registry→handlers) または `commands`/`events`
  → `discord/features`（diceRoll は bcdice 利用）→ 必要に応じて `domains/*`。
- 横断連携は `TypedEventService`（イベント契約 `AppEventContracts`）で発行・受信。

## 正本ドキュメントの場所（深掘り用ポインタ）

- ルート: `AGENTS.md`（方針）、`README.md`（Docker 構成）、`AGENTS.md`
- バックエンド: `TRPG-SERVER/AI.md`（概要・最新メモ）、`AI.architecture.md`、`AI.domain.md`、
  `AI.development.md`、`AI.test.md`、`AI.types.md`、`AI.features.md`、`AI.character.md`；
  `src/ARCHITECTURE.md`（全体方針・依存方向の正本）、`src/discord/AI.discord.md`・`src/discord/DESIGN.md`、
  `src/events/AI.event.md`
- フロントエンド: `trpg-next-app/AI.md`（サーバ境界・JWT・封筒・redirect 規約の 1 ページ正本）
- 横断スナップショット: `document/`（`project-status.md`, `backend-trpg-server.md`,
  `NEXT_MIGRATION_PLAN.md`（移行計画・完了記録）, `interaction-registry.md`, `dice-roll-flow.md`,
  `open-issues-next.md`。`frontend-trpg-remix-app.md` は旧 Remix 期の歴史資料）

## 回答のしかた
- 聞かれた粒度に合わせる。「全体像」なら 2 パッケージ + データフローを簡潔に。「依存関係のルール」なら
  レイヤー方向（features→domains→core→shared）と UserDomain/AuthDomain 循環の扱いを中心に。
  「どこに何が」なら上のツリーで案内する。
- ドメインやディレクトリは移行途中で増減し得る。厳密に答える前に該当ディレクトリ（例
  `TRPG-SERVER/src/domains/`）を一度確認し、仕様の詳細は該当 `AI.*.md` を一次情報として読む。
