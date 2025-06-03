# TRPG アプリケーション - 最適化されたDocker構成

このプロジェクトは、Remix（フロントエンド）とNestJS（バックエンド）を使用したTRPGアプリケーションです。Docker環境は最適化されており、開発環境と本番環境の両方に対応しています。

## 🚀 機能

- **マルチステージビルド**: 開発・本番両環境対応
- **ヘルスチェック機能**: サービスの健全性監視
- **最適化されたキャッシング**: pnpmとnode_modulesの効率的管理
- **便利なPowerShellスクリプト**: 簡単なコマンドでDocker操作

## 📋 前提条件

- Docker & Docker Compose
- PowerShell 7+
- pnpm（コンテナ内で自動インストール）

## 🛠️ セットアップ

### 1. PowerShellエイリアスの読み込み

```powershell
. .\docker-aliases.ps1
```

### 2. 開発環境の起動

```powershell
# 初回起動または完全リビルド
dcr

# 通常の起動
dcup

# ログ確認
dcl

# 特定のサービスのログ確認
dcl app
dcl nestjs
dcl nginx
```

### 3. 本番環境の起動

```powershell
# 本番環境の完全リビルド
dcrp

# 本番環境の起動
dcupp
```

## 📊 利用可能なコマンド

| コマンド | 説明 |
|---------|------|
| `dcr` | 開発環境完全リビルド |
| `dcrp` | 本番環境完全リビルド |
| `dcrs` | 依存関係リセット（node_modules含む） |
| `dcrt` | 基本的な再起動 |
| `dcup` | 開発環境起動 |
| `dcupp` | 本番環境起動 |
| `dcl [サービス名]` | ログ表示 |
| `dch` | ヘルスチェック確認 |
| `dcc` | 完全クリーンアップ |

## 🏗️ アーキテクチャ

### サービス構成

- **app**: Remix フロントエンドアプリケーション（Port: 5173）
- **nestjs**: NestJS バックエンドAPI（Port: 3000）
- **nginx**: リバースプロキシとSSL終端（Port: 80, 443）

### 最適化ポイント

1. **マルチステージビルド**
   - 開発ステージ：ホットリロード対応
   - 本番ステージ：最小サイズの最適化済みイメージ

2. **Alpine Linuxベース**
   - 軽量なベースイメージで高速起動

3. **レイヤーキャッシング**
   - package.jsonを先にコピーして依存関係キャッシュを最適化

4. **名前付きボリューム**
   - node_modulesをボリュームマウントで高速化

5. **ヘルスチェック**
   - サービスの健全性を自動監視

## 🔧 設定ファイル

### Docker関連
- `docker-compose.yml`: 開発環境設定
- `docker-compose.prod.yml`: 本番環境設定
- `trpg-remix-app/Dockerfile`: Remixアプリ用マルチステージビルド
- `TRPG-SERVER/Dockerfile`: NestJSサーバー用マルチステージビルド

### 環境変数
開発環境と本番環境で自動的に適切な環境変数が設定されます。

## 🐛 トラブルシューティング

### 依存関係の問題
```powershell
dcrs  # 依存関係を完全リセット
```

### ポートの競合
サービスが起動しない場合は、ポートが使用中でないか確認してください：
```powershell
netstat -an | findstr ":3000"
netstat -an | findstr ":5173"
```

### ログの確認
```powershell
dcl          # 全サービスのログ
dcl app      # Remixアプリのログ
dcl nestjs   # NestJSサーバーのログ
dcl nginx    # Nginxのログ
```

### ヘルスチェック
```powershell
dch  # サービスの健全性確認
```

## 🚀 本番デプロイ

本番環境では以下を推奨します：

1. 環境変数の適切な設定
2. SSL証明書の更新
3. データベースの設定
4. ログローテーションの設定

```powershell
# 本番環境デプロイ
dcrp
```

## 📝 開発者向け情報

### ファイル監視
開発環境では、ファイル変更が自動的に検出され、アプリケーションが再読み込みされます。

### デバッグ
各サービスのログをリアルタイムで確認できます：
```powershell
dcl app    # Remixアプリケーション
dcl nestjs # NestJSサーバー
```

---

**注意**: Windows PowerShell環境での使用を前提としています。他のシェル環境では、適宜コマンドを調整してください。
