# Isolated MongoDB Test Setup

このフォルダは **いつでも削除できる** MongoDBコンテナ用の独立設定です。E2Eの既存Testcontainers設定と、Character統合testのDocker CLI設定が同居する。

## 目的

- ローカル/CI で使い捨て MongoDB コンテナを自動起動する
- 既存の `test:e2e` を壊さず、別コマンドで切り替える

## 実行コマンド

- `pnpm test:e2e:tc`
- `pnpm test:integration`（Character 2本 + backfill 1本の実DB統合spec）

通常の `pnpm test` は実DB統合specを収集しない。`test:integration` はDocker CLIで毎回使い捨てMongoDBを起動し、hostの `.env` にある `MONGODB_URI` を使用しない。

## 構成

- `global-setup.ts`
  - Docker CLIでMongoDBコンテナを起動し、`mongosh ping`成功まで待機
  - lock/stateが残る並行実行・異常終了を黙って上書きせず失敗
  - 接続情報を `.runtime-state.json` に保存
- `setup-test-env.ts`
  - 既存 `setupTestEnvironment()` を呼ぶ
  - `.runtime-state.json` から `MONGODB_URI` を上書き
- `global-teardown.ts`
  - 起動した MongoDB コンテナを停止・削除
  - `.runtime-state.json` を削除
  - Docker操作に失敗した場合はstateを残してテスト失敗として可視化
- `runtime-state.ts`
  - ランタイム状態ファイルのパス定義

## 削除手順

1. `test/testcontainers/` フォルダを削除
2. `package.json` から `test:e2e:tc` を削除
3. `test/jest-e2e.testcontainers.json` と `jest.integration.config.js` を削除
4. E2Eでも不要なら `devDependencies` から `testcontainers` を削除

これで元の構成に戻せます。
