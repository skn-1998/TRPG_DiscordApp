# TRPG-SERVER アーキテクチャ・ドキュメント

## プロジェクト概要

TRPG-SERVERは、テーブルトークRPG（TRPG）をサポートするためのNestJS製バックエンドアプリケーションです。主にDiscord Botとして動作し、Webアプリケーションとしても機能します。

### 主要機能
- **Discord Bot機能**: ダイスロール、キャラクター管理、ゲームセッション支援
- **キャラクター管理**: TRPG用キャラクターの作成・編集・保存
- **ダイスロール**: 各種ゲームシステムに対応した自動ダイスロール
- **ユーザー認証**: Discord OAuth2による認証システム
- **WebAPI**: フロントエンド（Remix）との連携

## 技術スタック

### 主要技術
- **フレームワーク**: NestJS v10.x
- **言語**: TypeScript
- **データベース**: MongoDB（Mongoose）
- **認証**: JWT + Discord OAuth2
- **外部API**: Discord.js v14
- **コンテナ**: Docker対応

### 主要依存関係
- `@nestjs/common`, `@nestjs/core` - NestJSコアフレームワーク
- `discord.js` - Discord Bot開発
- `mongoose`, `@nestjs/mongoose` - MongoDB接続
- `@nestjs/jwt`, `passport` - JWT認証
- `bcdice` - ダイスロール機能
- `class-validator`, `class-transformer` - データバリデーション

## アーキテクチャパターン

### 1. レイヤードアーキテクチャ
```
Controller Layer    - HTTPリクエスト処理、ルーティング
Service Layer       - ビジネスロジック
Repository Layer    - データアクセス抽象化
Model Layer         - データモデル定義
```

### 2. ドメイン駆動設計（DDD）
ドメインごとにモジュールを分離し、各ドメインが独立した責任を持つ構造を採用。

### 3. モジュール構成
- **Feature Modules**: ドメイン別の機能モジュール
- **Shared Modules**: 共通機能モジュール
- **Core Modules**: インフラストラクチャ層

## ディレクトリ構造とモジュール解説

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
- 環境変数のバリデーション
- 設定値の集中管理

#### 3. **コア機能** (`/core`)
```
core/
├── database/
│   └── database.module.ts  # データベース接続設定
├── interfaces/
│   └── repository.interface.ts # リポジトリ基底インターフェース
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
- **Commands**: `/`で始まるスラッシュコマンド
- **Events**: ユーザー操作（ボタン、モーダル、セレクト）への応答
- **Services**: Discord API操作の抽象化
- **Utils**: ダイスロール、チャンネル管理などの共通機能

#### 6. **共通機能**
```
middleware/
├── cors.middleware.ts     # CORS設定
utils/
├── error-helpers.ts       # エラーハンドリング
types/
└── express/
    └── index.d.ts        # Express型拡張
```

## データフロー

### 1. Web API リクエストフロー
```
HTTP Request → Controller → Service → Repository → Database
                    ↓
Response ← DTO ← Business Logic ← Data Access ← MongoDB
```

### 2. Discord Bot インタラクションフロー
```
Discord Interaction → Event Handler → Service → Repository → Database
                           ↓
Discord Response ← Business Logic ← Data Access ← MongoDB
```

## 主要な設計パターン

### 1. **依存性注入（Dependency Injection）**
NestJSのDIコンテナを使用し、各層の疎結合を実現。

### 2. **リポジトリパターン**
データアクセス層を抽象化し、テスタビリティを向上。

### 3. **DTO（Data Transfer Object）**
API間のデータ転送時の型安全性を確保。

### 4. **Guard パターン**
認証・認可処理の横断的関心事を分離。

### 5. **Strategy パターン**
Discord OAuth2認証戦略の実装。

## 設定管理

### 環境変数
```typescript
// 主要な環境変数
NODE_ENV              # 実行環境
PORT                  # サーバーポート
MONGODB_URI           # MongoDB接続URI
TOKEN                 # Discord Botトークン
DISCORD_APPLICATIONID # Discord アプリケーションID
JWT_SECRET            # JWT署名キー
FRONTEND_URL          # フロントエンドURL
```

### 設定の特徴
- 型安全な設定値アクセス
- 環境変数の自動バリデーション
- 設定パスの予測変換サポート

## データベース設計

### 主要コレクション
- **users**: ユーザー情報
- **characters**: キャラクター情報
- **dice-roll-channels**: ダイスロールチャンネル
- **dice-roll-texts**: ダイスロール履歴

### 接続管理
- Mongoose使用
- 非同期接続設定
- 接続状態の監視

## 認証・認可

### 認証フロー
1. Discord OAuth2認証
2. JWTトークン発行
3. 認証状態の保持
4. APIアクセス時の認証確認

### 認可
- JWT ベースの認証
- Route Guard による認可制御
- ロール基盤の認可（将来的に拡張可能）

## テスト戦略

### テスト種別
- **単体テスト**: Jest使用
- **統合テスト**: Supertest使用
- **E2Eテスト**: Jest E2E設定

### モック戦略
- Repository層のモック化
- Database接続のモック化
- Discord API のモック化

## 開発・運用

### 開発環境
- TypeScript使用
- Hot Reload対応
- ESLint + Prettier
- Git フック設定

### 本番環境
- Docker対応
- 環境変数による設定管理
- ログ出力設定
- エラーハンドリング

## パフォーマンス考慮事項

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

## セキュリティ

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

## 今後の拡張性

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

## 🔧 **リファクタリング優先順位**

### **✅ 完了済み項目**

#### ✅ 1. **非推奨ファイルの削除** `[完了: 2025-07-02]`

```bash
# ✅ 削除完了
- src/config/environment.ts  # 完全に削除済み
- 新しいValidatorシステムに完全移行済み
```

#### ✅ 2. **プロダクション環境でのデバッグログ除去** `[完了: 2025-07-02]`

```typescript
// ✅ COMPLETED: 本番環境でのログ制御
// フロントエンドAPI通信の際のログ制御が完了

// 関連修正:
// - trpg-remix-app/app/lib/api-client.ts でのログ制御
// - 本番環境での機密情報保護
// - 開発環境のみデバッグ情報表示
```

### **✅ 完了済み項目**

#### ✅ 3. **TypeScript設定の強化（第1段階）** `[完了: 2025-01-02]`

```json
// ✅ COMPLETED: 実用的な厳密型チェック設定
{
  "strict": true,
  "strictNullChecks": true,
  "noImplicitAny": true,
  "strictBindCallApply": true,
  "strictFunctionTypes": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true,
  "forceConsistentCasingInFileNames": true,
  "strictPropertyInitialization": false // DIコンテナ使用のため例外的に無効化
}

// 🔜 第2段階で強化予定
{
  "noUnusedLocals": false, // 段階的修正のため一時的に無効化
  "noUnusedParameters": false, // 段階的修正のため一時的に無効化
  "exactOptionalPropertyTypes": false, // 段階的修正のため一時的に無効化
  "noImplicitOverride": false // 段階的修正のため一時的に無効化
}

// 📊 エラー数改善: 151個 → 29個 (81%減少)
// ✅ Phase 1完了項目:
// ✅ 外部ライブラリ型定義追加 (@types/passport-discord, @types/cors)
// ✅ config undefinedエラー修正 (commands.controller.ts, events.controller.ts)
// ✅ Character nullチェック追加 (character-tab-buttons.service.ts)
// ✅ 戻り値型修正 (character.controller.ts)
// ✅ 設定値undefinedチェック (command-manager.service.ts, dice-roll.service.ts)
// ✅ auth.service.ts user.name undefinedハンドリング
// ✅ JWT設定の型安全性向上
// ✅ 関数戻り値の型安全性向上
```

### **🚨 最高優先度（即座に対応が必要）**

> **現在、最高優先度の項目はありません。**  
> TypeScript基本設定の強化が完了しました。

### **🔥 高優先度（1週間以内）**

#### 1. **TypeScript設定の強化（第2段階）**
```typescript
// 🎯 次の段階で実装予定
- 未使用変数・パラメータのチェック有効化
- exactOptionalPropertyTypes の段階的適用
- 残り29個のTypeScriptエラーの修正
- Discord.js型問題の解決

// 📋 残存エラー分類 (29個):
1. Discord.js型問題 (9件): interaction.channel, interaction.guild のnullチェック
2. インデックスシグネチャ (6件): CharacterDiceButtonsService の動的プロパティ
3. 暗黙的any型 (8件): character-channel.service.ts の変数型問題
4. Character nullチェック (4件): add-chara-info.service.ts
5. その他 (2件): EmbedBuilder, Object.entries問題

// 📋 実装戦略
1. ✅ 外部型定義の追加 (@types/passport-discord, @types/cors)
2. ✅ strictNullChecks関連エラーの段階的修正  
3. 🔄 implicit any type の解消 (進行中)
4. 🔄 Discord.js関連型問題の解決 (進行中)
5. 🔜 未使用変数・パラメータの整理
```

#### 2. **エラーハンドリングの統一**
```typescript
// ❌ 現在: 各所でバラバラなエラーハンドリング
catch (error) {
  console.error('エラー:', error)
  // 統一されていない処理
}

// ✅ 統一されたエラーハンドリング
export class ApiErrorHandler {
  static handleError(error: unknown, context: string): ErrorResponse {
    const errorMessage = getErrorMessage(error)
    Logger.error(`${context}: ${errorMessage}`)
    
    return {
      success: false,
      message: 'リクエストの処理中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }
  }
}
```

#### 3. **Discord Botのエラー処理改善**
```typescript
// ❌ 現在: エラー時のユーザーフィードバック不十分
catch (error) {
  console.error('ダイスロール処理エラー:', error)
  await interaction.editReply('エラーが発生しました。')
}

// ✅ 改善案
catch (error) {
  this.logger.error('ダイスロール処理エラー:', error)
  await this.handleInteractionError(interaction, 'ダイスロールの処理に失敗しました。')
}
```

#### 4. **TODO項目の解決**
```typescript
// ❌ 未実装機能
// TODO: 25ページ単位の移動処理（必要に応じて実装）
// discord/events/select-menu/dice-page-select-menu.service.ts:47
```

### **⚠️ 中優先度（1ヶ月以内）**

#### 7. **テストカバレッジの向上**
```bash
# ❌ 現在: 基本的なテストファイルのみ
# ✅ 追加実装が必要
- 認証フローのE2Eテスト
- Discord Botコマンドのユニットテスト
- キャラクター管理のインテグレーションテスト
- エラーハンドリングのテスト
```

#### 8. **パフォーマンス最適化**
```typescript
// ❌ 潜在的なパフォーマンス問題
- MongoDB クエリの最適化
- Discord API レート制限の改善
- メモリリークの検証
```

#### 9. **セキュリティ強化**
```typescript
// ❌ セキュリティ改善項目
- JWT トークンのより厳密な検証
- 入力値サニタイゼーションの強化
- レート制限の実装
```

### **📋 長期改善項目（3ヶ月以内）**

#### 10. **アーキテクチャの一貫性向上**
- ドメインモジュール間の依存関係整理
- 共通インターフェースの統一
- 設計パターンの一貫した適用

#### 11. **モニタリング・ログ基盤の強化**
- 構造化ログの導入
- アプリケーションメトリクスの収集
- アラート機能の実装

#### 12. **ドキュメント・コメントの充実**
- JSDocコメントの追加
- API仕様書の自動生成
- 開発ガイドラインの策定

### **🎯 修正実装方針**

#### **段階的実装アプローチ**
1. **Phase 1**: 型安全性・セキュリティの基盤修正
2. **Phase 2**: エラーハンドリング・ログ管理の統一
3. **Phase 3**: テスト・パフォーマンスの向上
4. **Phase 4**: 長期的な設計改善

#### **リスク管理**
- 各修正は段階的に実装し、十分なテストを実施
- 本番環境への影響を最小限に抑制
- ロールバック計画の準備

#### **成果指標**
- TypeScript エラー数の削減
- テストカバレッジの向上
- 本番エラー率の削減
- 開発速度の向上

---

## 開発時の参考情報

### よく使用するコマンド
```bash
# 開発サーバー起動
pnpm run start:dev

# テスト実行
# 未実装
pnpm run test
pnpm run test:e2e

# ビルド
pnpm run build

# リント
pnpm run lint
```

### 重要なポイント
1. **型安全性**: TypeScriptの恩恵を最大限活用
2. **モジュール性**: 各機能が独立して開発・テスト可能
3. **拡張性**: 新機能追加時の影響範囲を最小化
4. **保守性**: コードの可読性と保守性を重視
5. **テスタビリティ**: 各層でのテストが容易な設計

このアーキテクチャにより、TRPG-SERVERは拡張性と保守性を兼ね備えた構造を実現しています。

## セキュリティ要件

### Discord OAuth トークン管理
- **アクセストークン保存**: UserModelにDiscordアクセストークンを暗号化して保存
- **リフレッシュトークン管理**: 自動トークン更新機能の実装
- **有効期限管理**: トークンの有効期限チェックと自動更新
- **暗号化**: データベース保存時の暗号化必須（AES-256-GCM推奨）
- **アクセス制御**: トークンへのアクセスを最小限に制限

### データベース設計
- UserModelにDiscordトークン関連フィールドを追加:
  - `discordAccessToken`: 暗号化されたアクセストークン
  - `discordRefreshToken`: 暗号化されたリフレッシュトークン
  - `discordTokenExpiresAt`: トークン有効期限
  - `discordTokenScope`: 取得したスコープ情報

### セキュリティ対策実装
1. **暗号化ユーティリティ**: トークンの暗号化・復号化機能
2. **トークン管理サービス**: 有効期限チェック・自動更新
3. **ログセキュリティ**: トークン情報のログ出力防止
4. **エラーハンドリング**: トークン関連エラーの適切な処理

## 暗号化仕様

### 使用アルゴリズム
- **暗号化**: AES-256-GCM
- **キー管理**: 環境変数による暗号化キー管理
- **初期化ベクター**: 各暗号化で一意のIV生成

### 環境変数追加
```
DISCORD_TOKEN_ENCRYPTION_KEY=your_encryption_key_here
```

## Discord OAuth トークン管理の実装詳細

### 1. データモデル設計

#### UserModel拡張
```typescript
@Schema({ timestamps: true })
export class User {
    // 既存フィールド
    @Prop({ required: true, unique: true })
    discordUserId: string

    @Prop({ required: true })
    name: string

    @Prop({ required: false })
    avatarHash?: string

    @Prop({ type: [String], default: [] })
    characterIds: string[]

    // Discord OAuth トークン管理フィールド
    @Prop({ required: false })
    discordAccessToken?: string // 暗号化されたアクセストークン

    @Prop({ required: false })
    discordRefreshToken?: string // 暗号化されたリフレッシュトークン

    @Prop({ required: false })
    discordTokenExpiresAt?: Date // トークン有効期限

    @Prop({ required: false })
    discordTokenScope?: string // 取得したスコープ情報（space区切り）
}
```

### 2. 暗号化ユーティリティ

#### CryptoUtil クラス
- **ファイル**: `src/utils/crypto.util.ts`
- **機能**: 
  - AES-256-GCM暗号化によるトークンの安全な保存
  - 初期化ベクター（IV）とAuthタグの管理
  - 暗号化キーの環境変数管理

```typescript
export class CryptoUtil {
    private static readonly ALGORITHM = 'aes-256-gcm'
    private static readonly IV_LENGTH = 16
    private static readonly TAG_LENGTH = 16

    static encrypt(text: string): string
    static decrypt(encryptedText: string): string
    static isValidEncryptedToken(encryptedToken: string): boolean
}
```

### 3. AuthService拡張

#### トークン管理メソッド
```typescript
// トークン付きユーザー登録・ログイン
async signInAndRegisterUserInfoWithTokens(
    user: Partial<User>, 
    authResponse: DiscordAuthResponse
): Promise<void>

// 有効なアクセストークン取得（自動更新付き）
async getValidDiscordAccessToken(discordUserId: string): Promise<string>

// Discord Guild一覧取得（自動トークン管理付き）
async getUserDiscordGuilds(discordUserId: string): Promise<DiscordGuild[]>

// トークン自動更新（内部メソッド）
private async refreshDiscordToken(discordUserId: string): Promise<string>
```

### 4. セキュリティ実装

#### トークンライフサイクル管理
1. **認証時**: アクセストークンとリフレッシュトークンを暗号化してDB保存
2. **API呼び出し時**: 有効期限チェック → 期限切れなら自動更新
3. **更新時**: リフレッシュトークンを使用して新しいトークンを取得
4. **エラー時**: 適切なエラーハンドリングとログ記録

#### セキュリティ対策
- **暗号化保存**: 平文トークンをDBに保存しない
- **有効期限管理**: トークンの自動有効期限チェック
- **ログ制御**: 機密情報のログ出力を防止
- **エラー処理**: トークン関連エラーの適切な処理

### 5. 環境変数設定

#### 必須環境変数
```bash
# Discord Token Encryption Key (32文字以上推奨)
DISCORD_TOKEN_ENCRYPTION_KEY=your-super-secure-encryption-key-here-32chars-minimum
```

#### 設定ファイル統合
- **EnvironmentSchema**: スキーマ定義に暗号化キーを追加
- **Configuration**: `security.discordTokenEncryptionKey`として設定値を管理
- **ConfigPaths**: 型安全な設定パスを提供

### 6. API使用例

#### Discord Guild一覧取得
```typescript
// AuthController内での使用例
@Get('guilds/:userId')
async getDiscordGuilds(@Param('userId') discordUserId: string) {
    const guilds = await this.authService.getUserDiscordGuilds(discordUserId)
    return { guilds }
}
```

#### 有効なトークン取得
```typescript
// サービス内での使用例
const accessToken = await this.authService.getValidDiscordAccessToken(discordUserId)
// Discord APIを呼び出し
const response = await axios.get('https://discord.com/api/users/@me', {
    headers: { Authorization: `Bearer ${accessToken}` }
})
```

### 7. エラーハンドリング

#### エラー種別
- `UnauthorizedException`: トークンが見つからない・無効
- `Error`: 暗号化・復号化エラー
- `Error`: リフレッシュトークン更新エラー

#### ログ管理
- トークン関連の機密情報はログに出力しない
- エラー発生時は適切なエラーメッセージをログに記録
- デバッグ情報は非本番環境でのみ出力

### 8. 今後の拡張予定

#### セキュリティ強化
- トークンの定期的なローテーション
- 不正アクセス検知機能
- 監査ログの実装

#### 機能拡張
- 複数OAuth プロバイダー対応
- トークンのバックアップ・復旧機能
- 管理者による強制トークン無効化

## 設定管理拡張

### 新規追加設定項目
```typescript
security: {
    discordTokenEncryptionKey: env.DISCORD_TOKEN_ENCRYPTION_KEY
}
```

### ConfigPaths型更新
- `security.discordTokenEncryptionKey`パスを追加
- 型安全な設定値アクセスを提供

## セットアップ・運用ガイド

### 1. 初回セットアップ手順

#### 環境変数の設定
現在の環境は設定済み
```bash
# .env ファイルに以下を追加
DISCORD_TOKEN_ENCRYPTION_KEY=your-32-character-or-longer-encryption-key-here-for-security

# 例: ランダムなキーの生成 (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### データベースマイグレーション
- 既存のUserドキュメントには新しいフィールドが`undefined`で追加される
- 初回Discord認証時に自動的にトークンフィールドが設定される

#### 本番環境デプロイ前チェック
1. **暗号化キーの設定**: 必ず本番環境で異なるキーを使用
2. **権限確認**: MongoDB接続ユーザーの更新権限確認
3. **ログレベル**: 本番環境では機密情報のログ出力を無効化

### 2. 運用時の注意事項

#### セキュリティ監視
- 暗号化キーの定期的なローテーション（推奨：6ヶ月ごと）
- 不正アクセス試行の監視
- トークン更新失敗の監視とアラート

#### パフォーマンス監視
- トークン自動更新頻度の監視
- Discord API レート制限の監視
- データベースのインデックス最適化

#### バックアップ戦略
- 暗号化されたトークンを含むユーザーデータのバックアップ
- 暗号化キーの安全な保管（環境変数とは別の場所）
- 災害復旧時の手順書整備

### 3. トラブルシューティング

#### よくある問題と解決法

##### 1. 暗号化エラー
**症状**: `DISCORD_TOKEN_ENCRYPTION_KEY environment variable is required`
**解決法**: 
```bash
# 環境変数が設定されているか確認
echo $DISCORD_TOKEN_ENCRYPTION_KEY

# キーの長さが十分か確認（32文字以上推奨）
echo ${#DISCORD_TOKEN_ENCRYPTION_KEY}
```

##### 2. トークン復号化失敗
**症状**: `トークンの復号化に失敗しました`
**原因**: 暗号化キーが変更された、または破損したトークン
**解決法**: 
- ユーザーに再認証を促す
- データベースから該当ユーザーのトークンフィールドをクリア

##### 3. Discord API レート制限
**症状**: 429 Too Many Requests エラー
**解決法**: 
- リクエスト間隔の調整
- バックオフ戦略の実装
- Discord API使用量の監視

#### デバッグ用コマンド

##### トークン状態確認
```typescript
// 開発環境でのトークン状態確認
const debugTokenStatus = async (discordUserId: string) => {
    const user = await this.userService.findOne(discordUserId)
    console.log('=== Token Debug Info ===')
    console.log('User ID:', discordUserId)
    console.log('Has Access Token:', !!user?.discordAccessToken)
    console.log('Has Refresh Token:', !!user?.discordRefreshToken)
    console.log('Token Expires At:', user?.discordTokenExpiresAt)
    console.log('Token Scope:', user?.discordTokenScope)
    console.log('=======================')
}
```

##### 強制トークンクリア（緊急時）
```typescript
// 緊急時のトークンクリア（管理者のみ）
const clearUserTokens = async (discordUserId: string) => {
    await this.userService.update(discordUserId, {
        discordAccessToken: undefined,
        discordRefreshToken: undefined,
        discordTokenExpiresAt: undefined,
        discordTokenScope: undefined
    })
    console.log(`Cleared tokens for user: ${discordUserId}`)
}
```

### 4. 暗号化キーのローテーション手順

#### 準備段階
1. 新しい暗号化キーを生成
2. 既存キーでのバックアップ作成
3. メンテナンス時間の設定

#### 実行手順
```typescript
// 暗号化キーローテーション用スクリプト
const rotateEncryptionKey = async (oldKey: string, newKey: string) => {
    // 1. 全ユーザーのトークンを取得
    const users = await User.find({ 
        discordAccessToken: { $exists: true, $ne: null } 
    })
    
    for (const user of users) {
        try {
            // 2. 古いキーで復号化
            const oldDecryptedAccess = CryptoUtil.decryptWithKey(user.discordAccessToken, oldKey)
            const oldDecryptedRefresh = CryptoUtil.decryptWithKey(user.discordRefreshToken, oldKey)
            
            // 3. 新しいキーで暗号化
            const newEncryptedAccess = CryptoUtil.encryptWithKey(oldDecryptedAccess, newKey)
            const newEncryptedRefresh = CryptoUtil.encryptWithKey(oldDecryptedRefresh, newKey)
            
            // 4. データベース更新
            await User.updateOne(
                { discordUserId: user.discordUserId },
                {
                    discordAccessToken: newEncryptedAccess,
                    discordRefreshToken: newEncryptedRefresh
                }
            )
            
            console.log(`✅ Updated tokens for user: ${user.discordUserId}`)
        } catch (error) {
            console.error(`❌ Failed to update tokens for user: ${user.discordUserId}`, error)
        }
    }
}
```

### 5. 監視・アラート設定

#### 重要な監視項目
1. **トークン更新失敗率**: 5%を超えた場合アラート
2. **暗号化エラー**: 発生時即座にアラート
3. **Discord API エラー率**: 10%を超えた場合アラート
4. **認証失敗率**: 異常な増加を検知

#### ログ監視クエリ例
```bash
# トークン関連エラーの監視
grep -i "token.*error" /var/log/trpg-server.log

# 暗号化関連エラーの監視
grep -i "crypto.*error\|encryption.*error\|decryption.*error" /var/log/trpg-server.log

# Discord API エラーの監視
grep -i "discord.*api.*error" /var/log/trpg-server.log
```

### 6. パフォーマンス最適化

#### データベースインデックス
```javascript
// MongoDB インデックスの追加
db.users.createIndex({ "discordUserId": 1 })
db.users.createIndex({ "discordTokenExpiresAt": 1 })
db.users.createIndex({ 
    "discordTokenExpiresAt": 1,
    "discordAccessToken": 1 
})
```

#### キャッシュ戦略
- 有効なトークンの短期間キャッシュ（Redis）
- Discord API レスポンスのキャッシュ
- ユーザー情報の適切なキャッシュ期間設定
