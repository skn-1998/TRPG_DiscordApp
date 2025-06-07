# マルチステージビルド: 開発・本番両対応
FROM node:22-alpine AS base

# 必要なパッケージをインストール
RUN apk add --no-cache wget curl

# pnpmをグローバルにインストール
RUN npm install -g pnpm@latest

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# パッケージ定義ファイルをコピー（依存関係キャッシュのため先にコピー）
COPY package.json pnpm-lock.yaml ./

# 開発ステージ
FROM base AS development
# 開発用の依存関係をインストール
RUN pnpm install --frozen-lockfile

# アプリケーションコードをコピー
COPY . .

# ポートをExpose
EXPOSE 3000

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 開発モードで起動
CMD ["pnpm", "run", "start:dev"]

# 本番ビルドステージ
FROM base AS build
# 全ての依存関係をインストール
RUN pnpm install --frozen-lockfile

# アプリケーションコードをコピー
COPY . .

# TypeScriptをビルド
RUN pnpm run build

# 本番ステージ
FROM base AS production
# 本番用依存関係のみインストール
RUN pnpm install --frozen-lockfile --prod

# ビルド済みアプリケーションをコピー
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json ./

# ポートをExpose
EXPOSE 3000

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 本番モードで起動
CMD ["pnpm", "run", "start:prod"]
