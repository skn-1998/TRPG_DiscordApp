# マルチステージビルド: 開発・本番両対応
FROM node:22-alpine AS base

# 必要なパッケージをインストール
RUN apk add --no-cache wget curl

# pnpmをグローバルにインストール
RUN npm install -g pnpm@11.5.1

# workspace root を作業ディレクトリにする
WORKDIR /usr/src/app

# manifest COPY は lockfile の全 importer に必要（frozen-lockfile 検証のため）。
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY TRPG-SERVER/package.json ./TRPG-SERVER/package.json
COPY trpg-next-app/package.json ./trpg-next-app/package.json
COPY packages/sheet-engine/package.json ./packages/sheet-engine/package.json
COPY packages/sheet-projection/package.json ./packages/sheet-projection/package.json
COPY packages/api-contract/package.json ./packages/api-contract/package.json
# tools/* も workspace importer（欠くと COPY . . 後に verifyDepsBeforeRun が
# 「workspace structure has changed」で pnpm run を拒否する）
COPY tools/static-analysis/package.json ./tools/static-analysis/package.json

# 開発ステージ
FROM base AS development
# 開発用の依存関係をインストール
RUN pnpm install --frozen-lockfile --filter trpg-next-app...

# アプリケーションコードをコピー
COPY . .

# スタートアップスクリプトを作成
RUN echo '#!/bin/sh' > /start-next.sh && \
    echo 'echo "=== Next 開発環境起動開始 ==="' >> /start-next.sh && \
    echo '' >> /start-next.sh && \
    echo '# node_modulesが空の場合のみインストール' >> /start-next.sh && \
    echo 'if [ ! -d "trpg-next-app/node_modules/next" ] || [ ! -d "packages/sheet-engine/node_modules/zod" ]; then' >> /start-next.sh && \
    echo '  echo "依存関係をインストール中..."' >> /start-next.sh && \
    echo '  pnpm install --frozen-lockfile --filter trpg-next-app...' >> /start-next.sh && \
    echo 'else' >> /start-next.sh && \
    echo '  echo "依存関係は既にインストール済みです"' >> /start-next.sh && \
    echo 'fi' >> /start-next.sh && \
    echo '' >> /start-next.sh && \
    echo 'echo "Workspace dependencies をビルド中..."' >> /start-next.sh && \
    echo 'pnpm --filter "trpg-next-app^..." build' >> /start-next.sh && \
    echo '' >> /start-next.sh && \
    echo 'echo "=== Next アプリケーション起動 ==="' >> /start-next.sh && \
    echo 'exec pnpm --filter trpg-next-app exec next dev -p 3000 -H 0.0.0.0' >> /start-next.sh && \
    chmod +x /start-next.sh

# ポートをExpose
EXPOSE 3000

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 開発モードで起動（スタートアップスクリプト使用）
CMD ["/start-next.sh"]

# 本番ビルドステージ
FROM base AS build
# 全ての依存関係をインストール
RUN pnpm install --frozen-lockfile --filter trpg-next-app...

# アプリケーションコードをコピー
COPY . .

# 本番用ビルド
RUN pnpm --filter trpg-next-app run build

# 本番ステージ
FROM base AS production
# 本番用依存関係のみインストール
RUN pnpm install --frozen-lockfile --prod --filter trpg-next-app...

# ビルド済みアプリケーションをコピー
COPY --from=build /usr/src/app/trpg-next-app/.next ./trpg-next-app/.next
COPY --from=build /usr/src/app/packages/sheet-engine/dist ./packages/sheet-engine/dist
COPY --from=build /usr/src/app/packages/api-contract/dist ./packages/api-contract/dist

# ポートをExpose
EXPOSE 3000

# Healthcheck追加
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# 本番モードで起動
CMD ["pnpm", "--filter", "trpg-next-app", "exec", "next", "start", "-p", "3000", "-H", "0.0.0.0"]
