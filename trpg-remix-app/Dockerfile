# マルチステージビルド: 開発・本番両対応
FROM node:22-alpine AS base

# 必要なパッケージをインストール
RUN apk add --no-cache wget curl

# pnpmをグローバルにインストール
RUN npm install -g pnpm@11.5.1

# workspace root を作業ディレクトリにする
WORKDIR /usr/src/app

# manifest COPY は lockfile の全 importer に必要（frozen-lockfile 検証のため）。
# install filter / build / dist COPY は実際に消費するパッケージのみ。
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY TRPG-SERVER/package.json ./TRPG-SERVER/package.json
COPY trpg-remix-app/package.json ./trpg-remix-app/package.json
COPY packages/sheet-engine/package.json ./packages/sheet-engine/package.json
COPY packages/sheet-projection/package.json ./packages/sheet-projection/package.json
COPY packages/api-contract/package.json ./packages/api-contract/package.json

# 開発ステージ
FROM base AS development
# 開発用の依存関係をインストール
RUN pnpm install --frozen-lockfile --filter trpg-remix-app...

# アプリケーションコードをコピー
COPY . .

# スタートアップスクリプトを作成
RUN echo '#!/bin/sh' > /start-remix.sh && \
    echo 'echo "=== Remix 開発環境起動開始 ==="' >> /start-remix.sh && \
    echo '' >> /start-remix.sh && \
    echo '# node_modulesが空の場合のみインストール' >> /start-remix.sh && \
    echo 'if [ ! -d "trpg-remix-app/node_modules/@remix-run" ] || [ ! -d "packages/sheet-engine/node_modules/zod" ]; then' >> /start-remix.sh && \
    echo '  echo "依存関係をインストール中..."' >> /start-remix.sh && \
    echo '  pnpm install --frozen-lockfile --filter trpg-remix-app...' >> /start-remix.sh && \
    echo 'else' >> /start-remix.sh && \
    echo '  echo "依存関係は既にインストール済みです"' >> /start-remix.sh && \
    echo 'fi' >> /start-remix.sh && \
    echo '' >> /start-remix.sh && \
    echo 'echo "Sheet engine をビルド中..."' >> /start-remix.sh && \
    echo 'pnpm --filter "trpg-remix-app^..." build' >> /start-remix.sh && \
    echo '' >> /start-remix.sh && \
    echo '# Viteキャッシュをクリア' >> /start-remix.sh && \
    echo 'echo "Viteキャッシュをクリア中..."' >> /start-remix.sh && \
    echo 'rm -rf trpg-remix-app/node_modules/.vite' >> /start-remix.sh && \
    echo '' >> /start-remix.sh && \
    echo 'echo "=== Remix アプリケーション起動 ==="' >> /start-remix.sh && \
    echo 'exec pnpm --filter trpg-remix-app run dev -- --host' >> /start-remix.sh && \
    chmod +x /start-remix.sh

# ポートをExpose
EXPOSE 5173

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173/ || exit 1

# 開発モードで起動（スタートアップスクリプト使用）
CMD ["/start-remix.sh"]

# 本番ビルドステージ
FROM base AS build
# 全ての依存関係をインストール
RUN pnpm install --frozen-lockfile --filter trpg-remix-app...

# アプリケーションコードをコピー
COPY . .

# 本番用ビルド
RUN pnpm --filter @trpg/sheet-engine build && pnpm --filter trpg-remix-app run build

# 本番ステージ
FROM base AS production
# 本番用依存関係のみインストール
RUN pnpm install --frozen-lockfile --prod --filter trpg-remix-app...

# ビルド済みアプリケーションをコピー
COPY --from=build /usr/src/app/trpg-remix-app/build ./trpg-remix-app/build
COPY --from=build /usr/src/app/packages/sheet-engine/dist ./packages/sheet-engine/dist

# ポートをExpose
EXPOSE 3000

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 本番モードで起動
CMD ["pnpm", "--filter", "trpg-remix-app", "run", "start"]
