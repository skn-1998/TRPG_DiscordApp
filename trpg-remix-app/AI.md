# TRPG-Remix-App アーキテクチャ・ドキュメント

## プロジェクト概要

TRPG-Remix-Appは、テーブルトークRPG（TRPG）の管理・支援を行うフロントエンドアプリケーションです。Remixフレームワークを使用し、TRPG-SERVERと連携してキャラクター管理、ダイスロール、ゲームセッション管理などの機能を提供します。

### 主要機能

- **キャラクター管理**: TRPG用キャラクターの作成・編集・閲覧
- **ユーザー認証**: Discord OAuth2による認証システム
- **ダイスロール履歴**: Discord Botと連携したダイスロール管理
- **ゲームシステム対応**: 複数のTRPGシステムに対応
- **レスポンシブデザイン**: モバイル・デスクトップ両対応

## 技術スタック

### 主要技術

- **フレームワーク**: Remix v2.x (Full-Stack React Framework)
- **言語**: TypeScript
- **UIライブラリ**: Mantine v7.x
- **状態管理**: Zustand + Immer
- **認証**: JWT + Discord OAuth2
- **HTTP通信**: Axios
- **ビルドツール**: Vite
- **スタイリング**: CSS Modules + PostCSS

### pnpm セキュリティ運用

- `pnpm-workspace.yaml` で `minimumReleaseAge: 1440`、`minimumReleaseAgeStrict: true`、`blockExoticSubdeps: true`、`trustPolicy: no-downgrade` を明示し、公開直後の依存・外部ソース由来の推移依存・信頼レベル低下を防ぐ。
- dependency build script は `allowBuilds` で明示管理する。現在は `esbuild` と `unrs-resolver` のみ許可し、`dangerouslyAllowAllBuilds` は禁止。
- `vite@8` の peer dependency を満たすため、`esbuild@0.28.0` を devDependency と override で固定する。
- `verifyDepsBeforeRun: error` により、`pnpm run` 時の暗黙 install を禁止する。依存がずれている場合は `pnpm install --frozen-lockfile` で明示確認する。
- 監査は `pnpm run audit`、署名検証は `pnpm run audit:signatures` を使う。
- Vite では `vite-plugin-env-compatible` を使わず、`vite.config.mjs` の `__APP_PUBLIC_ENV__` に公開してよい値だけを渡す。`DISCORD_SECRET` は client bundle に注入しない。
- 開発環境の TLS 証明書回避は axios の HTTPS agent に閉じ込め、`NODE_TLS_REJECT_UNAUTHORIZED=0` のようなプロセス全体の無効化は使わない。

### TypeScript / ESLint セキュリティ運用

- `tsconfig.json` は `app/**/*.ts(x)` を対象にし、生成物・依存物は除外する。`allowJs: false`、`skipLibCheck: false`、`noImplicitReturns`、`noFallthroughCasesInSwitch`、`noImplicitOverride` を有効にする。
- ESLint は `build` / `dist` / `coverage` / `public` などの生成物を lint 対象にしない。browser 全体には Node/CommonJS globals を公開せず、必要な config / API client / 設定ファイルだけに限定する。
- `no-eval`、`no-implied-eval`、`no-new-func`、`react/no-danger` は error とし、ユーザー入力の式評価や HTML 展開で任意コード実行・XSSにつながる API を使わない。

### 主要依存関係

- `@remix-run/react`, `@remix-run/node` - Remixコアフレームワーク
- `@mantine/core`, `@mantine/hooks` - UIコンポーネントライブラリ
- `zustand` - 軽量状態管理
- `axios` - HTTPクライアント
- `@tabler/icons-react` - アイコンライブラリ
- `fuse.js` - 検索機能
- `lodash` - ユーティリティライブラリ

## アーキテクチャパターン

### 1. フィーチャードリブン開発（FDD）

```
Feature-Based Architecture
├── features/            # 機能別モジュール
│   ├── auth/           # 認証機能
│   ├── character/      # キャラクター管理
│   ├── users/          # ユーザー管理
│   └── scenario/       # シナリオ管理
```

### 2. レイヤードアーキテクチャ

```
Presentation Layer   - React Components, Pages
Application Layer    - Remix Loaders/Actions
Service Layer        - API Services, Business Logic
Infrastructure Layer - HTTP Client, State Management
```

### 3. コンポーネント設計

```
Atomic Design influenced
├── Elements/           # 基本要素（ボタン、入力など）
├── Components/         # 複合コンポーネント
├── Layouts/           # レイアウトコンポーネント
└── Features/          # 機能固有コンポーネント
```

## ディレクトリ構造とモジュール解説

### `/app` - メインアプリケーションコード

#### 1. **エントリーポイント**

```
app/
├── root.tsx              # アプリケーションルート
├── entry.client.tsx      # クライアントサイドエントリー
├── entry.server.tsx      # サーバーサイドエントリー
└── theme.ts             # Mantineテーマ設定
```

#### 2. **ルーティング** (`/routes`)

```
routes/
├── _index.tsx           # ホームページ
├── _auth.login.tsx      # ログインページ
├── _user.tsx           # ユーザー関連レイアウト
├── character+/         # キャラクター関連ルート
│   ├── index.tsx       # キャラクター一覧
│   ├── $id.tsx         # キャラクター詳細
│   └── $id.edit.tsx    # キャラクター編集
└── mock.tsx            # 開発用モックページ
```

**ルーティング特徴**:

- Remix Flat Routes使用
- ネストルートによるレイアウト共有
- 動的ルーティング（`$id`）
- プライベートルート（認証ガード）

#### 3. **フィーチャーモジュール** (`/features`)

各フィーチャーは以下の構造を持つ:

```
features/
├── auth/                 # 認証機能
│   ├── api/             # 認証API
│   ├── components/      # 認証コンポーネント
│   └── index.ts         # エクスポート管理
├── character/           # キャラクター管理
│   ├── api/             # キャラクターAPI
│   ├── components/      # キャラクターコンポーネント
│   ├── edit/            # キャラクター編集機能
│   ├── hooks/           # キャラクター専用フック
│   ├── types/           # キャラクター型定義
│   └── index.ts         # エクスポート管理
└── users/               # ユーザー管理
    ├── api/
    ├── components/
    └── index.ts
```

**フィーチャーモジュール設計原則**:

- 機能の独立性と再利用性
- 型定義の集約管理
- APIとUIの分離
- エクスポート管理による依存関係の明確化

#### 4. **UIコンポーネント** (`/components`)

```
components/
├── Elements/            # 基本UI要素
│   └── index.ts        # 共通エクスポート
├── Form/               # フォーム関連
├── Head/               # ヘッダー管理
├── Layouts/            # レイアウトコンポーネント
│   ├── AppLayout.tsx   # メインレイアウト
│   ├── Header.tsx      # ヘッダー
│   └── Footer.tsx      # フッター
└── ui/                 # カスタムUIコンポーネント
```

#### 5. **設定管理** (`/config`)

```
config/
├── config.service.ts        # 設定サービス
├── configuration.ts         # 設定値生成・型定義
├── environment.validator.ts # 環境変数バリデーション
└── schemas/
    └── environment.schema.ts # 環境変数スキーマ
```

**設定管理特徴**:

- 型安全な設定値アクセス
- 環境変数の自動バリデーション
- クライアント・サーバー両対応

#### 6. **状態管理** (`/store`)

```
store/
├── index.ts            # Zustandストア統合
├── counterSlice.ts     # カウンター状態スライス
└── testSlice.ts        # テスト用状態スライス
```

**状態管理アーキテクチャ**:

- Zustand + Immer による不変更新
- スライスパターンによる状態分離
- 永続化対応（localStorage）
- TypeScript完全対応

#### 7. **ライブラリ・ユーティリティ** (`/lib`)

```
lib/
├── api-client.ts           # HTTP通信クライアント（統合型定義対応）
├── api-response.util.ts    # 統合レスポンス処理ユーティリティ
├── gameSystem.ts           # ゲームシステム管理
└── hooks/                  # 共通カスタムフック
    ├── useCharacters.ts    # キャラクター管理フック
    └── useCharacterSummaries.ts # キャラクター概要フック
```

#### 8. **型定義** (`/types`)

```
types/
├── auth.ts             # 認証関連型定義
├── character.ts        # キャラクター関連型定義
└── index.ts            # 共通型定義エクスポート
```

#### 9. **スタイリング** (`/styles`)

```
styles/
├── globals.css         # グローバルスタイル
theme.ts               # Mantineテーマ設定
utils/
├── generateColors.ts   # カラーパレット生成
└── hoverStyles.tsx     # ホバー効果ユーティリティ
```

## Remixアーキテクチャの活用

### 1. **フルスタック対応**

- サーバーサイドレンダリング（SSR）
- クライアントサイドハイドレーション
- プログレッシブエンハンスメント

### 2. **データローディング**

```typescript
// Loader: サーバーサイドでのデータ取得
export async function loader({ request }: LoaderFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  // 認証状態の確認とデータ取得
}

// Action: フォーム送信・データ変更処理
export async function action({ request }: ActionFunctionArgs) {
  // フォームデータの処理
}
```

### 3. **認証フロー**

```
1. Discord OAuth2認証
2. JWTトークン取得・保存
3. サーバーサイドでの認証状態確認
4. 保護されたリソースへのアクセス
```

## UIアーキテクチャ（Mantine基準）

### 1. **テーマシステム**

```typescript
// カスタムカラーパレット
const theme = createTheme({
  primaryColor: 'main',
  colors: {
    main: mainColor, // プライマリカラー
    accent: accentColor, // アクセントカラー
    sub: subColor, // サブカラー
    comp: complementaryColor, // 補色
    bg: bgColor // 背景色
  }
})
```

### 2. **レスポンシブデザイン**

- モバイルファースト設計
- Mantineのブレークポイント活用
- フレキシブルレイアウト

### 3. **アクセシビリティ**

- ARIA属性の適切な使用
- キーボードナビゲーション対応
- カラーコントラスト配慮

## データフロー

### 1. **サーバーサイドレンダリングフロー**

```
Request → Remix Loader → API Call → Data → SSR → Response
```

### 2. **クライアントサイドインタラクションフロー**

```
User Action → React Component → Zustand Store → API Call → State Update → UI Update
```

### 3. **認証フロー**

```
Login → Discord OAuth → JWT Token → Cookie Storage → API Authorization
```

### 4. **統合型定義フロー**

> ※履歴資料（S6a で撤去済み）

```
API Request → postDomain/getDomain → Type-Safe Response → createApiHandler → Type Guard → Safe Data Access
```

## 主要な設計パターン

### 1. **Custom Hooks パターン**

- 状態ロジックの再利用
- 副作用の抽象化
- コンポーネントの簡素化

### 2. **Repository パターン**

- API呼び出しの抽象化
- データアクセスの一元化
- モック化によるテスト支援

### 3. **Compound Component パターン**

- 複雑なUIの構造化
- 柔軟なカスタマイズ性
- 再利用性の向上

### 4. **統合型定義パターン**

> ※履歴資料（S6a で撤去済み）

- 型安全なAPIレスポンス処理
- ドメインベースの型定義
- コンパイル時エラー検出
- IntelliSenseによる自動補完

### 5. **Error Boundary パターン**

- エラーハンドリングの分離
- ユーザーフレンドリーなエラー表示
- アプリケーション安定性の向上

## API通信アーキテクチャ

### 1. **統合型定義システム**

> 本機構は S6a で撤去済み。正典パターンは @trpg/api-contract の SuccessEnvelope<T> 直読み（封筒適用コントローラのみ）。

```typescript
// 型安全なAPIクライアント（新しい実装）
const response = await apiClient.postDomain('/auth/login', 'auth', { code })
const authData = authHandler.handleSuccess(response) // 型推論が効く

// 型ガードによる安全なアクセス
if (userInfo.success) {
  console.log(userInfo.auth.userName) // 型安全
} else {
  console.error(userInfo.message) // 型安全
}
```

### 2. **HTTPクライアント設定**

```typescript
// IPv4強制・SSL証明書検証回避（開発環境）
const apiClient = axios.create({
  baseURL: configService.get('server.domain'),
  withCredentials: true
  // IPv4強制でIPv6エラー回避
})
```

### 3. **認証インターセプター**

- JWTトークンの自動付与
- 認証エラーの自動処理
- リクエスト・レスポンスログ

### 4. **統合エラーハンドリング**

```typescript
// 統一されたエラーハンドリング
const errorMessage = ApiResponseUtil.handleError(err)
console.error('❌ ログインエラー:', errorMessage)
```

### 5. **ドメインベースレスポンス処理**

> ※履歴資料（S6a で撤去済み）

```typescript
// ドメイン指定でAPIハンドラーを作成
const authHandler = createApiHandler('auth')
const characterHandler = createApiHandler('character')

// 型安全なレスポンス処理
const authData = authHandler.handleSuccess(response)
const character = characterHandler.handleSuccess(response)
```

## サーバ⇄フロント型契約体制（@trpg/api-contract）

> 2026-07-26 導入。旧「統合型定義システム（DomainDataMap）」は S6a で全廃済み。
> 上の履歴資料ブロックは読み替え用に残しているだけで、新規コードでは使わない。

### この体制が保証すること / しないこと

- **保証する**: HTTP 封筒(success/message/timestamp/requestId/data/meta)の形と、
  payload 型宣言の server→契約 固定（**auth login・user profile・guilds・character**）。
  server の `SuccessResponse` / `ErrorResponse` が契約 interface を `implements` しているため、
  封筒フィールドを片側だけ変えると **server の build が TS2420 で落ちる**。
  auth login・user profile・guilds は server 戻り型が契約を参照するため、契約の必須キー追加・
  型変更・削除で server build が落ちる。S5a2 で固定・反証済み。
  **character payload は型宣言レベルの橋（`character-wire.contract.spec.ts`）で固定**し、
  entity/wire のトップレベルのキー集合・値型・意図的な optional 差分と、summary の型宣言同値を
  assert する。さらに `character.controller.http.spec.ts` が実 HTTP body のトップレベルキーを
  `characterEntitySchema.shape` から runtime 導出して照合し、Date の ISO 直列化、legacy section 欠損、
  summary payload と meta を通常 Jest suite で固定する。
  delete は契約側で wire 単体の required/optional を固定し、controller が契約型を直接宣言する。
  controller 戻り型は原則 entity 型のままだが、`remove()` は例外として wire を直接返す。
- **保証しない**: opaque な入れ子値、通常ゲート外の部分 projection、
  **endpoint↔wire の対応**（`apiClient` ジェネリクスは無検証）・**request 書込面**
  （response wire の保証対象外 — 規律とレビュー）。character の正確な射程は下記手順4に記載する。

### 封筒が適用される面 / 適用されない面

| 面                                                                               | 封筒     | 読み方               |
| -------------------------------------------------------------------------------- | -------- | -------------------- |
| `/auth/*`（`/auth/discord` と `/auth/discord/callback` を除く）                  | あり     | `response.data.data` |
| `/users/*`（`/users/discord/guilds` を含む）                                     | あり     | `response.data.data` |
| `/character`・`/character/:id`・`/character/summaries` (CharacterController)     | あり     | `response.data.data` |
| `/character/from-template`・`/character/:id/sheet` (CharacterSheetController)    | **なし** | `response.data`      |
| `/sheet-templates/*`・`/discord/*`・`/commands/*`・`/interactions/*`・`/`（app） | **なし** | `response.data`      |

- `/character` プレフィックスは封筒面と非封筒面が**同居**している。エンドポイント単位で確認すること。
- 非封筒面のエラーは Nest 既定形（`statusCode` / `message` / `error`）で、`ErrorEnvelope` では表現できない。
  `ApiResponseUtil.handleError` と `CustomError` は両形を扱えるように書いてある（`isErrorEnvelope` で判別）。

### 手順1: server のスキーマ／レスポンス形を変えたとき

1. 封筒フィールドを変えた場合 → `packages/api-contract/src/common/api-response.ts` を**同時に**直す。
   直さなければ `pnpm --filter trpg-server build` が落ちるので、忘れることはできない。
2. character 面の payload の形を変えた場合 →
   `packages/api-contract/src/character/character.wire.ts` を**手で**追随させる。
   型宣言の乖離は `character-wire.contract.spec.ts` が検出する（`pnpm run check:contract-stack`）。
   wire にキーを足したら `characterEntitySchema` にも足す（片側だけだとキー集合 assert が落ちる）。
   auth login・user profile・guilds は server build が不一致を検出する。
3. 永続化 zod スキーマ（`character.zod.ts` / `character-sheet-template.zod.ts`）を変えた場合 →
   契約パッケージが正本。server 側 `src/domains/**/schemas/*.zod.ts` は re-export の薄皮なので触らない。
4. 検証: `pnpm run check:contract-stack`。
   server build は spec を除外するため、character の型レベル橋を単独では評価しない。
   `check:contract-stack` が閉じるのは、封筒フィールド形（`implements`）、封筒 runtime 生成
   （interceptor/filter spec）、front の型/lint/公開面、character の型宣言レベルの橋、
   CharacterController の実 HTTP payload（schema 由来の許可キー、Date の ISO 化、summary/meta）。
   payload 型と server 実装の同値は auth login・user profile・guilds を S5a2 で機械固定済み。
   character は型宣言レベルの drift（トップレベルのキー集合・値型・意図的 optional 差分）に加え、
   実 HTTP payload の代表経路を固定する。

   **未固定**

   ①`sheet.values` の中身（opaque な `Record<string, unknown>`。BigInt/Map/Set/
   Infinity 等は型もスキーマも通り JSON 直列化で壊れる）②入れ子型（hub/sheet/palette/attribute）への
   optional フィールド追加 ③optional property への明示的 `undefined` 追加
   （`exactOptionalPropertyTypes:false` のため）。なお null/undefined union の片側追加は、親
   `tsconfig.json` が明示する `strictNullChecks:true` により捕捉される。

   **S7c で固定**

   ④projection された部分オブジェクトが CharacterEntity を騙るケースは、検証済み経路を
   `CharacterRepository.findByChannelId()` と `findByIdForOwner()` に限定する。
   `character.integration.spec.ts` が実 Mongo で、前者の repository projection と、後者を使う HTTP payload の
   許可キー集合・必須キー集合を検証する。`test:integration`（Docker 必須）だけで走り、
   `check:contract-stack` には含まれない。legacy 行で欠損を許す必須キーは、lean 経路で default 補完されない
   `status` と wire optional の `discordChannelId` だけに限定する。
   ⑤legacy 行の default 欠損は section を持たない代表ケースが HTTP 200 かつ欠損キーのままになることを固定済み。
   ⑥HTTP payload は次の二層で固定する。
   - **通常ゲート**: `character.controller.http.spec.ts` が代表 payload（service mock）の封筒・キー集合・値型・
     Date→ISO 直列化・ルート解決を検査する。
   - **Docker integration**: `character.integration.spec.ts` が実 CharacterService→実 repository→実 Mongo→
     実 interceptor を通した実 payload に同じ検査を行い、summary mapper の全要素と条件付き省略も検査する。
     このほか `apiClient` ジェネリクスの無検証アサーション層は、型を書き間違えても通る。
     封筒適用の解除（`@UseInterceptors` の削除等）は S5a2 で固定済み。

### CI とローカルゲートの役割分担

- `.github/workflows/verify.yml` の CI は、契約 package の build/test、server の build/typecheck・
  **全 Jest suite**・循環依存検査、`@trpg/sheet-engine` / `@trpg/sheet-projection` の test、
  front の typecheck/lint/test/build に加え、
  Docker を使う server integration test をブロッキングで実行する。
- ローカルの `pnpm run check:contract-stack` は、契約関連の変更を高速に確認するための focused gate。
  server 全 suite と Docker integration は CI が担う。
- `check:contract-stack` は server lint を含まない。CI の `lint-server` job は既存 error 6件が
  残る間は赤くなるため、**branch protection の required checks には含めない**。
  6件を解消したら required check へ昇格させる。

### 手順2: front で新しい wire 型を使いたいとき

1. `packages/api-contract/src/character/character.wire.ts` 等に型を追加し、`src/index.ts` から `export type` する。
   入れ子 wire 型を新設したら `character.wire.spec.ts` の AnyKeys 列にも足す。
2. `packages/api-contract/src/index.spec.ts` の**型シンボルリスト（現在33名）**に名前を追加する（追加しないとテストが落ちる。これは仕様）。
3. `trpg-remix-app/eslint.config.js` の `allowImportNames`（現在17名）に名前を追加する。
   追加しなければ front から import した瞬間に lint error になる。これも仕様。
4. front では必ず `import type { ... } from '@trpg/api-contract'` と書く。

### 禁止事項

- **front から zod スキーマ（`characterEntitySchema` 等・値15名）を import しない**。
  `z.date()` は Date インスタンスを、`.strict()` は実行時に存在する `_id` を拒否するため、
  ブラウザで `.parse()` すると**出荷後にしか出ない実行時事故**になる。
  root からの値 import は eslint allowlist が、deep import は eslint patterns と `package.json`
  の `exports` が防ぐ（役割分担）。これらを「通すため」に緩めないこと。
- **front から契約の「値」を import しない**（現在ゼロ）。値を import した瞬間に
  `trpg-remix-app/Dockerfile` の runtime ステージへの dist COPY が同時に必要になる（現在は入っていない）。
  型だけなら不要、という前提でイメージが組まれている。
- `@trpg/api-contract/dist/...` のような deep import をしない（`exports` が `.` のみ）。
- 封筒面で `response.data` を直接返さない。`response.data.data` が正しい。
  逆に非封筒面で `response.data.data` と書くと `undefined` になる。
- 旧 `postDomain` / `getDomain` / `createApiHandler` / `DomainDataMap` は存在しない。
  古いコード例やドキュメントを見つけたら履歴資料として扱うこと。

### 既知の穴（触るときに踏むもの）

- `app/features/discord/api/discord.service.ts` の `getDiscordServers()` は
  封筒面 `/users/discord/guilds` を素データとして読んでいたが、**修復済み（S6b）**
  （封筒深度は固定済み・payload 型は S5a で接続済み・server 側は S5a2 で機械固定済み）。
  `characterCard` の Discord サーバー選択が常に失敗する問題を解消。
- `app/utils/auth-guards.ts` は `/users` を無型で叩き、封筒オブジェクトをそのまま `user` として返す
  （`checkAuth`・現消費ゼロ）。
  この経路はスキーマ変更を永久に検出しない。
- `app/utils/corsApiWithJwt.ts` は任意エンドポイントを無型で叩く。
  現消費はモックルート1件だけで、戻り値は未使用。
- `CharacterRepository.findByName()` は projection が必須キー `gameSystemId` / `discordUserId` / `status` を
  欠く部分オブジェクトを `CharacterEntity` として返す未是正の実例。S7e で対応予定。
- `packages/` に lint 設定がなく、`@trpg/api-contract` は未 lint。build/test と消費側の型検査だけでは、
  契約 package 内の lint 違反を検出できない。
- `@trpg/sheet-engine`（6 suites）/ `@trpg/sheet-projection`（1 suite）の test は
  S8 round 2 で CI のブロッキングゲートへ追加済み。
- Prettier の整形チェックは CI・ローカルゲートのどこにもない。`eslint-config-prettier` が
  整形ルールを off にし、`eslint-plugin-prettier` は ESLint 設定へ未登録のため、lint でも検出しない。
- `TRPG-SERVER/Dockerfile` / `trpg-remix-app/Dockerfile` は CI で一度も build されず、
  キャンペーンで変更済みの Dockerfile もデプロイ時まで検証されない。
- server の `coverageThreshold` は通常の `pnpm test` に `--coverage` を渡していないため実効しない。
- root `packageManager` は `pnpm@10.12.1` のため、`minimumReleaseAge`（10.16+）と
  `blockExoticSubdeps` / `pmOnFail` / `registries`（11.0+）は実効化されていない。
  `onlyBuiltDependencies` / `strictDepBuilds` / `verifyDepsBeforeRun` は有効。別スライスで対応予定。
- Next.js 検討記録の「CI に `pnpm -r typecheck` を追加」は未実施。
  `packages/*` に `typecheck` script がなく、現状のままでは実行不能。
- CI 導入により全 suite、sheet package test、Docker integration は共有ゲートになった。一方、
  server lint は既存 error 6件の間は赤い optional check で、契約 package は未 lint のまま。

---

## 設定管理

### 環境変数

```typescript
// 主要な環境変数
NODE_ENV              # 実行環境
PORT                  # サーバーポート
DISCORD_SECRET        # Discord OAuth2シークレット
DISCORD_APPLICATIONID # Discord アプリケーションID
SERVER_DOMAIN         # バックエンドAPI URL
HOST_DOMAIN           # フロントエンドURL
```

### 設定の特徴

- 型安全な設定値アクセス
- 環境変数の自動バリデーション
- クライアント・サーバー両環境対応

## 開発・ビルド環境

### 1. **開発環境**

```bash
# 開発サーバー起動（Hot Reload対応）
pnpm run dev

# 型チェック
pnpm run typecheck

# リント・フォーマット
pnpm run lint
pnpm run format
```

### 2. **Vite設定の特徴**

- Hot Module Replacement（HMR）
- IPv4強制でDocker環境対応
- 依存関係の最適化
- ポーリングベースのファイル監視

### 3. **Docker対応**

- 開発環境でのコンテナ使用
- ファイル監視のポーリング設定
- ネットワーク設定の最適化

## テスト戦略

### テスト種別

- **単体テスト**: Jest使用（現在未実装）
- **コンポーネントテスト**: React Testing Library使用予定
- **E2Eテスト**: Playwright使用予定

### モック戦略

- APIクライアントのモック化
- 認証状態のモック化
- 外部サービスのモック化

## パフォーマンス最適化

### 1. **Remixの最適化機能**

- サーバーサイドレンダリング
- プリフェッチング
- 重複排除
- キャッシング

### 2. **バンドル最適化**

- Tree Shaking
- コード分割
- 依存関係の最適化

### 3. **画像・アセット最適化**

- 画像の遅延読み込み
- WebP対応
- CDN活用

## セキュリティ

### 1. **認証セキュリティ**

- JWT トークンの適切な管理
- HTTPS強制
- CSRFプロテクション

### 2. **XSS対策**

- サニタイゼーション
- Content Security Policy
- Trusted Types

### 3. **API セキュリティ**

- CORS設定
- レート制限
- 入力値バリデーション

## 今後の拡張性

### 1. **機能拡張**

- リアルタイム通信（WebSocket）
- プッシュ通知
- オフライン対応（PWA）

### 2. **技術的拡張**

- マイクロフロントエンド化
- GraphQL導入検討
- Edge Computing対応

### 3. **UI/UX改善**

- ダークモード完全対応
- アニメーション強化
- アクセシビリティ向上

---

## 🔧 **リファクタリング優先順位**

### **✅ 完了済み項目**

#### ✅ 1. **セキュリティリスクの修正** `[完了: 2025-07-02]`

```typescript
// ✅ COMPLETED: SSL証明書検証の適切な処理
// 本番環境: 証明書検証を有効化 (rejectUnauthorized: true)
// 開発環境: 証明書検証を無効化（従来通り）

// ✅ COMPLETED: eval()の完全削除
// eval('require')('https') → require('https') に変更
// 安全なloadHttpModules()関数を実装

// 修正内容:
const loadHttpModules = () => {
  if (typeof process !== 'undefined' && process.versions?.node && typeof require !== 'undefined') {
    try {
      return {
        https: require('https'),
        http: require('http')
      }
    } catch (error) {
      return null
    }
  }
  return null
}

// SSL証明書は本番環境で有効化
const agentOptions = {
  rejectUnauthorized: isDevelopment ? false : true, // 本番環境では証明書検証を有効化
  family: 4
}
```

#### ✅ 2. **非推奨ファイルの削除** `[完了: 2025-07-02]`

```bash
# ✅ 削除完了
- app/utils/axiosClient.ts  # 完全に削除済み
- 型定義の移行: TRPGUser → User (~/types)
```

#### ✅ 3. **プロダクション環境でのデバッグログ除去** `[完了: 2025-07-02]`

```typescript
// ✅ COMPLETED: 本番環境でのログ制御
// 開発環境のみログ出力、本番環境では機密情報保護

// 修正内容:
const isDevelopment = !configService.isProduction()

if (isDevelopment) {
  console.log('🔍 JWT Debug Info:', {
    jwtToken: jwtToken ? 'Present' : 'Not found' // トークン値は表示しない
    // その他のデバッグ情報
  })
}

// エラーは本番環境でも記録（ただし機密情報は除外）
console.error('❌ API Error:', {
  message: error.message,
  status: error.response?.status,
  statusText: error.response?.statusText,
  ...(isDevelopment && { data: error.response?.data })
})
```

### **🚨 最高優先度（即座に対応が必要）**

> **現在、最高優先度の項目はありません。**  
> 全てのセキュリティリスクが修正済みです。

### **🔥 高優先度（1週間以内）**

#### 4. **エラーハンドリングの統一**

```typescript
// ❌ 現在: 各所でバラバラなエラーハンドリング
export function CustomError(error: unknown | null | undefined): string {
  // 型安全性が不十分
}

// ✅ 統一されたエラーハンドリング
export class ErrorHandler {
  static handle(error: unknown, context: string): ErrorResponse {
    const message = this.extractMessage(error)

    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context}]`, error)
    }

    return {
      success: false,
      message: 'リクエストの処理中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    }
  }
}
```

#### 5. **API通信の改善**

```typescript
// ❌ 現在: 型安全性とエラーハンドリングの問題
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any = { ... }

// ✅ 型安全なAPI通信
interface ApiConfig {
  baseURL: string
  withCredentials: boolean
  headers: Record<string, string>
  httpsAgent?: any
  httpAgent?: any
}

const config: ApiConfig = { ... }
```

#### 6. **認証フローの改善**

```typescript
// ❌ 現在: 複雑で追跡困難な認証処理
// ✅ 改善案: 認証状態の明確な管理
export class AuthManager {
  static async validateToken(request: Request): Promise<AuthResult> {
    try {
      const jwt = this.extractJWT(request)
      if (!jwt) return { isValid: false, user: null }

      const user = await this.verifyToken(jwt)
      return { isValid: true, user }
    } catch (error) {
      return { isValid: false, user: null, error }
    }
  }
}
```

### **⚠️ 中優先度（1ヶ月以内）**

#### 7. **テストカバレッジの向上**

```bash
# ❌ 現在: 「# 未実装」
# ✅ 追加実装が必要
- 認証フローのE2Eテスト（Playwright）
- APIクライアントのユニットテスト
- コンポーネントテスト（React Testing Library）
- エラーハンドリングのテスト
```

#### 8. **Remixローダー・アクションの最適化**

```typescript
// ❌ 現在: エラーハンドリングが不十分
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await apiClient.get('/users', withJwt(jwt))
    return response.data
  } catch (error) {
    // 不十分なエラーハンドリング
  }
}

// ✅ 改善案
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const authResult = await AuthManager.validateToken(request)
    if (!authResult.isValid) {
      return { user: null, isLoggedIn: false }
    }

    const response = await apiClient.get('/users', withJwt(authResult.token))
    return { user: response.data, isLoggedIn: true }
  } catch (error) {
    return ErrorHandler.handle(error, 'user-loader')
  }
}
```

#### 9. **状態管理の改善**

```typescript
// ❌ 現在: テスト用のスライスが残存
// store/counterSlice.ts, store/testSlice.ts

// ✅ 本格的な状態管理の実装
- 認証状態の管理
- キャラクター一覧の状態管理
- UIステート（モーダル、ローディング）の管理
```

### **📋 長期改善項目（3ヶ月以内）**

#### 10. **パフォーマンス最適化**

```typescript
// ❌ 潜在的なパフォーマンス問題
;(-不要な再レンダリング -
  大きなバンドルサイズ -
  画像の最適化不足 -
  // ✅ 最適化項目
  React.memo,
  useMemo,
  useCallbackの適切な使用 - コード分割の実装 - 画像の遅延読み込み・WebP対応)
```

#### 11. **アクセシビリティの向上**

```typescript
// ❌ 現在: 基本的なアクセシビリティ対応のみ
// ✅ 改善項目
;-キーボードナビゲーションの完全対応 - スクリーンリーダーサポート - カラーコントラストの検証 - ARIA属性の充実
```

#### 12. **TypeScript設定の強化**

```json
// ❌ 現在: 一部緩い設定
{
  "strict": true,
  "skipLibCheck": true  // セキュリティリスク
}

// ✅ より厳密な設定
{
  "strict": true,
  "skipLibCheck": false,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true
}
```

### **🎯 修正実装方針**

#### **段階的実装アプローチ**

1. **Phase 1**: セキュリティリスクの即座修正
2. **Phase 2**: エラーハンドリング・API通信の改善
3. **Phase 3**: テスト・パフォーマンスの向上
4. **Phase 4**: 長期的なアーキテクチャ改善

#### **リスク管理**

- 各修正は十分なテストを実施
- ユーザーエクスペリエンスへの影響を最小化
- 段階的なデプロイメント

#### **成果指標**

- セキュリティスキャンの結果改善
- エラー率の削減
- パフォーマンススコアの向上
- テストカバレッジの増加

---

## 開発ガイドライン

### アーキテクチャ概念

参考文献: https://github.com/alan2207/bulletproof-react
Remix公式: https://remix.run

### CSSライブラリ

- **メインライブラリ**: Mantine
- **テーマカスタマイズ**: `theme.ts`で調整可能
- **共通コンポーネント**: `app/components/Elements`に配置

### テーマ・デザインシステム

- **テーマ文書**: `THEME.md` - 完全なデザインガイドライン
- **配色システム**: ベース70%、メイン25%、アクセント5%の配分
- **タイポグラフィ**: Noto Sans JP + Mantineデフォルトフォント
- **余白ルール**: 8px単位システム（4px, 8px, 16px, 24px, 32px, 48px）
- **UIコンポーネント**: ボタン、フォーム、アイコンの統一仕様
- **アクセシビリティ**: WCAG AA準拠、ダークテーマ最適化

### 型定義規則

- **基本方針**: `/features/**/types`に機能別で記載
- **共通型**: `/types`配下で管理
- **API型**: サーバーと共通化を検討

### よく使用するコマンド

```bash
# 開発サーバー起動
pnpm run dev

# テスト実行
# 未実装
pnpm run test
pnpm run test:watch
pnpm run test:coverage

# ビルド
pnpm run build

# 本番サーバー起動
pnpm run start

# 型チェック
pnpm run typecheck

# リント・フォーマット
pnpm run lint
pnpm run format
```

### 重要なポイント

1. **フィーチャードリブン**: 機能別でモジュール分離
2. **型安全性**: TypeScriptの恩恵を最大限活用
3. **SSR活用**: Remixの特徴を生かしたパフォーマンス最適化
4. **コンポーネント設計**: 再利用性とメンテナンス性を重視
5. **状態管理**: 必要最小限で効率的な状態管理
6. **アクセシビリティ**: ユーザビリティを常に考慮

このアーキテクチャにより、TRPG-Remix-Appは拡張性、保守性、パフォーマンスを兼ね備えたモダンなWebアプリケーションとして構築されています。

## セキュリティ要件

### Discord OAuth トークン管理

- **アクセストークン保存**: UserModelにDiscordアクセストークンを暗号化して保存
- **リフレッシュトークン管理**: 自動トークン更新機能の実装
- **有効期限管理**: トークンの有効期限チェックと自動更新
- **暗号化**: データベース保存時の暗号化必須
- **アクセス制御**: トークンへのアクセスを最小限に制限

### セキュリティ対策

1. **暗号化保存**: アクセストークンとリフレッシュトークンの暗号化
2. **有効期限チェック**: API呼び出し前の有効期限確認
3. **自動更新**: リフレッシュトークンによる自動更新機能
4. **ログ制御**: トークン情報のログ出力を禁止
5. **アクセス制御**: 必要最小限のスコープでのみトークン使用

### 実装方針

- UserModelにDiscordトークン関連フィールドを追加
- AuthServiceにトークン管理機能を追加
- トークンの暗号化・復号化ユーティリティを実装
- 自動トークン更新機能を実装

## Discord OAuth 認証フロー

### 認証シーケンス

1. **フロントエンド**: Discord OAuth URLへリダイレクト
2. **Discord**: ユーザー認証後、認証コードを返却
3. **TRPG-SERVER**: 認証コードでアクセストークン・リフレッシュトークンを取得
4. **TRPG-SERVER**: トークンを暗号化してUserModelに保存
5. **フロントエンド**: JWTトークンをクッキーに保存

### セキュリティ実装詳細

#### 1. トークン管理アーキテクチャ

```
フロントエンド (JWT) ←→ TRPG-SERVER ←→ Discord API
                                ↓
                            暗号化されたトークン
                                ↓
                             MongoDB
```

#### 2. トークンライフサイクル

- **認証時**: Discord認証完了後、サーバー側でトークンを暗号化保存
- **API使用時**: サーバー側で自動的にトークン有効性をチェック
- **期限切れ時**: リフレッシュトークンで自動更新
- **エラー時**: 再認証をフロントエンドに要求

#### 3. フロントエンド実装のポイント

##### 認証状態管理

```typescript
// useAuth.ts での認証状態管理例
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null
  })

  // JWT検証とユーザー情報取得
  const validateAuth = async () => {
    try {
      const response = await apiClient.get('/auth/validate-token')
      // 認証成功時の処理
    } catch (error) {
      // 認証失敗時は再ログインを促す
      redirectToLogin()
    }
  }
}
```

##### Discord API連携

```typescript
// Discord Guild一覧取得（サーバー側で自動トークン管理）
const getDiscordGuilds = async (userId: string) => {
  try {
    const response = await apiClient.get(`/auth/guilds/${userId}`, withJwt())
    return response.data.guilds
  } catch (error) {
    // トークン期限切れの場合、サーバー側で自動更新されるか
    // 再認証が必要な場合はエラーが返される
    handleAuthError(error)
  }
}
```

#### 4. エラーハンドリング戦略

##### 認証エラーの分類

1. **JWTエラー**: フロントエンド側のJWTトークンが無効
2. **Discordトークンエラー**: サーバー側のDiscordトークンが無効
3. **ネットワークエラー**: 通信エラー

##### エラー処理フロー

```typescript
const handleAuthError = (error: ApiError) => {
  if (error.status === 401) {
    // 認証エラー: ログイン画面にリダイレクト
    clearAuth()
    redirectToLogin()
  } else if (error.status === 403) {
    // 権限エラー: 適切なエラーメッセージを表示
    showError('アクセス権限がありません')
  } else {
    // その他のエラー: 一般的なエラー処理
    showError('処理中にエラーが発生しました')
  }
}
```

### Discord連携機能

#### 1. 利用可能なDiscord API機能

- **ユーザー情報取得**: プロフィール・アバター情報
- **Guild一覧取得**: ユーザーが参加しているDiscordサーバー
- **権限確認**: 特定のGuildでの権限レベル
- **チャンネル情報**: アクセス可能なチャンネル一覧

#### 2. フロントエンド側の実装例

##### Discord Guild表示コンポーネント

```typescript
const DiscordGuildList: React.FC = () => {
    const [guilds, setGuilds] = useState<DiscordGuild[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    useEffect(() => {
        const fetchGuilds = async () => {
            if (!user?.discordUserId) return

            try {
                const guildList = await getDiscordGuilds(user.discordUserId)
                setGuilds(guildList)
            } catch (error) {
                console.error('Discord Guild取得エラー:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchGuilds()
    }, [user])

    if (loading) return <Loader />

    return (
        <div>
            <h3>参加中のDiscordサーバー</h3>
            {guilds.map(guild => (
                <GuildCard key={guild.id} guild={guild} />
            ))}
        </div>
    )
}
```

#### 3. セキュリティ考慮事項

##### フロントエンド側のセキュリティ対策

1. **JWTの適切な管理**: セキュアクッキーでの保存
2. **CSRF対策**: SameSite属性の適切な設定
3. **XSS対策**: DOMPurifyによるサニタイゼーション
4. **機密情報の保護**: Discordトークンはフロントエンドに送信しない

##### 通信セキュリティ

1. **HTTPS必須**: 本番環境では必ずHTTPS通信
2. **CORS設定**: 適切なOrigin制限
3. **リクエストヘッダー**: AuthorizationヘッダーでのJWT送信

### API連携パターン

#### 1. 認証が必要なAPIの呼び出し

```typescript
// withJwt()ヘルパー関数でJWTを自動付与
const apiCallWithAuth = async (endpoint: string, options = {}) => {
  return await apiClient.get(endpoint, {
    ...options,
    ...withJwt() // Authorization ヘッダーを自動付与
  })
}
```

#### 2. 自動リトライ機能

```typescript
// トークン期限切れ時の自動リトライ
const apiClientWithRetry = axios.create({
  // ... 基本設定
})

apiClientWithRetry.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true

      // 認証情報を再取得してリトライ
      try {
        await refreshAuth()
        return apiClientWithRetry.request(error.config)
      } catch (refreshError) {
        // 再認証に失敗した場合はログイン画面へ
        redirectToLogin()
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)
```

### 今後の拡張計画

#### 1. Discord Bot連携強化

- **リアルタイム通知**: Discord Botからの通知をWebアプリに表示
- **チャンネル連携**: 特定のDiscordチャンネルとの双方向連携
- **ロール管理**: Discordのロールベースアクセス制御

#### 2. セキュリティ強化

- **二要素認証**: Discord + 追加認証の実装
- **セッション管理**: 複数デバイス対応のセッション管理
- **監査ログ**: ユーザーアクションの詳細ログ

#### 3. ユーザビリティ向上

- **オフライン対応**: PWA機能でのオフライン使用
- **通知機能**: ブラウザ通知とDiscord通知の統合
- **設定同期**: Discord設定との自動同期

### 開発・デバッグガイド

#### 1. 認証フローのデバッグ

```typescript
// 開発環境でのデバッグ用ログ
if (process.env.NODE_ENV === 'development') {
  console.log('認証状態:', authState)
  console.log('JWT検証結果:', jwtValidation)
  console.log('Discord API レスポンス:', discordResponse)
}
```

#### 2. エラー監視

- **Sentry**: エラー監視とアラート
- **ログ集約**: 認証関連エラーの集約と分析
- **パフォーマンス監視**: API応答時間の監視

#### 3. テスト戦略

- **ユニットテスト**: 認証ロジックのテスト
- **統合テスト**: Discord API連携のテスト
- **E2Eテスト**: 認証フロー全体のテスト

---

## 🔧 **最新の修正履歴**

### **✅ 完了済み項目**

#### ✅ 5. **統合型定義システムの実装** `[完了: 2025-01-27]`

> ※履歴資料（S6a で撤去済み）

```typescript
// ✅ COMPLETED: api-client.tsとapi-response.util.tsの統合型定義システム
// 問題: response.data.dataのような型安全性のないAPIレスポンス処理
// 解決: 完全に型安全な統合型定義システムを実装

// 修正前（型安全性なし）:
const response = await apiClient.post('/auth/login', { code })
const authData = response.data.auth // 型エラーの可能性

// 修正後（完全型安全）:
const response = await apiClient.postDomain('/auth/login', 'auth', { code })
const authData = authHandler.handleSuccess(response) // 型推論が効く
```

**実装内容**:

1. **中央集権的な型定義** (`app/types/api.ts`)
   - `KnownDomains`: 型安全なドメイン定義
   - `DomainDataMap`: ドメインとデータ型のマッピング
   - `ApiResponse<T, Domain>`: 統合レスポンス型

2. **型安全なAPIクライアント** (`app/lib/api-client.ts`)
   - `getDomain/postDomain/putDomain/deleteDomain`: 新しい型安全メソッド
   - 既存メソッドとの後方互換性を維持

3. **統合レスポンスユーティリティ** (`app/lib/api-response.util.ts`)
   - 新しい型定義と完全に連携
   - `createApiHandler<Domain>`: 型安全なハンドラー生成

**型安全性の恩恵**:

```typescript
// 型ガードによる安全なアクセス
const userInfo = await loginOrRegisterUser(code)

if (userInfo.success) {
  // TypeScriptが自動的にuserInfo.authの存在を保証
  console.log(userInfo.auth.userName) // 型安全
} else {
  // TypeScriptが自動的にuserInfo.messageの存在を保証
  console.error(userInfo.message) // 型安全
}
```

**影響**:

- `response.data.data`問題の完全解消
- コンパイル時エラー検出の向上
- IntelliSenseによる自動補完の改善
- ドメイン名のtypo防止
- `as any`キャストの不要化

**テスト結果**:

```bash
Type Check: ✅ 通過
Build: ✅ 成功（jsx-runtime問題は型定義とは無関係）
```

#### ✅ 4. **Node.js crypto非推奨警告の修正** `[完了: 2025-01-27]`

```typescript
// ✅ COMPLETED: crypto.createCipher/createDecipherの非推奨警告を修正
// 問題: Node.js 17以降でcrypto.createCipherとcrypto.createDecipherが非推奨
// 解決: createCipheriv/createDecipherivに置き換え

// 修正前（非推奨）:
const cipher = crypto.createCipher(this.ALGORITHM, key)
const decipher = crypto.createDecipher(this.ALGORITHM, key)

// 修正後（推奨）:
const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv)
const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv)
```

**修正内容**:

- `TRPG-SERVER/src/utils/crypto.util.ts`の暗号化処理を修正
- `aes-256-gcm`アルゴリズムで適切な`createCipheriv`/`createDecipheriv`を使用
- IV（初期化ベクトル）を明示的に指定
- テストファイル`crypto.util.spec.ts`を追加して動作確認

**影響**:

- Node.js非推奨警告の解消
- セキュリティの向上（適切な暗号化処理）
- 将来のNode.jsバージョンでの互換性確保

**テスト結果**:

```bash
Test Suites: 1 passed, 1 total
Tests:       13 passed, 13 total
```

---

## 📌 フレームワーク移行検討記録

### Next.js 移行検討 `[検討: 2026-07-26 / 結論: 保留]`

**実測スコープ**: app/ 10,713行・実質12ルート（mock系約9は除外可）・loader/action 22箇所。セッションAPI・defer・clientLoader は未使用、JWT は cookie ヘッダー手動パースのため移行難所は少ない。フロントのテストは spec 1本のみ（挙動固定の安全網なし）。

**見積もり（Claude 実施前提）**:

- 最新化込み（Next 15/16 + React 19 + Mantine 7.17+/8）: 4〜6 作業セッション
- 据え置き（React 18 のまま）: 3〜5 セッション。ただし App Router + React 18 は Next 14 系（保守モード）に縛られる
- 代替案: React Router v7 への移行なら 0.5〜1 セッション（import 差し替え中心・資産温存）

**移行目的（確定済み）**: Discord 連携強化ロードマップ
① Discord Activity（iframe 内 SPA・別パッケージ想定・token 認証）
② TRPG シナリオの執筆・公開機能（公開ページ＝OGP/ISR で Next が有利）
③ シナリオ画像のワンボタン Discord 共有（OGP リンク展開＋TRPG-SERVER bot 投稿の併用）

**判断**: 公開ページ構想により Next 移行の技術的正当性は成立するが、現時点では**保留**。

**再開トリガー**: シナリオ公開機能の実装着手前が決断ポイント（Remix 上に作ると移行対象が膨らみ、今の見積もりが無効になる）。

**保留中の設計ガード（移行コストを増やさないため）**:

- Remix 固有 API（useLoaderData 等）は route 層で受け、feature コンポーネントへは props で渡す（現構造を維持）
- 共有ロジックは `@trpg/sheet-engine` 方式で workspace パッケージへ寄せる
- UI コンポーネントは client-portable に保つ（将来の Activity SPA から再利用するため）

### 追記: NestJS↔フロント型共有体制のレビュー `[判定: 2026-07-26]`

cognitive-load-review（モード B）で方式比較を実施。結論:

- **Go（縮小付き）**: `@trpg/api-contract` workspace パッケージ新設。手書き TS 型を単一ソース化し、character / sheet-template 系は既存 `*.zod.ts` スキーマを契約側へ移設して `z.infer` で型供給。server DTO は `implements` / zod 由来で契約に固定。CI に `pnpm -r typecheck` を追加
- **No-Go（trigger 付き）**: OpenAPI 生成（消費者がフロント1つの現状では生成パイプラインの負荷を回収できない。外部消費者・多言語クライアント出現で再評価）、tRPC / ts-rest（REST 全面再構築で NestJS idiom と衝突）
- 実測根拠: server dto 16回/6ヶ月変更に対し front app/types 追従 **0回**・`DomainDataMap` は 3/4 ドメインが `any`（型検査が空洞化）
- **実施タイミングは Next 移行後ではなく移行前**（フレームワーク中立で捨て作業ゼロ・移行時の全 fetch 書き換えに対する唯一のコンパイル時安全網・工数 1〜2 セッション）
