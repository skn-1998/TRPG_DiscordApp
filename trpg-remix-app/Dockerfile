# マルチステージビルド: 開発・本番両対応
FROM node:22-alpine AS base

# 必要なパッケージをインストール
RUN apk add --no-cache wget curl

# pnpmのバージョンを固定してインストール
ARG PNPM_VERSION=11.5.1
RUN npm install --global "pnpm@${PNPM_VERSION}"

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# パッケージ定義ファイルをコピー（依存関係キャッシュのため先にコピー）
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 開発ステージ
FROM base AS development
# 開発用の依存関係をインストール
RUN pnpm install --frozen-lockfile

# アプリケーションコードをコピー
COPY . .

# スタートアップスクリプトを作成
RUN echo '#!/bin/sh' > /start-remix.sh && \
    echo 'echo "=== Remix 開発環境起動開始 ==="' >> /start-remix.sh && \
    echo '' >> /start-remix.sh && \
    echo '# 永続node_modulesをlockfileへ同期（CIはこのコマンドだけに適用）' >> /start-remix.sh && \
    echo 'echo "依存関係を同期中..."' >> /start-remix.sh && \
    echo 'CI=true pnpm install --frozen-lockfile' >> /start-remix.sh && \
    echo '' >> /start-remix.sh && \
    echo '# Viteキャッシュをクリア' >> /start-remix.sh && \
    echo 'echo "Viteキャッシュをクリア中..."' >> /start-remix.sh && \
    echo 'mkdir -p node_modules/.vite' >> /start-remix.sh && \
    echo 'rm -rf node_modules/.vite/*' >> /start-remix.sh && \
    echo '' >> /start-remix.sh && \
    echo 'echo "=== Remix アプリケーション起動 ==="' >> /start-remix.sh && \
    echo 'exec pnpm run dev --host' >> /start-remix.sh && \
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
RUN pnpm install --frozen-lockfile

# アプリケーションコードをコピー
COPY . .

# 本番用ビルド
RUN pnpm run build

# 本番ステージ
FROM base AS production
# 本番用依存関係のみインストール
RUN pnpm install --frozen-lockfile --prod

# ビルド済みアプリケーションをコピー
COPY --from=build /usr/src/app/build ./build

# ポートをExpose
EXPOSE 3000

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 本番モードで起動
CMD ["pnpm", "run", "start"]
