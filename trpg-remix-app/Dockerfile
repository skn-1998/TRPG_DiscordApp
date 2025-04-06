# ベースイメージとしてNode.jsを使用
FROM node:22

# pnpmをグローバルにインストール
RUN npm install -g pnpm

# 作業ディレクトリを設定
WORKDIR /usr/src/app

# パッケージ定義ファイルをコピー
COPY package.json pnpm-lock.yaml ./

RUN pnpm install


# ポートをExpose
EXPOSE 5173


CMD ["pnpm", "run", "dev"]
