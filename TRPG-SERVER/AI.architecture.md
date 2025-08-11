# TRPG-SERVER アーキテクチャ詳細ドキュメント

## 📋 **ドキュメント概要** **[作成日: 2025-01-09]**

このドキュメントでは、TRPG-SERVERのシステムアーキテクチャ、技術スタック、データベース設計、設定管理などの詳細仕様を説明します。

**関連ドキュメント**:
- **[AI.md](./AI.md)** - プロジェクト概要
- **[AI.domain.md](./AI.domain.md)** - ドメイン駆動設計・イベント駆動アーキテクチャ
- **[AI.test.md](./AI.test.md)** - テスト戦略・カバレッジ分析

---

## 🏗️ **システムアーキテクチャ**

### 1. **レイヤードアーキテクチャ**
```
┌─────────────────┐
│ Controller Layer │ ← HTTPリクエスト処理、ルーティング
├─────────────────┤
│ Service Layer    │ ← ビジネスロジック、ドメインルール
├─────────────────┤
│ Repository Layer │ ← データアクセス抽象化
├─────────────────┤
│ Model Layer      │ ← データモデル定義（Mongoose Schema）
└─────────────────┘
```

### 2. **ドメイン駆動設計（DDD）**
ドメインごとにモジュールを分離し、各ドメインが独立した責任を持つ構造を採用。

**主要ドメイン**:
- **Auth Domain**: 認証・認可処理 (95/100)
- **User Domain**: ユーザー情報管理 (90/100) 
- **Character Domain**: キャラクター管理 (85/100)
- **Dice-Roll Domain**: ダイスロール履歴管理 (80/100)
- **Discord Domain**: Bot機能統合 (88/100)

### 3. **モジュール構成**
- **Feature Modules**: ドメイン別の機能モジュール
- **Shared Modules**: 共通機能モジュール
- **Core Modules**: インフラストラクチャ層

---

## 💻 **技術スタック**

### **主要技術**
- **フレームワーク**: NestJS v10.x
- **言語**: TypeScript (100% 型安全性達成)
- **データベース**: MongoDB（Mongoose）
- **認証**: JWT + Discord OAuth2
- **外部API**: Discord.js v14
- **コンテナ**: Docker対応

### **主要依存関係**
```typescript
// NestJS Core
"@nestjs/common": "^10.x",
"@nestjs/core": "^10.x",
"@nestjs/platform-express": "^10.x"

// データベース
"mongoose": "^8.x",
"@nestjs/mongoose": "^10.x"

// 認証
"@nestjs/jwt": "^10.x",
"passport": "^0.7.x",
"passport-discord": "^0.1.x"

// Discord Bot
"discord.js": "^14.x"

// その他
"bcdice": "^1.x", // ダイスロール機能
"class-validator": "^0.14.x",
"class-transformer": "^0.5.x"
```

---

## 🗂️ **ディレクトリ構造詳細**

### `/src` - メインソースコード

#### 1. **アプリケーション層**
```
src/
├── app.module.ts          # ルートモジュール
├── app.controller.ts      # アプリケーションコントローラー
├── app.service.ts         # アプリケーションサービス
└── main.ts               # アプリケーションエントリーポイント
```

#### 2. **設定管理** (`/config`)
```
config/
├── config.module.ts       # 設定モジュール
├── config.service.ts      # 設定サービス
├── configuration.ts       # 設定値生成・型定義
├── environment.validator.ts # 環境変数バリデーション
└── schemas/
    └── environment.schema.ts # 環境変数スキーマ
```

**特徴**:
- 型安全な設定管理システム
- 環境変数の自動バリデーション
- 設定値の集中管理

#### 3. **コア機能** (`/core`)
```
core/
├── database/
│   └── database.module.ts  # データベース接続設定
├── interfaces/
│   └── repository.interface.ts # リポジトリ基底インターフェース
├── dto/
│   ├── base.dto.ts        # 共通DTO基底クラス
│   └── domain.dto.ts      # ドメイン固有DTO
└── testing/
    └── repository.mock.factory.ts # テスト用モックファクトリ
```

#### 4. **ドメイン層** (`/domains`)
各ドメインは以下の構造を持つ:

```
domains/
├── auth/                  # 認証ドメイン
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── services/
│   ├── dto/
│   ├── models/
│   ├── guards/
│   └── strategies/
├── character/             # キャラクタードメイン
│   ├── character.module.ts
│   ├── character.controller.ts
│   ├── character.service.ts
│   ├── dto/
│   ├── models/
│   └── repositories/
├── user/                  # ユーザードメイン
└── dice-roll/            # ダイスロールドメイン
```

**ドメインモジュール構成パターン**:
- `*.module.ts` - モジュール定義
- `*.controller.ts` - HTTPエンドポイント
- `*.service.ts` - ビジネスロジック
- `dto/` - データ転送オブジェクト
- `models/` - データモデル（Mongoose Schema）
- `repositories/` - データアクセス層

#### 5. **Discord Bot機能** (`/discord`)
```
discord/
├── discord.module.ts      # Discordメインモジュール
├── discord.service.ts     # Discord初期化・管理
├── commands/              # スラッシュコマンド
│   ├── commands.module.ts
│   ├── commands.service.ts
│   └── commands-components/
├── events/                # Discordイベント処理
│   ├── events.module.ts
│   ├── button/           # ボタン操作
│   ├── modal/            # モーダル操作
│   └── select/           # セレクトメニュー
├── services/              # Discord共通サービス
│   ├── discord-client.service.ts
│   ├── command-manager.service.ts
│   └── discord-command-registration.service.ts
└── utils/                # Discord専用ユーティリティ
```

**Discord Bot アーキテクチャ**:
- **Commands (薄いアダプタ)**: スラッシュコマンド宣言・入力抽出・応答状態管理のみ。ビジネスロジックは保持しない
- **Events (薄いアダプタ)**: Button/Select/Modalのアダプタ。CustomId解釈・応答状態管理のみ
- **Features**: 機能単位でビジネスロジックを集約（UseCase/Service/Orchestrator）。外部I/Oから独立
- **Services**: Discord API操作の抽象化
- **Utils**: ダイスロール、チャンネル管理などの共通機能

#### 6. **共通機能**
```
middleware/
├── cors.middleware.ts     # CORS設定
utils/
├── error-helpers.ts       # エラーハンドリング
├── error-handler.ts       # 統一エラーハンドラー
types/
└── express/
    └── index.d.ts        # Express型拡張
```

---

## 🔄 **データフロー**

### 1. **Web API リクエストフロー**
```
HTTP Request → Controller → Service → Repository → Database
                    ↓
Response ← DTO ← Business Logic ← Data Access ← MongoDB
```

### 2. **Discord Bot インタラクションフロー**
```
Discord Interaction → Event Adapter (events) → Feature Orchestrator → Service → Repository
                                                              ↓
                                     Discord Response ← Business Logic
```

### 3. **イベント駆動フロー**
```
Command/Event → TypedEventService → Domain Events → Event Handlers
                                         ↓
                              Business Logic → Response
```

---

## 🎨 **主要な設計パターン**

### 1. **依存性注入（Dependency Injection）**
NestJSのDIコンテナを使用し、各層の疎結合を実現。

### 2. **リポジトリパターン**
データアクセス層を抽象化し、テスタビリティを向上。

### 3. **DTO（Data Transfer Object）標準化**
```typescript
// 基底クラス体系
BaseDto           // 共通フィールド (createdAt, updatedAt)
├── IdentifiableDto  // ID を持つ DTO
└── DiscordDto       // Discord 関連フィールド

// ValidationUtils体系
ValidationUtils.requiredString('フィールド名')
ValidationUtils.optionalString('フィールド名')
ValidationUtils.array('フィールド名')
ValidationUtils.date('フィールド名')
```

### 4. **Guard パターン**
認証・認可処理の横断的関心事を分離。

### 5. **Strategy パターン**
Discord OAuth2認証戦略の実装。

### 6. **イベント駆動パターン**
TypedEventServiceによる型安全なイベント通信。

---

## 🛠️ **設定管理**

### **環境変数**
```typescript
// 主要な環境変数
NODE_ENV              # 実行環境
PORT                  # サーバーポート
MONGODB_URI           # MongoDB接続URI
TOKEN                 # Discord Botトークン
DISCORD_APPLICATIONID # Discord アプリケーションID
JWT_SECRET            # JWT署名キー
FRONTEND_URL          # フロントエンドURL

// ログ設定 (2025-01-05追加)
LOG_LEVEL             # ログレベル (debug, info, warn, error)
LOG_FILE_ENABLE       # ファイルログの有効/無効
LOG_CONSOLE_ENABLE    # コンソールログの有効/無効
LOG_FILE_PATH         # ログファイルのパス
LOG_ERROR_FILE_PATH   # エラーログファイルのパス
```

### **設定の特徴**
- 型安全な設定値アクセス
- 環境変数の自動バリデーション
- 設定パスの予測変換サポート

---

## 🗄️ **データベース設計**

### **主要コレクション**
- **users**: ユーザー情報
- **characters**: キャラクター情報
- **dice-roll-channels**: ダイスロールチャンネル
- **dice-roll-texts**: ダイスロール履歴

### **接続管理**
- Mongoose使用
- 非同期接続設定
- 接続状態の監視

---

## 🔐 **認証・認可**

### **認証フロー**
1. Discord OAuth2認証
2. JWTトークン発行
3. 認証状態の保持
4. APIアクセス時の認証確認

### **認可**
- JWT ベースの認証
- Route Guard による認可制御
- ロール基盤の認可（将来的に拡張可能）

---

## ⚡ **パフォーマンス考慮事項**

### 1. **データベース**
- MongoDB接続プール
- インデックス設定
- クエリ最適化

### 2. **Discord Bot**
- レート制限対応
- 非同期処理
- エラー時の自動復旧

### 3. **メモリ管理**
- 接続状態の適切な管理
- リソースの適切な解放

---

## 🔒 **セキュリティ**

### 1. **認証セキュリティ**
- JWT署名の強化
- トークン有効期限設定
- HTTPS強制

### 2. **API セキュリティ**
- CORS設定
- 入力値バリデーション
- SQLインジェクション対策（NoSQL使用）

### 3. **Discord Bot セキュリティ**
- 権限の最小化
- トークンの適切な管理
- レート制限遵守

---

## 🚀 **今後の拡張性**

### 1. **機能拡張**
- 新しいゲームシステム対応
- マルチサーバー対応
- リアルタイム通信

### 2. **技術的拡張**
- マイクロサービス化
- キャッシュ層の追加
- ログ分析システム

### 3. **運用面の改善**
- モニタリング強化
- 自動デプロイ
- バックアップシステム

---

## 📊 **アーキテクチャ品質指標**

### **現在の評価**
- **型安全性**: 100% (TypeScript完全対応)
- **テストカバレッジ**: 43.99% (+33.46% 改善)
- **ドメイン設計**: 88/100 (優秀)
- **循環依存**: 0個 (完全解決)
- **ビルド成功率**: 100% (Exit code: 0)

### **コード品質**
- **エラーハンドリング**: 100%統一化
- **ログシステム**: 構造化ログ完全導入
- **DTO標準化**: 全ドメイン統一完了
- **命名規則**: 一貫した命名パターン

---

*このドキュメントは技術的な詳細仕様を提供します。プロジェクト概要については [AI.md](./AI.md) を、ドメイン設計については [AI.domain.md](./AI.domain.md) をご参照ください。*