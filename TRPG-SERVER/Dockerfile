# マルチステージビルド: 開発・本番両対応
FROM node:22-alpine AS base

# 必要なパッケージをインストール
RUN apk add --no-cache wget curl

# pnpmをグローバルにインストール
RUN npm install -g pnpm@10.12.1

# workspace root を作業ディレクトリにする
WORKDIR /usr/src/app

# パッケージ定義ファイルをコピー（依存関係キャッシュのため先にコピー）
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY TRPG-SERVER/package.json ./TRPG-SERVER/package.json
COPY trpg-remix-app/package.json ./trpg-remix-app/package.json
COPY packages/sheet-engine/package.json ./packages/sheet-engine/package.json

# 開発ステージ
FROM base AS development
# 開発用の依存関係をインストール
RUN pnpm install --frozen-lockfile --filter trpg-server... --filter @trpg/sheet-engine...

# アプリケーションコードをコピー
COPY . .

# ポートをExpose
EXPOSE 3000

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# engine をビルドしてから開発モードで起動
CMD ["sh", "-c", "pnpm --filter @trpg/sheet-engine build && pnpm --filter trpg-server run start:dev"]

# 本番ビルドステージ
FROM base AS build
# 全ての依存関係をインストール
RUN pnpm install --frozen-lockfile --filter trpg-server... --filter @trpg/sheet-engine...

# アプリケーションコードをコピー
COPY . .

# TypeScriptをビルド
RUN pnpm --filter @trpg/sheet-engine build && pnpm --filter trpg-server run build

# 本番ステージ
FROM base AS production
# 本番用依存関係のみインストール
RUN pnpm install --frozen-lockfile --prod --filter trpg-server... --filter @trpg/sheet-engine...

# ビルド済みアプリケーションをコピー
COPY --from=build /usr/src/app/TRPG-SERVER/dist ./TRPG-SERVER/dist
COPY --from=build /usr/src/app/packages/sheet-engine/dist ./packages/sheet-engine/dist

# ポートをExpose
EXPOSE 3000

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 本番モードで起動
CMD ["pnpm", "--filter", "trpg-server", "run", "start:prod"]
