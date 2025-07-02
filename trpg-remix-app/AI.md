# TRPG-Remix-App アーキテクチャ・ドキュメント

## プロジェクト概要

TRPG-Remix-Appは、テーブルトークRPG（TRPG）の管理・支援を行うフロントエンドアプリケーションです。Remixフレームワークを使用し、TRPG-SERVERと連携してキャラクター管理、ダイスロール、ゲームセッション管理などの機能を提供します。

### 主要機能

- **キャラクター管理**: TRPG用キャラクターの作成・編集・閲覧
- **ユーザー認証**: Discord OAuth2による認証システム
- **ダイスロール履歴**: Discord Botと連携したダイスロール管理
- **ゲームシステム対応**: 複数のTRPGシステムに対応
- **レスポンシブデザイン**: モバイル・デスクトップ両対応

## 技術スタック

### 主要技術

- **フレームワーク**: Remix v2.x (Full-Stack React Framework)
- **言語**: TypeScript
- **UIライブラリ**: Mantine v7.x
- **状態管理**: Zustand + Immer
- **認証**: JWT + Discord OAuth2
- **HTTP通信**: Axios
- **ビルドツール**: Vite
- **スタイリング**: CSS Modules + PostCSS

### 主要依存関係

- `@remix-run/react`, `@remix-run/node` - Remixコアフレームワーク
- `@mantine/core`, `@mantine/hooks` - UIコンポーネントライブラリ
- `zustand` - 軽量状態管理
- `axios` - HTTPクライアント
- `@tabler/icons-react` - アイコンライブラリ
- `fuse.js` - 検索機能
- `lodash` - ユーティリティライブラリ

## アーキテクチャパターン

### 1. フィーチャードリブン開発（FDD）

```
Feature-Based Architecture
├── features/            # 機能別モジュール
│   ├── auth/           # 認証機能
│   ├── character/      # キャラクター管理
│   ├── users/          # ユーザー管理
│   └── scenario/       # シナリオ管理
```

### 2. レイヤードアーキテクチャ

```
Presentation Layer   - React Components, Pages
Application Layer    - Remix Loaders/Actions
Service Layer        - API Services, Business Logic
Infrastructure Layer - HTTP Client, State Management
```

### 3. コンポーネント設計

```
Atomic Design influenced
├── Elements/           # 基本要素（ボタン、入力など）
├── Components/         # 複合コンポーネント
├── Layouts/           # レイアウトコンポーネント
└── Features/          # 機能固有コンポーネント
```

## ディレクトリ構造とモジュール解説

### `/app` - メインアプリケーションコード

#### 1. **エントリーポイント**

```
app/
├── root.tsx              # アプリケーションルート
├── entry.client.tsx      # クライアントサイドエントリー
├── entry.server.tsx      # サーバーサイドエントリー
└── theme.ts             # Mantineテーマ設定
```

#### 2. **ルーティング** (`/routes`)

```
routes/
├── _index.tsx           # ホームページ
├── _auth.login.tsx      # ログインページ
├── _user.tsx           # ユーザー関連レイアウト
├── character+/         # キャラクター関連ルート
│   ├── index.tsx       # キャラクター一覧
│   ├── $id.tsx         # キャラクター詳細
│   └── $id.edit.tsx    # キャラクター編集
└── mock.tsx            # 開発用モックページ
```

**ルーティング特徴**:

- Remix Flat Routes使用
- ネストルートによるレイアウト共有
- 動的ルーティング（`$id`）
- プライベートルート（認証ガード）

#### 3. **フィーチャーモジュール** (`/features`)

各フィーチャーは以下の構造を持つ:

```
features/
├── auth/                 # 認証機能
│   ├── api/             # 認証API
│   ├── components/      # 認証コンポーネント
│   └── index.ts         # エクスポート管理
├── character/           # キャラクター管理
│   ├── api/             # キャラクターAPI
│   ├── components/      # キャラクターコンポーネント
│   ├── edit/            # キャラクター編集機能
│   ├── hooks/           # キャラクター専用フック
│   ├── types/           # キャラクター型定義
│   └── index.ts         # エクスポート管理
└── users/               # ユーザー管理
    ├── api/
    ├── components/
    └── index.ts
```

**フィーチャーモジュール設計原則**:

- 機能の独立性と再利用性
- 型定義の集約管理
- APIとUIの分離
- エクスポート管理による依存関係の明確化

#### 4. **UIコンポーネント** (`/components`)

```
components/
├── Elements/            # 基本UI要素
│   └── index.ts        # 共通エクスポート
├── Form/               # フォーム関連
├── Head/               # ヘッダー管理
├── Layouts/            # レイアウトコンポーネント
│   ├── AppLayout.tsx   # メインレイアウト
│   ├── Header.tsx      # ヘッダー
│   └── Footer.tsx      # フッター
└── ui/                 # カスタムUIコンポーネント
```

#### 5. **設定管理** (`/config`)

```
config/
├── config.service.ts        # 設定サービス
├── configuration.ts         # 設定値生成・型定義
├── environment.validator.ts # 環境変数バリデーション
└── schemas/
    └── environment.schema.ts # 環境変数スキーマ
```

**設定管理特徴**:

- 型安全な設定値アクセス
- 環境変数の自動バリデーション
- クライアント・サーバー両対応

#### 6. **状態管理** (`/store`)

```
store/
├── index.ts            # Zustandストア統合
├── counterSlice.ts     # カウンター状態スライス
└── testSlice.ts        # テスト用状態スライス
```

**状態管理アーキテクチャ**:

- Zustand + Immer による不変更新
- スライスパターンによる状態分離
- 永続化対応（localStorage）
- TypeScript完全対応

#### 7. **ライブラリ・ユーティリティ** (`/lib`)

```
lib/
├── api-client.ts       # HTTP通信クライアント
├── gameSystem.ts       # ゲームシステム管理
└── hooks/              # 共通カスタムフック
    ├── useAuth.ts      # 認証フック
    ├── useCharacters.ts # キャラクター管理フック
    └── useCharacterSummaries.ts # キャラクター概要フック
```

#### 8. **スタイリング** (`/styles`)

```
styles/
├── globals.css         # グローバルスタイル
theme.ts               # Mantineテーマ設定
utils/
├── generateColors.ts   # カラーパレット生成
└── hoverStyles.tsx     # ホバー効果ユーティリティ
```

## Remixアーキテクチャの活用

### 1. **フルスタック対応**

- サーバーサイドレンダリング（SSR）
- クライアントサイドハイドレーション
- プログレッシブエンハンスメント

### 2. **データローディング**

```typescript
// Loader: サーバーサイドでのデータ取得
export async function loader({ request }: LoaderFunctionArgs) {
  const jwt = getJwtFromRequest(request)
  // 認証状態の確認とデータ取得
}

// Action: フォーム送信・データ変更処理
export async function action({ request }: ActionFunctionArgs) {
  // フォームデータの処理
}
```

### 3. **認証フロー**

```
1. Discord OAuth2認証
2. JWTトークン取得・保存
3. サーバーサイドでの認証状態確認
4. 保護されたリソースへのアクセス
```

## UIアーキテクチャ（Mantine基準）

### 1. **テーマシステム**

```typescript
// カスタムカラーパレット
const theme = createTheme({
  primaryColor: 'main',
  colors: {
    main: mainColor, // プライマリカラー
    accent: accentColor, // アクセントカラー
    sub: subColor, // サブカラー
    comp: complementaryColor, // 補色
    bg: bgColor // 背景色
  }
})
```

### 2. **レスポンシブデザイン**

- モバイルファースト設計
- Mantineのブレークポイント活用
- フレキシブルレイアウト

### 3. **アクセシビリティ**

- ARIA属性の適切な使用
- キーボードナビゲーション対応
- カラーコントラスト配慮

## データフロー

### 1. **サーバーサイドレンダリングフロー**

```
Request → Remix Loader → API Call → Data → SSR → Response
```

### 2. **クライアントサイドインタラクションフロー**

```
User Action → React Component → Zustand Store → API Call → State Update → UI Update
```

### 3. **認証フロー**

```
Login → Discord OAuth → JWT Token → Cookie Storage → API Authorization
```

## 主要な設計パターン

### 1. **Custom Hooks パターン**

- 状態ロジックの再利用
- 副作用の抽象化
- コンポーネントの簡素化

### 2. **Repository パターン**

- API呼び出しの抽象化
- データアクセスの一元化
- モック化によるテスト支援

### 3. **Compound Component パターン**

- 複雑なUIの構造化
- 柔軟なカスタマイズ性
- 再利用性の向上

### 4. **Error Boundary パターン**

- エラーハンドリングの分離
- ユーザーフレンドリーなエラー表示
- アプリケーション安定性の向上

## API通信アーキテクチャ

### 1. **HTTPクライアント設定**

```typescript
// IPv4強制・SSL証明書検証回避（開発環境）
const apiClient = axios.create({
  baseURL: configService.get('server.domain'),
  withCredentials: true
  // IPv4強制でIPv6エラー回避
})
```

### 2. **認証インターセプター**

- JWTトークンの自動付与
- 認証エラーの自動処理
- リクエスト・レスポンスログ

### 3. **エラーハンドリング**

- 統一されたエラーレスポンス処理
- ユーザーフレンドリーなエラーメッセージ
- 自動リトライ機能

## 設定管理

### 環境変数

```typescript
// 主要な環境変数
NODE_ENV              # 実行環境
PORT                  # サーバーポート
DISCORD_SECRET        # Discord OAuth2シークレット
DISCORD_APPLICATIONID # Discord アプリケーションID
SERVER_DOMAIN         # バックエンドAPI URL
HOST_DOMAIN           # フロントエンドURL
```

### 設定の特徴

- 型安全な設定値アクセス
- 環境変数の自動バリデーション
- クライアント・サーバー両環境対応

## 開発・ビルド環境

### 1. **開発環境**

```bash
# 開発サーバー起動（Hot Reload対応）
pnpm run dev

# 型チェック
pnpm run typecheck

# リント・フォーマット
pnpm run lint
pnpm run format
```

### 2. **Vite設定の特徴**

- Hot Module Replacement（HMR）
- IPv4強制でDocker環境対応
- 依存関係の最適化
- ポーリングベースのファイル監視

### 3. **Docker対応**

- 開発環境でのコンテナ使用
- ファイル監視のポーリング設定
- ネットワーク設定の最適化

## テスト戦略

### テスト種別

- **単体テスト**: Jest使用（現在未実装）
- **コンポーネントテスト**: React Testing Library使用予定
- **E2Eテスト**: Playwright使用予定

### モック戦略

- APIクライアントのモック化
- 認証状態のモック化
- 外部サービスのモック化

## パフォーマンス最適化

### 1. **Remixの最適化機能**

- サーバーサイドレンダリング
- プリフェッチング
- 重複排除
- キャッシング

### 2. **バンドル最適化**

- Tree Shaking
- コード分割
- 依存関係の最適化

### 3. **画像・アセット最適化**

- 画像の遅延読み込み
- WebP対応
- CDN活用

## セキュリティ

### 1. **認証セキュリティ**

- JWT トークンの適切な管理
- HTTPS強制
- CSRFプロテクション

### 2. **XSS対策**

- サニタイゼーション
- Content Security Policy
- Trusted Types

### 3. **API セキュリティ**

- CORS設定
- レート制限
- 入力値バリデーション

## 今後の拡張性

### 1. **機能拡張**

- リアルタイム通信（WebSocket）
- プッシュ通知
- オフライン対応（PWA）

### 2. **技術的拡張**

- マイクロフロントエンド化
- GraphQL導入検討
- Edge Computing対応

### 3. **UI/UX改善**

- ダークモード完全対応
- アニメーション強化
- アクセシビリティ向上

---

## 🔧 **リファクタリング優先順位**

### **✅ 完了済み項目**

#### ✅ 1. **セキュリティリスクの修正** `[完了: 2025-07-02]`

```typescript
// ✅ COMPLETED: SSL証明書検証の適切な処理
// 本番環境: 証明書検証を有効化 (rejectUnauthorized: true)
// 開発環境: 証明書検証を無効化（従来通り）

// ✅ COMPLETED: eval()の完全削除
// eval('require')('https') → require('https') に変更
// 安全なloadHttpModules()関数を実装

// 修正内容:
const loadHttpModules = () => {
  if (typeof process !== 'undefined' && process.versions?.node && typeof require !== 'undefined') {
    try {
      return {
        https: require('https'),
        http: require('http')
      }
    } catch (error) {
      return null
    }
  }
  return null
}

// SSL証明書は本番環境で有効化
const agentOptions = {
  rejectUnauthorized: isDevelopment ? false : true, // 本番環境では証明書検証を有効化
  family: 4
}
```

#### ✅ 2. **非推奨ファイルの削除** `[完了: 2025-07-02]`

```bash
# ✅ 削除完了
- app/utils/axiosClient.ts  # 完全に削除済み
- 型定義の移行: TRPGUser → User (~/types)
```

#### ✅ 3. **プロダクション環境でのデバッグログ除去** `[完了: 2025-07-02]`

```typescript
// ✅ COMPLETED: 本番環境でのログ制御
// 開発環境のみログ出力、本番環境では機密情報保護

// 修正内容:
const isDevelopment = !configService.isProduction()

if (isDevelopment) {
  console.log('🔍 JWT Debug Info:', {
    jwtToken: jwtToken ? 'Present' : 'Not found' // トークン値は表示しない
    // その他のデバッグ情報
  })
}

// エラーは本番環境でも記録（ただし機密情報は除外）
console.error('❌ API Error:', {
  message: error.message,
  status: error.response?.status,
  statusText: error.response?.statusText,
  ...(isDevelopment && { data: error.response?.data })
})
```

### **🚨 最高優先度（即座に対応が必要）**

> **現在、最高優先度の項目はありません。**  
> 全てのセキュリティリスクが修正済みです。

### **🔥 高優先度（1週間以内）**

#### 4. **エラーハンドリングの統一**

```typescript
// ❌ 現在: 各所でバラバラなエラーハンドリング
export function CustomError(error: unknown | null | undefined): string {
  // 型安全性が不十分
}

// ✅ 統一されたエラーハンドリング
export class ErrorHandler {
  static handle(error: unknown, context: string): ErrorResponse {
    const message = this.extractMessage(error)

    if (process.env.NODE_ENV === 'development') {
      console.error(`[${context}]`, error)
    }

    return {
      success: false,
      message: 'リクエストの処理中にエラーが発生しました',
      details: process.env.NODE_ENV === 'development' ? message : undefined
    }
  }
}
```

#### 5. **API通信の改善**

```typescript
// ❌ 現在: 型安全性とエラーハンドリングの問題
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: any = { ... }

// ✅ 型安全なAPI通信
interface ApiConfig {
  baseURL: string
  withCredentials: boolean
  headers: Record<string, string>
  httpsAgent?: any
  httpAgent?: any
}

const config: ApiConfig = { ... }
```

#### 6. **認証フローの改善**

```typescript
// ❌ 現在: 複雑で追跡困難な認証処理
// ✅ 改善案: 認証状態の明確な管理
export class AuthManager {
  static async validateToken(request: Request): Promise<AuthResult> {
    try {
      const jwt = this.extractJWT(request)
      if (!jwt) return { isValid: false, user: null }

      const user = await this.verifyToken(jwt)
      return { isValid: true, user }
    } catch (error) {
      return { isValid: false, user: null, error }
    }
  }
}
```

### **⚠️ 中優先度（1ヶ月以内）**

#### 7. **テストカバレッジの向上**

```bash
# ❌ 現在: 「# 未実装」
# ✅ 追加実装が必要
- 認証フローのE2Eテスト（Playwright）
- APIクライアントのユニットテスト
- コンポーネントテスト（React Testing Library）
- エラーハンドリングのテスト
```

#### 8. **Remixローダー・アクションの最適化**

```typescript
// ❌ 現在: エラーハンドリングが不十分
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const response = await apiClient.get('/users', withJwt(jwt))
    return response.data
  } catch (error) {
    // 不十分なエラーハンドリング
  }
}

// ✅ 改善案
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const authResult = await AuthManager.validateToken(request)
    if (!authResult.isValid) {
      return { user: null, isLoggedIn: false }
    }

    const response = await apiClient.get('/users', withJwt(authResult.token))
    return { user: response.data, isLoggedIn: true }
  } catch (error) {
    return ErrorHandler.handle(error, 'user-loader')
  }
}
```

#### 9. **状態管理の改善**

```typescript
// ❌ 現在: テスト用のスライスが残存
// store/counterSlice.ts, store/testSlice.ts

// ✅ 本格的な状態管理の実装
- 認証状態の管理
- キャラクター一覧の状態管理
- UIステート（モーダル、ローディング）の管理
```

### **📋 長期改善項目（3ヶ月以内）**

#### 10. **パフォーマンス最適化**

```typescript
// ❌ 潜在的なパフォーマンス問題
- 不要な再レンダリング
- 大きなバンドルサイズ
- 画像の最適化不足

// ✅ 最適化項目
- React.memo, useMemo, useCallbackの適切な使用
- コード分割の実装
- 画像の遅延読み込み・WebP対応
```

#### 11. **アクセシビリティの向上**

```typescript
// ❌ 現在: 基本的なアクセシビリティ対応のみ
// ✅ 改善項目
;-キーボードナビゲーションの完全対応 - スクリーンリーダーサポート - カラーコントラストの検証 - ARIA属性の充実
```

#### 12. **TypeScript設定の強化**

```json
// ❌ 現在: 一部緩い設定
{
  "strict": true,
  "skipLibCheck": true  // セキュリティリスク
}

// ✅ より厳密な設定
{
  "strict": true,
  "skipLibCheck": false,
  "exactOptionalPropertyTypes": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true
}
```

### **🎯 修正実装方針**

#### **段階的実装アプローチ**

1. **Phase 1**: セキュリティリスクの即座修正
2. **Phase 2**: エラーハンドリング・API通信の改善
3. **Phase 3**: テスト・パフォーマンスの向上
4. **Phase 4**: 長期的なアーキテクチャ改善

#### **リスク管理**

- 各修正は十分なテストを実施
- ユーザーエクスペリエンスへの影響を最小化
- 段階的なデプロイメント

#### **成果指標**

- セキュリティスキャンの結果改善
- エラー率の削減
- パフォーマンススコアの向上
- テストカバレッジの増加

---

## 開発ガイドライン

### アーキテクチャ概念

参考文献: https://github.com/alan2207/bulletproof-react
Remix公式: https://remix.run

### CSSライブラリ

- **メインライブラリ**: Mantine
- **テーマカスタマイズ**: `theme.ts`で調整可能
- **共通コンポーネント**: `app/components/Elements`に配置

### 型定義規則

- **基本方針**: `/features/**/types`に機能別で記載
- **共通型**: `/types`配下で管理
- **API型**: サーバーと共通化を検討

### よく使用するコマンド

```bash
# 開発サーバー起動
pnpm run dev

# テスト実行
# 未実装
pnpm run test
pnpm run test:watch
pnpm run test:coverage

# ビルド
pnpm run build

# 本番サーバー起動
pnpm run start

# 型チェック
pnpm run typecheck

# リント・フォーマット
pnpm run lint
pnpm run format
```

### 重要なポイント

1. **フィーチャードリブン**: 機能別でモジュール分離
2. **型安全性**: TypeScriptの恩恵を最大限活用
3. **SSR活用**: Remixの特徴を生かしたパフォーマンス最適化
4. **コンポーネント設計**: 再利用性とメンテナンス性を重視
5. **状態管理**: 必要最小限で効率的な状態管理
6. **アクセシビリティ**: ユーザビリティを常に考慮

このアーキテクチャにより、TRPG-Remix-Appは拡張性、保守性、パフォーマンスを兼ね備えたモダンなWebアプリケーションとして構築されています。

## セキュリティ要件

### Discord OAuth トークン管理

- **アクセストークン保存**: UserModelにDiscordアクセストークンを暗号化して保存
- **リフレッシュトークン管理**: 自動トークン更新機能の実装
- **有効期限管理**: トークンの有効期限チェックと自動更新
- **暗号化**: データベース保存時の暗号化必須
- **アクセス制御**: トークンへのアクセスを最小限に制限

### セキュリティ対策

1. **暗号化保存**: アクセストークンとリフレッシュトークンの暗号化
2. **有効期限チェック**: API呼び出し前の有効期限確認
3. **自動更新**: リフレッシュトークンによる自動更新機能
4. **ログ制御**: トークン情報のログ出力を禁止
5. **アクセス制御**: 必要最小限のスコープでのみトークン使用

### 実装方針

- UserModelにDiscordトークン関連フィールドを追加
- AuthServiceにトークン管理機能を追加
- トークンの暗号化・復号化ユーティリティを実装
- 自動トークン更新機能を実装

## Discord OAuth 認証フロー

### 認証シーケンス

1. **フロントエンド**: Discord OAuth URLへリダイレクト
2. **Discord**: ユーザー認証後、認証コードを返却
3. **TRPG-SERVER**: 認証コードでアクセストークン・リフレッシュトークンを取得
4. **TRPG-SERVER**: トークンを暗号化してUserModelに保存
5. **フロントエンド**: JWTトークンをクッキーに保存

### セキュリティ実装詳細

#### 1. トークン管理アーキテクチャ

```
フロントエンド (JWT) ←→ TRPG-SERVER ←→ Discord API
                                ↓
                            暗号化されたトークン
                                ↓
                             MongoDB
```

#### 2. トークンライフサイクル

- **認証時**: Discord認証完了後、サーバー側でトークンを暗号化保存
- **API使用時**: サーバー側で自動的にトークン有効性をチェック
- **期限切れ時**: リフレッシュトークンで自動更新
- **エラー時**: 再認証をフロントエンドに要求

#### 3. フロントエンド実装のポイント

##### 認証状態管理

```typescript
// useAuth.ts での認証状態管理例
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    token: null
  })

  // JWT検証とユーザー情報取得
  const validateAuth = async () => {
    try {
      const response = await apiClient.get('/auth/validate-token')
      // 認証成功時の処理
    } catch (error) {
      // 認証失敗時は再ログインを促す
      redirectToLogin()
    }
  }
}
```

##### Discord API連携

```typescript
// Discord Guild一覧取得（サーバー側で自動トークン管理）
const getDiscordGuilds = async (userId: string) => {
  try {
    const response = await apiClient.get(`/auth/guilds/${userId}`, withJwt())
    return response.data.guilds
  } catch (error) {
    // トークン期限切れの場合、サーバー側で自動更新されるか
    // 再認証が必要な場合はエラーが返される
    handleAuthError(error)
  }
}
```

#### 4. エラーハンドリング戦略

##### 認証エラーの分類

1. **JWTエラー**: フロントエンド側のJWTトークンが無効
2. **Discordトークンエラー**: サーバー側のDiscordトークンが無効
3. **ネットワークエラー**: 通信エラー

##### エラー処理フロー

```typescript
const handleAuthError = (error: ApiError) => {
  if (error.status === 401) {
    // 認証エラー: ログイン画面にリダイレクト
    clearAuth()
    redirectToLogin()
  } else if (error.status === 403) {
    // 権限エラー: 適切なエラーメッセージを表示
    showError('アクセス権限がありません')
  } else {
    // その他のエラー: 一般的なエラー処理
    showError('処理中にエラーが発生しました')
  }
}
```

### Discord連携機能

#### 1. 利用可能なDiscord API機能

- **ユーザー情報取得**: プロフィール・アバター情報
- **Guild一覧取得**: ユーザーが参加しているDiscordサーバー
- **権限確認**: 特定のGuildでの権限レベル
- **チャンネル情報**: アクセス可能なチャンネル一覧

#### 2. フロントエンド側の実装例

##### Discord Guild表示コンポーネント

```typescript
const DiscordGuildList: React.FC = () => {
    const [guilds, setGuilds] = useState<DiscordGuild[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    useEffect(() => {
        const fetchGuilds = async () => {
            if (!user?.discordUserId) return

            try {
                const guildList = await getDiscordGuilds(user.discordUserId)
                setGuilds(guildList)
            } catch (error) {
                console.error('Discord Guild取得エラー:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchGuilds()
    }, [user])

    if (loading) return <Loader />

    return (
        <div>
            <h3>参加中のDiscordサーバー</h3>
            {guilds.map(guild => (
                <GuildCard key={guild.id} guild={guild} />
            ))}
        </div>
    )
}
```

#### 3. セキュリティ考慮事項

##### フロントエンド側のセキュリティ対策

1. **JWTの適切な管理**: セキュアクッキーでの保存
2. **CSRF対策**: SameSite属性の適切な設定
3. **XSS対策**: DOMPurifyによるサニタイゼーション
4. **機密情報の保護**: Discordトークンはフロントエンドに送信しない

##### 通信セキュリティ

1. **HTTPS必須**: 本番環境では必ずHTTPS通信
2. **CORS設定**: 適切なOrigin制限
3. **リクエストヘッダー**: AuthorizationヘッダーでのJWT送信

### API連携パターン

#### 1. 認証が必要なAPIの呼び出し

```typescript
// withJwt()ヘルパー関数でJWTを自動付与
const apiCallWithAuth = async (endpoint: string, options = {}) => {
  return await apiClient.get(endpoint, {
    ...options,
    ...withJwt() // Authorization ヘッダーを自動付与
  })
}
```

#### 2. 自動リトライ機能

```typescript
// トークン期限切れ時の自動リトライ
const apiClientWithRetry = axios.create({
  // ... 基本設定
})

apiClientWithRetry.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true

      // 認証情報を再取得してリトライ
      try {
        await refreshAuth()
        return apiClientWithRetry.request(error.config)
      } catch (refreshError) {
        // 再認証に失敗した場合はログイン画面へ
        redirectToLogin()
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  }
)
```

### 今後の拡張計画

#### 1. Discord Bot連携強化

- **リアルタイム通知**: Discord Botからの通知をWebアプリに表示
- **チャンネル連携**: 特定のDiscordチャンネルとの双方向連携
- **ロール管理**: Discordのロールベースアクセス制御

#### 2. セキュリティ強化

- **二要素認証**: Discord + 追加認証の実装
- **セッション管理**: 複数デバイス対応のセッション管理
- **監査ログ**: ユーザーアクションの詳細ログ

#### 3. ユーザビリティ向上

- **オフライン対応**: PWA機能でのオフライン使用
- **通知機能**: ブラウザ通知とDiscord通知の統合
- **設定同期**: Discord設定との自動同期

### 開発・デバッグガイド

#### 1. 認証フローのデバッグ

```typescript
// 開発環境でのデバッグ用ログ
if (process.env.NODE_ENV === 'development') {
  console.log('認証状態:', authState)
  console.log('JWT検証結果:', jwtValidation)
  console.log('Discord API レスポンス:', discordResponse)
}
```

#### 2. エラー監視

- **Sentry**: エラー監視とアラート
- **ログ集約**: 認証関連エラーの集約と分析
- **パフォーマンス監視**: API応答時間の監視

#### 3. テスト戦略

- **ユニットテスト**: 認証ロジックのテスト
- **統合テスト**: Discord API連携のテスト
- **E2Eテスト**: 認証フロー全体のテスト
