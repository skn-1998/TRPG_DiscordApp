# 環境変数管理システム

このディレクトリには、型安全で保守性の高い環境変数管理システムが含まれています。

## 📁 ファイル構成

```
src/config/
├── schemas/
│   └── environment.schema.ts    # 環境変数のスキーマ定義
├── environment.validator.ts     # バリデーションロジック
├── configuration.ts            # アプリケーション設定の生成
├── config.service.ts           # 型安全な設定サービス
├── config.module.ts            # NestJS設定モジュール
└── README.md                   # このファイル
```

## 🚀 使用方法

### 1. 環境変数の定義

`.env` ファイルに必要な環境変数を設定：

```bash
# 必須環境変数
TOKEN=your_discord_token
DISCORD_APPLICATIONID=your_app_id
DISCORD_SECRET=your_discord_secret
JWT_SECRET=your_jwt_secret
MONGODB_URI=mongodb://localhost:27017/trpg

# オプション環境変数（デフォルト値あり）
NODE_ENV=development
PORT=3000
GUILDID=your_guild_id
FRONTEND_URL=http://localhost:5173
CHARACTER_CATEGORY=キャラクター
DICE_ROLL_CATEGORY=ダイスロールチャンネル
```

### 2. サービスでの使用

```typescript
import { Injectable } from '@nestjs/common'
import { AppConfigService } from 'src/config/config.service'

@Injectable()
export class ExampleService {
  constructor(private readonly configService: AppConfigService) {}

  someMethod() {
    // 型安全にアクセス（string型が推論される）
    const token = this.configService.get('discord.token')
    const port = this.configService.get('app.port') // number型
    const isLogging = this.configService.get('database.logging') // boolean型
  }
}
```

### 3. 直接バリデーション

```typescript
import { EnvironmentValidator } from 'src/config/environment.validator'

// 環境変数を検証
const validation = EnvironmentValidator.validate()

if (!validation.success) {
  console.error('環境変数エラー:')
  console.error(EnvironmentValidator.formatErrors(validation.errors!))
  process.exit(1)
}

// 型安全にアクセス
const env = validation.data!
console.log(`サーバーポート: ${env.PORT}`)
```

## 🔧 新しい環境変数の追加

### 1. スキーマに追加

`schemas/environment.schema.ts` を編集：

```typescript
export interface EnvironmentSchema {
  // 既存の変数...
  
  // 新しい変数を追加
  NEW_VARIABLE: string
  OPTIONAL_VARIABLE?: number
}

// デフォルト値を追加（オプション変数の場合）
export const DEFAULT_VALUES: Partial<EnvironmentSchema> = {
  // 既存のデフォルト値...
  OPTIONAL_VARIABLE: 42
}

// 必須変数の場合はリストに追加
export const REQUIRED_VARIABLES: (keyof EnvironmentSchema)[] = [
  // 既存の必須変数...
  'NEW_VARIABLE'
]
```

### 2. バリデーターに追加

`environment.validator.ts` の `validate` メソッドに処理を追加：

```typescript
// 新しい変数のパース
result.NEW_VARIABLE = TYPE_CONVERTERS.string(env.NEW_VARIABLE)
result.OPTIONAL_VARIABLE = TYPE_CONVERTERS.number(env.OPTIONAL_VARIABLE, DEFAULT_VALUES.OPTIONAL_VARIABLE)
```

### 3. 設定に追加

`configuration.ts` の `generateAppConfig` に追加：

```typescript
export const generateAppConfig = () => {
  const env = getValidatedEnvironment()

  return {
    // 既存の設定...
    
    // 新しいセクションまたは既存セクションに追加
    newSection: {
      newVariable: env.NEW_VARIABLE,
      optionalVariable: env.OPTIONAL_VARIABLE!
    }
  }
}
```

## ✅ 特徴

- **型安全性**: TypeScriptの型システムを活用
- **バリデーション**: 起動時に環境変数を検証
- **デフォルト値**: オプション変数のデフォルト値サポート
- **エラーハンドリング**: 詳細なエラーメッセージ
- **キャッシュ**: 検証済み環境変数のキャッシュ
- **後方互換性**: 既存コードとの互換性を維持

## 🔍 デバッグ

環境変数の問題をデバッグする場合：

```typescript
// 生の環境変数を確認
const rawValue = this.configService.getRaw('TOKEN')
console.log('Raw TOKEN:', rawValue)

// バリデーション結果を確認
const validation = EnvironmentValidator.validate()
console.log('Validation result:', validation)
```

## 🚨 エラー例

```bash
🚨 環境変数の検証に失敗しました:
❌ TOKEN: 必須環境変数 TOKEN が設定されていません
❌ PORT: PORTは1-65535の範囲で指定してください (現在の値: 99999)
❌ FRONTEND_URL: FRONTEND_URLは有効なURLを指定してください (現在の値: invalid-url)
```

## 📝 マイグレーション

既存のコードを新しいシステムに移行する場合：

```typescript
// 古い方法 ❌
const token = process.env.TOKEN

// 新しい方法 ✅
const token = this.configService.get('discord.token')
``` 