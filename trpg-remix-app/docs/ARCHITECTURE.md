# 🛡️ TRPG Remix App - Bulletproof Architecture

このプロジェクトは[Bulletproof React](https://github.com/alan2207/bulletproof-react)の概念に基づいて構築されています。

## 📁 プロジェクト構造

```
app/
├── lib/                    # 共通ライブラリ
│   ├── api-client.ts      # 統一されたAPIクライアント
│   ├── types.ts           # 共通型定義
│   └── hooks/             # カスタムフック
│       ├── useAuth.ts
│       ├── useCharacters.ts
│       └── index.ts
├── features/              # 機能別モジュール
│   ├── auth/
│   │   ├── api/          # API通信層
│   │   │   ├── auth.service.ts
│   │   │   └── authLoader.tsx
│   │   ├── components/   # UIコンポーネント
│   │   │   └── login.tsx
│   │   └── index.ts      # 統一されたexports
│   ├── character/
│   │   ├── api/
│   │   │   └── character.service.ts
│   │   ├── components/
│   │   │   └── characterCreate.tsx
│   │   └── index.ts
│   └── users/
│       ├── api/
│       │   └── users.service.ts
│       ├── components/
│       │   └── userPageNavigation.tsx
│       └── index.ts
├── components/            # 共通UIコンポーネント
├── routes/               # Remixルート
└── utils/               # ユーティリティ関数
```

## 🎯 主要な原則

### 1. **関心の分離**

- **API層**: サーバー通信のみを担当
- **コンポーネント層**: UI表示とユーザーインタラクションのみを担当
- **フック層**: 状態管理とビジネスロジックを担当

### 2. **機能別モジュール化**

各機能（auth、character、users）は独立したモジュールとして構成：

```typescript
features/
└── [feature-name]/
    ├── api/           # サーバー通信
    ├── components/    # UIコンポーネント
    ├── hooks/         # カスタムフック（必要に応じて）
    └── index.ts       # 統一されたexports
```

### 3. **統一されたAPI通信**

```typescript
// ❌ 古い方法（コンポーネント内でaxios直接使用）
const response = await axios.post('/api/characters', data)

// ✅ 新しい方法（サービス層を使用）
import { createCharacter } from '~/features/character'
const character = await createCharacter(data, jwt)
```

## 🔧 使用方法

### API通信

```typescript
// 認証
import { loginOrRegisterUser, validateJwt } from '~/features/auth'

// キャラクター
import { createCharacter, getCharacter, getUserCharacters } from '~/features/character'

// ユーザー
import { getUserInfo, updateUserInfo } from '~/features/users'
```

### カスタムフック

```typescript
// キャラクター管理
import { useCharacters } from '~/lib/hooks'

function CharacterList({ jwt }: { jwt: string }) {
  const {
    characters,
    isLoading,
    error,
    createCharacter
  } = useCharacters(jwt)

  const handleCreate = async (data) => {
    try {
      await createCharacter(data)
      // 自動的にリストが更新される
    } catch (error) {
      // エラーハンドリング
    }
  }

  return (
    // UI rendering
  )
}
```

### コンポーネント

```typescript
// 機能特化コンポーネント
import { CharacterCreate } from '~/features/character'

// 共通コンポーネント
import { Button } from '~/components/Elements'
```

## 🚀 利点

1. **スケーラビリティ**: 機能ごとに独立して開発・テスト可能
2. **保守性**: 関心の分離により、変更の影響範囲が限定的
3. **再利用性**: サービス層とフックにより、ロジックの再利用が容易
4. **テスタビリティ**: 各層が独立しているため、単体テストが書きやすい
5. **型安全性**: TypeScriptによる型定義で、開発時エラーを防止

## 📝 移行ガイド

### 既存コードの移行

1. **API呼び出しをサービス層に移動**
2. **型定義を`~/lib/types.ts`に統一**
3. **共通ロジックをカスタムフックに抽出**
4. **コンポーネントからビジネスロジックを分離**

### 新機能の追加

1. `app/features/[feature-name]/`ディレクトリを作成
2. `api/[feature-name].service.ts`でAPI通信を定義
3. `components/`でUIコンポーネントを作成
4. `index.ts`で統一されたexportsを提供
5. 必要に応じて`~/lib/hooks/`にカスタムフックを追加

## 🔗 参考資料

- [Bulletproof React](https://github.com/alan2207/bulletproof-react)
- [Remix Documentation](https://remix.run/docs)
- [React Best Practices](https://react.dev/learn)
