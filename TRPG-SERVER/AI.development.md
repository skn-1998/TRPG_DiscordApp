# TRPG-SERVER 開発・運用ドキュメント

## 📋 **ドキュメント概要** **[作成日: 2025-01-09]**

このドキュメントでは、TRPG-SERVERの開発環境、運用、パフォーマンス、セキュリティ、リファクタリング履歴などの開発・運用に関する詳細情報を説明します。

**関連ドキュメント**:

- **[AI.md](./AI.md)** - プロジェクト概要
- **[AI.architecture.md](./AI.architecture.md)** - システムアーキテクチャ・技術スタック
- **[AI.test.md](./AI.test.md)** - テスト戦略・カバレッジ分析
- **[AI.domain.md](./AI.domain.md)** - ドメイン駆動設計・イベント駆動アーキテクチャ

---

## 🛠️ **開発環境**

### **開発ツール**

- **言語**: TypeScript (100% 型安全性達成)
- **Hot Reload**: Nest CLI + nodemon
- **コード品質**: ESLint + Prettier
- **Git フック**: Husky + lint-staged

### **開発コマンド**

```bash
# 開発サーバー起動
pnpm run start:dev

# ビルド
pnpm run build

# テスト実行
pnpm run test
pnpm run test:watch
pnpm run test:cov

# E2Eテスト
pnpm run test:e2e

# Lint & Format
pnpm run lint
pnpm run format

# 静的解析（リファクタ計画用・advisory。詳細は AI.refactor.md 2026-07-26）
pnpm run refactor:large-files:analyze -- --out .tmp/refactor/large-files.json
pnpm run check:circular
```

### **IDE設定**

- **推奨IDE**: VS Code
- **必須拡張**:
  - TypeScript Hero
  - ESLint
  - Prettier
  - Thunder Client (API テスト)

---

## 🐳 **本番環境・Docker**

### **Docker構成**

```dockerfile
# Dockerfile (例)
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY .env.production .env

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### **環境別設定**

```yaml
# docker-compose.yml
version: '3.8'
services:
  trpg-server:
    build: .
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - MONGODB_URI=${MONGODB_URI}
      - TOKEN=${DISCORD_TOKEN}
    depends_on:
      - mongodb

  mongodb:
    image: mongo:7
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

### **デプロイフロー**

1. GitHub Actions CI/CD
2. Docker イメージビルド
3. 本番環境デプロイ
4. ヘルスチェック

---

## 📊 **パフォーマンス最適化**

### 1. **データベース最適化**

#### **MongoDB クエリ最適化**

```typescript
// インデックス設定例
// users コレクション
db.users.createIndex({ discordId: 1 }, { unique: true })
db.users.createIndex({ email: 1 }, { sparse: true })

// characters コレクション
db.characters.createIndex({ userId: 1, name: 1 })
db.characters.createIndex({ channelId: 1 }, { unique: true })

// dice-roll-texts コレクション
db['dice-roll-texts'].createIndex({ channelId: 1, createdAt: -1 })
```

#### **接続プール設定**

```typescript
// database.module.ts
MongooseModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    uri: configService.get<string>('MONGODB_URI'),
    maxPoolSize: 10, // 最大接続数
    minPoolSize: 2, // 最小接続数
    maxIdleTimeMS: 30000, // アイドルタイムアウト
    serverSelectionTimeoutMS: 5000 // サーバー選択タイムアウト
  }),
  inject: [ConfigService]
})
```

### 2. **Discord Bot最適化**

#### **レート制限対応**

```typescript
// Discord APIレート制限対応
export class RateLimitHandler {
  private static requestQueue = new Map<string, Date[]>()

  static async checkRateLimit(endpoint: string): Promise<void> {
    const now = new Date()
    const requests = this.requestQueue.get(endpoint) || []

    // 1分間のリクエスト履歴をクリーンアップ
    const validRequests = requests.filter((req) => now.getTime() - req.getTime() < 60000)

    if (validRequests.length >= 50) {
      // Discord API制限
      const oldestRequest = validRequests[0]
      const waitTime = 60000 - (now.getTime() - oldestRequest.getTime())
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }

    validRequests.push(now)
    this.requestQueue.set(endpoint, validRequests)
  }
}
```

#### **非同期処理最適化**

```typescript
// バッチ処理による効率化
export class DiscordBatchProcessor {
  private messageQueue: DiscordMessage[] = []
  private batchTimeout: NodeJS.Timeout

  async queueMessage(message: DiscordMessage): Promise<void> {
    this.messageQueue.push(message)

    if (this.messageQueue.length >= 10) {
      await this.processBatch()
    } else {
      this.scheduleBatchProcessing()
    }
  }

  private async processBatch(): Promise<void> {
    const batch = this.messageQueue.splice(0, 10)
    await Promise.allSettled(batch.map((msg) => this.sendMessage(msg)))
  }
}
```

### 3. **メモリ管理**

#### **接続状態の管理**

```typescript
export class ConnectionManager {
  private connections = new Map<string, Connection>()

  async getConnection(key: string): Promise<Connection> {
    let connection = this.connections.get(key)

    if (!connection || connection.readyState !== 1) {
      connection = await this.createConnection()
      this.connections.set(key, connection)
    }

    return connection
  }

  async cleanup(): Promise<void> {
    for (const [key, connection] of this.connections) {
      await connection.close()
      this.connections.delete(key)
    }
  }
}
```

---

## 🔐 **セキュリティ強化**

### 0. **Phase S セキュリティ対応** `[完了: 2026-05-31]`（ブランチ refactor/security-phase-s）

詳細は `AI.refactor.md` / `docs/refactor/refactor-phase-S-plan.md`。要点：

- **機密ログ除去（S1）**: `auth.controller.ts` / `auth.service.ts` から JWT・Authorization ヘッダ・
  全ヘッダ・Discord access/refresh token・**client_secret**・プロフィール全体を出力していた
  console.log / debug を全削除。login レスポンスの `token: jwt` はフロント依存のため維持（別 Issue）。
- **機密 env 検証強化（S2）**: `JWT_SECRET` / `DISCORD_TOKEN_ENCRYPTION_KEY` に最小長32文字検証、
  `REDIRECT_URL` の URL 形式検証を追加（起動時 fail-fast）。エラー出力に機密値は含めない。
  - ⚠️ **運用注意**: 既存 env の秘密が32文字未満だと起動失敗する。特に `DISCORD_TOKEN_ENCRYPTION_KEY`
    の値変更は既存 DB 暗号化トークンの復号不能を招くため移行計画が必要。
- **crypto 鍵集約（S2）**: `crypto.util.ts` を純粋関数化（process.env 直読み廃止）し、鍵取得は
  `CryptoService`（`core/shared`, AppConfigService 注入）へ集約。暗号アルゴリズム/鍵導出は不変＝後方互換あり。
- **CORS 一本化（S3）**: no-op の `cors.middleware.ts` を削除、CORS を `main.ts` の `enableCors` に一本化。
  `frontendUrl` 空時 fail-fast で origin 確定値化（過剰許可 + credentials:true を防止）。
- **認証導線の Guard 一本化（S4）**: `character`/`user` コントローラの `req.headers['user']` 無検証
  `JSON.parse` フォールバックを撤去し、`JwtAuthGuard` 由来の `req.user`（JwtTokenPayload）に統一。

### 1. **認証セキュリティ**

#### **JWT強化**

```typescript
// 強化されたJWT設定
@Injectable()
export class JwtConfigService implements JwtOptionsFactory {
  createJwtOptions(): JwtModuleOptions {
    return {
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '1h', // 短期有効期限
        issuer: 'trpg-server', // 発行者
        audience: 'trpg-client', // 対象者
        algorithm: 'HS256' // 署名アルゴリズム
      },
      verifyOptions: {
        issuer: 'trpg-server',
        audience: 'trpg-client',
        algorithms: ['HS256']
      }
    }
  }
}
```

#### **リフレッシュトークン**

```typescript
export class AuthService {
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const payload = await this.validateRefreshToken(refreshToken)

    // リフレッシュトークンの一度限り使用
    await this.invalidateRefreshToken(refreshToken)

    return {
      accessToken: await this.generateAccessToken(payload),
      refreshToken: await this.generateRefreshToken(payload)
    }
  }
}
```

### 2. **API セキュリティ**

#### **入力値検証強化**

```typescript
// 統一バリデーション
export class SecurityValidator {
  static sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .trim()
  }

  static validateFileUpload(file: Express.Multer.File): boolean {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
    const maxSize = 5 * 1024 * 1024 // 5MB

    return allowedTypes.includes(file.mimetype) && file.size <= maxSize
  }
}
```

#### **レート制限実装**

```typescript
// API レート制限
@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  private requestCounts = new Map<string, number[]>()

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest()
    const clientIp = request.ip
    const now = Date.now()

    const requests = this.requestCounts.get(clientIp) || []
    const recentRequests = requests.filter((time) => now - time < 60000) // 1分

    if (recentRequests.length >= 100) {
      // 1分間100リクエスト制限
      throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS)
    }

    recentRequests.push(now)
    this.requestCounts.set(clientIp, recentRequests)

    return true
  }
}
```

### 3. **Discord Bot セキュリティ**

#### **権限チェック強化**

```typescript
export class DiscordPermissionGuard {
  static async validatePermissions(
    interaction: ChatInputCommandInteraction,
    requiredPermissions: PermissionFlagsBits[]
  ): Promise<boolean> {
    const member = interaction.member as GuildMember

    if (!member) return false

    return requiredPermissions.every((permission) => member.permissions.has(permission))
  }

  static async validateChannelAccess(userId: string, channelId: string): Promise<boolean> {
    // チャンネルアクセス権限の詳細チェック
    const channel = await client.channels.fetch(channelId)
    if (!channel) return false

    const permissions = channel.permissionsFor(userId)
    return permissions?.has(['ViewChannel', 'SendMessages']) ?? false
  }
}
```

---

## 🔧 **リファクタリング完了履歴**

### **✅ 完了済み主要項目**

#### ✅ 1. **TypeScript型安全性 完全達成** `[完了: 2025-01-02]`

```typescript
// 🎯 全フェーズ完了結果
Phase 1: 基本型定義・JWT設定 (84個→29個) ✅
Phase 2: Discord.js型問題 (29個→20個) ✅
Phase 3: インデックスシグネチャ (20個→13個) ✅
Phase 4: Character nullチェック (13個→9個) ✅
Phase 5: 暗黙的any型 (9個→5個) ✅
Phase 6: string|undefined型 (5個→4個) ✅
Phase 7: createdTimestamp null (4個→2個) ✅
Phase 8: 最終残存エラー (2個→0個) ✅

// 🏆 最終結果: 100%完全解決達成
// ビルド状況: 正常完了 (Exit code: 0)
```

#### ✅ 2. **エラーハンドリング統一** `[完了: 2025-01-02]`

```typescript
// 統一エラーハンドラー実装
export class ErrorHandler {
  static handleHttpError(error: unknown, context: string): ErrorResponse
  static handleDiscordError(error: unknown, context: string): string
  static handleDiscordCommandError(interaction: CommandInteraction, error: unknown): Promise<void>
}

// 実装完了箇所
const completedAreas = [
  'src/domains/auth/auth.controller.ts',
  'src/domains/auth/services/auth.service.ts',
  'src/discord/events/button/character-dice-buttons.service.ts',
  'All Commands layer services'
]
```

#### ✅ 3. **DTO標準化による設計一貫性** `[完了: 2025-01-05]`

```typescript
// 基底クラス体系確立
BaseDto           // 共通フィールド (createdAt, updatedAt)
├── IdentifiableDto  // ID を持つ DTO
└── DiscordDto       // Discord 関連フィールド

// 命名規則統一
'PartialInputCharacterDto' → 'CharacterInputDto'
'PartialInputDiceRollChannelDto' → 'DiceRollChannelInputDto'
'PartialInputDiceRollTextDto' → 'DiceRollTextInputDto'

// ValidationUtils体系
ValidationUtils.requiredString('フィールド名')
ValidationUtils.optionalString('フィールド名')
ValidationUtils.array('フィールド名')
ValidationUtils.date('フィールド名')
```

#### ✅ 4. **イベント駆動アーキテクチャ移行** `[完了: 2025-01-05]`

```typescript
// TypedEventService実装
export interface AppEventContracts {
  'character.search.request': CharacterSearchRequestPayload
  'character.search.response': CharacterSearchResponsePayload
  'dice-roll.execute.request': DiceRollExecuteRequestPayload
  // ... 他のイベント契約
}

// Commands層統一化
const completedServices = [
  'CharacterThreadService', // ✅ BaseCommandService継承
  'DiceFromContextMenuService', // ✅ 統一エラーハンドリング
  'RollDiceService', // ✅ 統一ログシステム
  'DiceResultService', // ✅ 型安全なインタラクション処理
  'UserDefinedDiceService', // ✅ AutoComplete統一処理
  'SelectGameSystemService' // ✅ 完全統一パターン
]

// 循環依存: 0個 (完全解決)
```

#### ✅ 5. **Winston設定改善** `[完了: 2025-01-05]`

```typescript
// 新環境変数
LOG_LEVEL             # ログレベル (debug, info, warn, error)
LOG_FILE_ENABLE       # ファイルログの有効/無効
LOG_CONSOLE_ENABLE    # コンソールログの有効/無効
LOG_FILE_PATH         # ログファイルのパス
LOG_ERROR_FILE_PATH   # エラーログファイルのパス

// 改善効果
// - 設定の集中管理と型安全性の確保
// - 環境別設定の柔軟な管理
// - app.module.tsからの設定分離完了
```

#### ✅ 6. **循環依存完全解決** `[完了: 2025-01-09]`

```typescript
// 🎯 解決対象
CharacterModule ⇔ DiscordModule の循環依存
EventsModule ⇔ DiscordModule の循環依存

// 🛠️ 実装内容
const resolutionApproach = {
  // 1. イベント駆動アーキテクチャ導入
  eventDriven: [
    'Discord Character Embed更新イベント契約追加',
    'TypedEventEmitter によるDiscord操作要求',
    'DiscordEmbedHandlerService でイベント処理'
  ],

  // 2. 直接依存の削除
  dependencyRemoval: [
    'CharacterService → DiscordService 依存削除',
    'EventsController → CharacterService 依存削除',
    'CharacterDiceButtonsService → CharacterService 依存削除',
    'forwardRef() インジェクション完全撤廃'
  ],

  // 3. 新規サービス作成
  newServices: [
    'DiscordEmbedHandlerService: Discord Embed更新専用',
    'TypedEventService 活用による疎結合実現'
  ]
}

// 🏆 解決成果
const achievements = {
  buildStatus: 'SUCCESS (npm run build)',
  compilationErrors: 0,
  circularDependencyWarnings: 0,
  moduleLoadingStatus: 'NORMAL',
  architecturalImprovement: 'イベント駆動への移行完了',
  maintainabilityScore: '大幅向上'
}

// 📋 残存課題（低優先度）
const remainingTasks = [
  'character-dice-buttons.service.ts の完全イベント駆動化',
  '削除されたチャンネル作成ハンドラーの復旧',
  '一時コメントアウト機能の段階的復旧'
]
```

#### ✅ 7. **ESモジュール/CommonJS設定混在問題の解決** `[完了: 2025-11-08]`

```typescript
// ⚠️ 発生した問題
const issue = {
  error: 'ReferenceError: exports is not defined in ES module scope',
  cause: 'package.json の "type": "module" と tsconfig.json の "module": "commonjs" の矛盾',
  impact: 'pnpm run start:dev 実行時にランタイムエラー発生'
}

// 🛠️ 実装内容
const resolutionApproach = {
  modification: 'package.json から "type": "module" を削除',
  reason: 'NestJSプロジェクトではCommonJS形式が標準',
  result: 'TypeScriptコンパイル設定（CommonJS）と実行環境の統一'
}

// 🏆 解決成果
const achievements = {
  buildStatus: 'SUCCESS (pnpm run build)',
  applicationStatus: 'RUNNING (pnpm run start:dev)',
  compilationErrors: 0,
  circularDependencies: '1個（AuthDomain⇔UserDomain: 許容済み）',
  moduleResolution: 'NORMAL'
}

// 📊 検証結果
const verification = {
  build: '✅ ビルド成功',
  startup: '✅ アプリケーション正常起動',
  circularCheck: '✅ 許容済み循環参照のみ検出',
  moduleSystem: '✅ CommonJS形式で統一'
}
```

#### ✅ 8. **dice-resultコマンドのキャラクター選択機能有効化** `[完了: 2025-11-08]`

```typescript
// 🎯 実装内容
const implementation = {
  target: 'DiceRollPaginationService',
  feature: 'キャラクター選択メニュー（PHASE3機能）',
  approach: 'イベント駆動アーキテクチャによる循環依存回避'
}

// 🛠️ 実施した変更
const changes = {
  typedEventServiceInjection: {
    file: 'dice-roll-pagination.service.ts:58-61',
    description: 'TypedEventServiceをコンストラクタ注入',
    purpose: 'イベント駆動でCharacter情報を取得'
  },
  fetchCharactersMethod: {
    file: 'dice-roll-pagination.service.ts:471-502',
    description: 'character.findByChannelId.requestedイベントでキャラクター取得',
    features: ['イベント発行と待機', 'キャッシュ保存（TTL: 1分）', 'エラーハンドリング']
  },
  addCharacterSelectMenuMethod: {
    file: 'dice-roll-pagination.service.ts:393-450',
    description: 'キャラクター選択UIの生成',
    features: [
      '「全て表示」オプション',
      'キャラクター個別選択（最大24件）',
      'デフォルト値の設定',
      'エラー時のグレースフルデグラデーション'
    ]
  },
  characterNameDisplay: {
    files: ['106-113行', '118-127行', '144-150行', '193-209行'],
    description: 'キャラクター名表示の改善',
    improvement: 'キャッシュからキャラクター名を取得してID表示を置換'
  }
}

// 🏆 設計上の成果
const architecturalAchievements = {
  circularDependencyAvoidance: {
    before: 'DiceRollPaginationService → CharacterService（循環依存リスク）',
    after: 'TypedEventService経由のイベント駆動通信',
    benefit: '依存関係の分離と保守性向上'
  },
  eventDrivenPattern: {
    requestEvent: 'character.findByChannelId.requested',
    completedEvent: 'character.findByChannelId.completed',
    handler: 'CharacterFindByChannelIdRequestedHandler',
    verification: '✅ イベントハンドラー登録確認'
  },
  caching: {
    pageCache: 'TTL: 5秒（ダイスロール間隔に合わせて短く設定）',
    characterCache: 'TTL: 1分（キャラクター情報は頻繁に変わらない）',
    benefit: 'パフォーマンス最適化とDB負荷軽減'
  }
}

// 📊 検証結果
const verification = {
  build: '✅ ビルド成功（0 errors）',
  circularDependency: '✅ 許容済み循環参照のみ（AuthDomain⇔UserDomain）',
  startup: '✅ アプリケーション正常起動',
  discord: '✅ Discordボット接続成功（TRPG_BOT#8068）',
  eventHandler: '✅ character.findByChannelId.requestedハンドラー登録完了',
  command: '✅ dice-resultコマンド登録完了'
}

// 💡 技術的な学び
const learnings = {
  eventDrivenArchitecture: 'イベント駆動アーキテクチャによる循環依存の回避',
  gracefulDegradation: 'キャラクター情報取得失敗時もボタンのみ表示',
  cacheStrategy: '適切なTTL設定によるパフォーマンスとデータ鮮度のバランス',
  characterNameDisplay: 'キャッシュ活用による一貫したキャラクター名表示'
}
```

---

## 🚀 **今後の改善計画**

### **⚠️ 中優先度（1-3ヶ月以内）**

#### 1. **テストカバレッジ向上**

> ℹ️ **注記**: 以下の数値（43.99%）は初期スナップショット。最新の評価は [AI.test.md](./AI.test.md)（全体テスタビリティ評価マップ）を正本とする。

- **目標**: 43.99% → 60%以上
- **対象**: 認証フローE2E、Discord Bot統合テスト
- **戦略**: 大ファイル攻略、Controller層テスト拡充

#### 2. **パフォーマンス最適化**

```typescript
// 実装予定項目
const performanceImprovements = {
  database: ['MongoDB クエリ最適化', 'インデックス戦略見直し', 'アグリゲーションパイプライン最適化'],
  discord: ['Discord API レート制限改善', 'Webhook活用によるパフォーマンス向上', 'バッチ処理導入'],
  memory: ['メモリリーク検証', 'GCチューニング', 'リソース使用量監視']
}
```

#### 3. **セキュリティ強化**

```typescript
// セキュリティ改善項目
const securityEnhancements = {
  authentication: ['JWT トークンのより厳密な検証', 'リフレッシュトークン実装', '多要素認証準備'],
  api: ['入力値サニタイゼーション強化', 'APIレート制限実装', 'CSRF対策強化'],
  discord: ['Discord Bot権限の最小化', 'チャンネルアクセス制御強化', 'コマンド実行権限チェック']
}
```

### **📊 次期優先度項目（1-2ヶ月以内）**

#### 1. **循環依存解決の完全化** `[継続改善]`

```typescript
// 残存する改善点
const completionTasks = {
  eventDriven: [
    'CharacterDiceButtonsService の完全イベント駆動実装',
    'チャンネル作成ハンドラーの復旧',
    '一時的なコメントアウト機能の段階的復旧'
  ],
  validation: ['イベント駆動処理の統合テスト追加', 'パフォーマンス影響の測定', 'エラーハンドリングの完全性確認']
}
```

### **📈 長期的改善（3-6ヶ月）**

#### 1. **マイクロサービス化準備**

- イベント駆動アーキテクチャ基盤の活用
- サービス境界の明確化（既存のモジュール分離を活用）
- API Gateway導入検討
- Docker Compose → Kubernetes移行

#### 2. **可観測性向上**

```typescript
// 監視・ログ改善
const observabilityPlan = {
  monitoring: ['Prometheus + Grafana導入', 'APM（Application Performance Monitoring）', 'リアルタイムアラート'],
  logging: ['構造化ログ強化', 'ログ分析システム（ELK Stack）', 'トレーシング実装'],
  metrics: ['ビジネスメトリクス収集', 'ユーザー行動分析', 'パフォーマンス指標ダッシュボード']
}
```

#### 3. **開発体験向上**

- Hot Reload最適化
- デバッグ環境改善
- 開発用ツール拡充

---

## 📋 **運用チェックリスト**

### **デプロイ前チェック**

- [ ] 全テストが通過している
- [ ] TypeScriptエラーが0個
- [ ] ESLintエラーが0個
- [ ] セキュリティスキャン完了
- [ ] パフォーマンステスト実行
- [ ] バックアップ取得完了

### **デプロイ後チェック**

- [ ] アプリケーション正常起動
- [ ] データベース接続確認
- [ ] Discord Bot接続確認
- [ ] ヘルスチェックエンドポイント応答
- [ ] ログ出力正常
- [ ] 主要機能動作確認

### **定期メンテナンス**

- **毎日**: ログ監視、エラー率チェック
- **毎週**: パフォーマンス指標確認、セキュリティアップデート
- **毎月**: バックアップテスト、依存関係更新
- **四半期**: セキュリティ監査、パフォーマンステスト

---

## 🔧 **リファクタリング要素分析** **[分析日: 2025-01-09]**

### 📊 **コードベース概要**

> ℹ️ **注記**: 以下の数値（43.99% 等）は初期スナップショット。最新の評価は [AI.test.md](./AI.test.md)（全体テスタビリティ評価マップ）を正本とする。

- **総ファイル数**: 150個のTypeScriptファイル
- **テストファイル数**: 31個
- **テストカバレッジ**: 43.99% (理想: 60%以上)

---

### 🔥 **高優先度リファクタリング項目**

#### ✅ **1. 循環依存の解決** `[完了: 2025-01-09]`

```typescript
// 解決済み問題箇所
CharacterModule ⇔ DiscordModule ✅ 完全解決
EventsModule ⇔ DiscordModule ✅ 完全解決

// 実装した解決策
✅ TypedEventService によるイベント駆動アーキテクチャ
✅ DiscordEmbedHandlerService 新規作成
✅ forwardRef() インジェクション完全削除
✅ Discord Character Embed更新イベント契約追加

// 解決結果
✅ ビルド成功 (npm run build)
✅ TypeScript コンパイル成功
✅ 循環依存警告 0件
✅ モジュール読み込み正常
```

#### **2. 大きすぎるサービスクラスの分割** `[緊急]`

- **DiscordService**: 882行 → 3つのサービスに分割
  - `InteractionHandler` (インタラクション処理)
  - `GuildManager` (サーバー管理)
  - `ChannelManager` (チャンネル管理)
- **CharacterDiceButtonsService**: 824行 → UI/ロジック分離
- **CharacterChannelService**: 542行 → 責務分離

#### **3. エラーハンドリング統一** `[重要]`

```typescript
// 現在の問題
- discord.utils.ts の handleError関数
- /src/utils/error-handler.ts の ErrorHandlerクラス
- 各サービスでの個別try-catch実装

// 改善策
統一されたErrorHandlerService + カスタム例外クラス
```

#### **4. 重複・冗長コードの統合** `[重要]`

```bash
# 重複ファイル
discord.util.ts + discord.utils.ts → discord-utils.ts
dice.ts + dice.util.ts + table-dice.util.ts → dice-core.ts + dice-table.ts
```

#### **5. テストカバレッジ向上** `[重要]`

**テストが不足している主要ファイル**:

- `discord.service.ts` (882行) - テストなし
- `character-dice-buttons.service.ts` (824行) - テストなし
- `dice-roll-pagination.service.ts` (531行) - テストなし

---

### ⚠️ **中優先度リファクタリング項目**

#### **1. レイヤー違反の修正**

```typescript
// 問題: ドメインサービスからインフラ直接参照
// character.service.ts
@Inject(forwardRef(() => DiscordService))

// 改善策: Repository Pattern + Domain Event
```

#### **2. 設定管理の一元化**

```typescript
// 問題: ハードコードされた値の多用
private readonly MIN_UPDATE_INTERVAL = 2000

// 改善策: 環境変数/設定ファイルに移行
```

#### **3. 命名規則の統一**

- `configuration.ts` vs `config.service.ts` → `app-config.service.ts`
- インターフェース命名の統一

---

### 📈 **低優先度改善項目**

#### **1. パフォーマンス最適化**

```typescript
// Discord キャッシュの最適化
const categories = guild.channels.cache.filter(...)

// ページネーション処理の抽象化
```

#### **2. メモリリーク対策**

```typescript
// Map構造の定期クリーンアップ
private readonly lastEmbedUpdateTime = new Map<string, number>()
private readonly locks = new Map<string, boolean>()
```

---

### 🚀 **リファクタリング実行計画**

#### **Week 1-2: 緊急対応**

1. 循環依存解決 (最重要)
2. DiscordService分割
3. エラーハンドリング統一

#### **Week 3-4: 品質改善**

1. 重複コード統合
2. テスト追加 (主要ビジネスロジック)
3. 設定管理一元化

#### **Month 2: 設計改善**

1. レイヤー違反修正
2. 命名規則統一
3. パフォーマンス最適化

---

### 📋 **リファクタリング効果実績**

#### **✅ 達成済み改善**

- **保守性**: 大幅向上 ✅ (循環依存解決完了)
- **テスト容易性**: 向上 ✅ (依存関係完全整理)
- **拡張性**: 大幅向上 ✅ (イベント駆動アーキテクチャ)
- **安定性**: 向上 ✅ (forwardRef削除、型安全性確保)
- **開発効率**: 向上 ✅ (ビルドエラー0、コンパイル成功)

#### **✅ リスク軽減実績**

- ✅ 循環依存による意図しない副作用の完全防止
- ✅ モジュール間の疎結合化による影響範囲の明確化
- ✅ TypedEventService による型安全なイベント通信

#### **📊 測定可能な成果**

```typescript
const improvements = {
  circularDependencies: '2個 → 0個 (100%削減)',
  forwardRefInjections: '複数箇所 → 0箇所 (完全削除)',
  buildStatus: 'エラー有り → SUCCESS',
  architecturalPattern: '直接依存 → イベント駆動',
  maintainabilityScore: '中 → 高'
}
```

---

## ローカル起動: Atlas 接続（Windows / Node SRV）

**[2026-08-15]** ホスト上の `pnpm run start:dev` が `querySrv ECONNREFUSED _mongodb._tcp.cluster0.*.mongodb.net` で落ちる場合、クラスタ障害ではなく **Node の DNS が `127.0.0.1:53` を見て SRV 照会に失敗している**ことが多い。Windows の `nslookup` と Atlas CLI（HTTPS）は通る。

回避: `MONGODB_URI` を `mongodb+srv://` ではなく Atlas CLI の `standard` 文字列（ホスト直指定の `mongodb://`）にする。

```powershell
atlas auth whoami
atlas clusters ls
atlas clusters connectionStrings describe Cluster0 -o json
atlas accessLists ls
```

`standard` に既存の DB ユーザー／パスワードを入れて `.env` の `MONGODB_URI` を差し替える。IP Access List に現在のグローバル IP が無い場合は `atlas accessLists create --currentIp`。

---

## 🔗 **関連リソース**

### **開発ツール**

- **API テスト**: Thunder Client, Postman
- **データベース管理**: MongoDB Compass
- **ログ監視**: Winston + Morgan
- **コード品質**: SonarQube (将来導入予定)

### **外部サービス**

- **Discord Developer Portal**: Bot設定・管理
- **MongoDB Atlas**: データベースホスティング
- **GitHub Actions**: CI/CD パイプライン
- **Docker Hub**: コンテナイメージ管理

---

_このドキュメントは開発・運用に関する詳細情報を提供します。アーキテクチャについては [AI.architecture.md](./AI.architecture.md) を、プロジェクト概要については [AI.md](./AI.md) をご参照ください。_
