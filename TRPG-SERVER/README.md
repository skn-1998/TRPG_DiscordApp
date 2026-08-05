# TRPG-SERVER

Discord 連携の TRPG（テーブルトーク RPG）支援サーバー。
キャラクターシート管理・ダイスロール・チャンネル連携などを Discord 上から操作できるバックエンドアプリケーションです。

- **フレームワーク**: NestJS 10 (TypeScript)
- **データベース**: MongoDB (Mongoose ODM)
- **Discord 連携**: discord.js 14
- **ダイス**: BCDice
- **設計**: イベント駆動アーキテクチャ（`@nestjs/event-emitter`）+ ドメイン分割

> package.json の `name`: `trpg-server` / `description`: `TRPG Server Application`

## Quick Start

```bash
# 1. 依存関係のインストール
pnpm install

# 2. 環境変数の設定
#    .env を用意します。必要な変数と設定の詳細は src/config/README.md を参照してください。

# 3. 開発サーバー起動（watch モード）
pnpm start:dev
```

環境変数（Discord トークン、MongoDB 接続、フロントエンド URL など）のセットアップ詳細は
[`src/config/README.md`](./src/config/README.md) を参照してください。

## スクリプト一覧

package.json に定義されている主要スクリプトです。パッケージマネージャは **pnpm** を使用します。

### 起動・ビルド

| コマンド           | 説明                                                          |
| ------------------ | ------------------------------------------------------------- |
| `pnpm build`       | `nest build` で本番ビルド（事前に `prebuild` で dist を削除） |
| `pnpm start`       | アプリ起動                                                    |
| `pnpm start:dev`   | watch モードで起動（開発用）                                  |
| `pnpm start:debug` | debug + watch モードで起動                                    |
| `pnpm start:prod`  | `node dist/main` でビルド済みアプリを起動                     |
| `pnpm clean`       | dist / eslint キャッシュ / tsbuildinfo を削除                 |
| `pnpm clean:build` | clean してから build                                          |

### テスト

| コマンド              | 説明                                                        |
| --------------------- | ----------------------------------------------------------- |
| `pnpm test`           | Jest でユニットテストを実行                                 |
| `pnpm test:watch`     | watch モードでユニットテスト                                |
| `pnpm test:cov`       | カバレッジ付きでユニットテスト                              |
| `pnpm typecheck:test` | テストコードとテスト補助コードをTypeScriptで型検査          |
| `pnpm test:e2e`       | E2E テスト（`NODE_ENV=test`、要 MongoDB 接続）              |
| `pnpm test:e2e:tc`    | Testcontainers で MongoDB コンテナを自動起動して E2E テスト |

`pnpm test:e2e:tc` は使い捨ての MongoDB コンテナを起動して E2E を実行します。
詳細は [`test/testcontainers/README.md`](./test/testcontainers/README.md) を参照してください。

### 品質・依存関係

| コマンド              | 説明                                                                            |
| --------------------- | ------------------------------------------------------------------------------- |
| `pnpm lint`           | `lint:check` の別名。ファイルを変更せずESLintを実行                             |
| `pnpm lint:check`     | 設定済み除外を適用し、ファイルを変更せずESLintを実行                            |
| `pnpm lint:fix`       | ESLintの自動修正を明示的に実行                                                  |
| `pnpm format`         | Prettier による整形                                                             |
| `pnpm check:circular` | 循環依存チェック（`madge --circular`）。「No circular dependency found!」が正常 |
| `pnpm check:deps`     | 依存グラフを SVG 出力                                                           |
| `pnpm analyze:deps`   | 依存関係を警告付きで解析                                                        |

## ドキュメント案内

設計・進捗の正本はリポジトリ内の Markdown に集約されています。

- [`AI.md`](./AI.md) — プロジェクト概要と各設計ドキュメントへの索引（**まずここを参照**）
- [`src/ARCHITECTURE.md`](./src/ARCHITECTURE.md) — アーキテクチャ設計の正本（module 境界・依存ルール）
- [`AI.refactor.md`](./AI.refactor.md) — リファクタリングの Phase 進捗
- [`src/discord/DESIGN.md`](./src/discord/DESIGN.md) — Discord 連携機能の設計
- [`src/config/README.md`](./src/config/README.md) — 環境変数とコンフィグのセットアップ
- [`test/testcontainers/README.md`](./test/testcontainers/README.md) — Testcontainers ベースの E2E テスト

`AI.*.md` は機能別の詳細設計（例: `AI.domain.md` / `AI.test.md` / `AI.discord.md` など）を扱います。
作業前に `AI.md` の索引から該当ドキュメントを辿ってください。

## 開発上の注意

- `pnpm build` の後は `pnpm start:dev` や `pnpm check:circular` で依存関係を検証すること。
- 循環依存はゼロを維持（`check:circular` が「No circular dependency found!」であること）。
