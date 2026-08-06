# @trpg/static-analysis

ts-morph 製の静的解析 CLI 3本。依存関係・関数の独立性・同型ロジックの重複を実測して JSON で出す。

## 使い方の正本はここではない

**[`.claude/skills/static-structure-audit/SKILL.md`](../../.claude/skills/static-structure-audit/SKILL.md)**
が正本。コマンドの使い分け・レポートの読み方・**実測済みの誤検出パターン**・レシピはすべてそちらにある。
この README は実装者向けの情報だけを置く。

## コマンド

**リポジトリルートを cwd にして実行する**（レポート内のパスと `--out` のガードが cwd 基準のため）。

```bash
pnpm run static:deps         -- --project <tsconfig.json>
pnpm run static:independence -- --project <tsconfig.json>
pnpm run static:duplication  -- --project <tsconfig.json>
```

`--project` を差し替えれば、モノレポのどのパッケージでも解析できる
（`TRPG-SERVER/tsconfig.json` / `trpg-next-app/tsconfig.json` / `packages/*/tsconfig.json`）。

## 構成

| ファイル | 役割 |
|---|---|
| `run.js` | ts-node を登録して `src/analyze-<name>.ts` を起動する。ルートに ts-node が無く、`pnpm --filter` 経由では cwd が動いてレポートのパス表記が壊れるため、この形にしている |
| `src/shared/cli.ts` | 共通引数のパース。ツール固有引数は `rest` で返し、消費後の残りは `rejectUnknownArgs` で throw する |
| `src/shared/project.ts` | tsconfig からの `Project` 生成・解析対象の絞り込み・モジュール解決（型チェッカを使わない `ts.resolveModuleName` 経路） |
| `src/shared/report.ts` | レポートヘッダの生成と JSON 出力（`.tmp/` ガード込み） |
| `src/shared/function-like.ts` | 関数様ノードの型・述語・命名。**3ツール共通** |
| `src/analyze-dependencies.ts` | ファイル/シンボル単位の依存と死蔵 export |
| `src/analyze-independence.ts` | 関数ごとの外部依存の実測と pure 判定 |
| `src/analyze-duplication.ts` | AST 構造ハッシュによる同型関数の検出 |

## 4本目の解析を足すとき

1. `src/analyze-<name>.ts` を作る（既存の1本を手本にする）
2. `run.js` の解析名リストに追加する
3. ルート `package.json` に `static:<name>` スクリプトを追加する
4. Skill にレポートの読み方を追記する（**忘れると使われない**）

関数様ノードを扱うなら **`shared/function-like.ts` を使い、独自に定義し直さないこと**。
型・述語・命名が3実装に分かれてドリフトした実害がある（`symbolName` が2ツールで39件中31件不一致、
別ツールでは修正済みの改行混入バグが44件残存）。2026-08-03 の大粒度認知負荷レビューで検出し、
ここへ1本化した。

## 設計上の約束

- **advisory** — 閾値超過で exit code を落とさない。非ゼロで終わるのは解析自体が失敗したときだけ。
  CI ゲートにはしていない
- **決定的** — 同じ入力なら出力はバイト一致する。`generatedAt` は既定 `null`
  （差分比較を壊さないため。必要なときだけ `--include-generated-at`）
- **`--out` は cwd 配下の `.tmp/` 限定** — 外へ書こうとすると throw する
- パスは cwd 相対・区切りは `/` に正規化
- 判定はすべてヒューリスティック。**「〜すべき」を出力しない**。候補を出すところまでが役目

## 関連ツール（重複させないこと）

| 担当 | ツール |
|---|---|
| ファイル間の循環依存 | `pnpm --filter trpg-server run check:circular`（madge） |
| ファイル/関数のサイズ | `pnpm --filter trpg-server run refactor:large-files:analyze` |

この2つはここでは扱わない。`analyze-large-files.ts` とは CLI 規約（`.tmp/` ガード・除外セグメント・
決定的な並び順）を共有しているが、パス基準が異なる（あちらは cwd=TRPG-SERVER 前提）ため統合していない。
