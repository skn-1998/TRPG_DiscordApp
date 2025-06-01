# ベースイメージとしてNode.jsを使用
FROM node:22

# pnpmをグローバルにインストール
RUN npm install -g pnpm

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# パッケージ定義ファイルをコピー
COPY package.json pnpm-lock.yaml ./

# 依存関係を事前にインストール
RUN pnpm install --frozen-lockfile

# アプリケーションコードをコピー
COPY . .

# ポートをExpose
EXPOSE 5173

# 開発モードで起動
CMD ["sh", "-c", "pnpm install && pnpm run dev --host"]
