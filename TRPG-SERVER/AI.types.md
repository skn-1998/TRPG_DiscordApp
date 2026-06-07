# TRPG-SERVER 型管理・型安全性ドキュメント

> **正本ポインタ**: 型管理の上位正本は **src/ARCHITECTURE.md §12（横断型の置き場所 = core/types 一本化）** と **AI.refactor.md（最新の型・リファクタ状況）**。本ドキュメントの日付（発見/解決）は2025年当時の記録であり、現状の型安全性は「any 約230件残存（非テスト）・段階的削減中」である点に注意。

## 📊 **型の不一致問題と解決策** `[発見: 2025-01-05]` `[解決: 2025-01-18]`

### **✅ 解決済み問題**

#### **🎯 解決サマリー**

- **character-creation.service.ts**の型エラー修正 ✅
- **unified-event-contracts.ts**と**event-contracts.ts**の型定義統一化 ✅
- **Character型とCharacterModel型**の構造不一致解決 ✅
- **TypedEventService**の型定義整合性確保 ✅
- **循環依存問題の完全解決** ✅
- **ビルド成功確認** ✅

#### **🔄 循環依存解決** `[完了: 2025-01-18]`

> ※auth⇄user の循環は最終的に **H6（2026-06-01）で解消済み**。現在は `check:circular` = No circular dependency found! が正常状態（新たな循環参照は禁止）。以下は当時の記録（履歴）。

```typescript
// ❌ 発見された循環依存
1) discord/features/characterEdit/character-edit.module.ts >
   discord/features/characterEdit/events/handlers/character-edit-feature.handler.ts >
   events/index.ts > events/events.module.ts

2) domains/auth/auth.module.ts > domains/user/user.module.ts

// ✅ 解決策
// 1. events.module.tsからCharacterEditModuleのインポートを削除
// 2. user.module.tsからAuthModuleのインポートを削除

// 🎯 解決結果
// ✔ No circular dependency found!
```

#### **1. イベント型定義の不一致** ✅ **解決済み**

```typescript
// ❌ 型の不一致が発生している箇所
// 1. character-creation.service.ts vs unified-event-contracts.ts
// 2. CharacterCreationRequestedEvent vs TypedEventService型定義
// 3. Character型の構造不一致（discordUserId, createdAt, updatedAt等）

// 具体的な不一致
const typeMismatches = {
  createData構造: {
    発行側: 'discord: { channelId: string }',
    契約側: 'discordChannelId?: string'
  },
  Character型: {
    'unified-event-contracts': 'discordUserId?: string, createdAt: Date, updatedAt: Date',
    'character.model': 'discord: { userId: string }, createdAt: Date, updatedAt: Date'
  },
  TypedEventService: {
    'event-contracts.ts': 'Character.CreateRequest型を使用',
    'unified-event-contracts.ts': 'CharacterCreationData型を使用'
  }
}
```

#### **2. 影響を受けるファイル**

```typescript
const affectedFiles = {
  高優先度: [
    'src/discord/features/characterEdit/services/character-creation.service.ts',
    'src/events/handlers/character.creation.requested.ts',
    'src/shared/application/typed-event.service.ts'
  ],
  中優先度: [
    'src/events/contracts/unified-event-contracts.ts',
    'src/shared/domain/events/event-contracts.ts',
    'src/types/character.types.ts'
  ],
  低優先度: ['src/domains/character/models/character.model.ts', 'src/domains/character/dto/character.dto.ts']
}
```

### **💡 解決策の提案**

#### **1. 短期解決策（推奨）**

##### **型アサーションによる一時的解決**

```typescript
// ✅ character-creation.service.ts
await this.typedEventService.emit('character.creation.requested', {
  createData: {
    characterName: context.channel.name,
    gameSystemId: '',
    discordUserId: context.creatorId || '',
    discord: { channelId: context.channel.id } // ← 既存構造を維持
  },
  // ... 他のプロパティ
} as any) // ← 一時的にany型で回避

// ✅ ハンドラー側での型変換
// character.creation.requested.ts
private async emitSuccessEvent(character: CharacterModel, ...) {
  const mappedCharacter: Character = {
    ...character,
    discordUserId: character.discord?.userId,
    discordChannelId: character.discord?.channelId,
    // 必要なプロパティをマッピング
  }

  await this.typedEventService.emit('character.creation.completed', {
    character: mappedCharacter,
    source: originalEvent.source,
    timestamp: new Date()
  })
}
```

#### **2. 長期解決策（根本的解決）**

##### **型定義の統一化**

```typescript
// 🎯 統合された型定義例
export interface UnifiedCharacter {
  characterId: string
  characterName: string
  gameSystemId: string
  discordUserId?: string
  discordChannelId?: string
  discordThreadId?: string
  status: Record<string, AttributeValue>
  parameter: Record<string, AttributeValue>
  skill: Record<string, AttributeValue>
  item: Record<string, AttributeValue>
  description?: string
  createdAt: Date
  updatedAt: Date
}

// 🎯 統一されたイベント契約
export interface UnifiedCharacterCreationRequestedEvent {
  type: 'character.creation.requested'
  createData: UnifiedCharacterCreationData
  requester?: EventRequester
  source: string
  timestamp: Date
}
```

### **📊 影響範囲と優先度**

#### **高優先度（即座に対応必要）**

- `character-creation.service.ts`: イベント発行時の型エラー
- `character.creation.requested.ts`: ハンドラー側の型エラー
- `TypedEventService`: 型定義の不一致

#### **中優先度（段階的対応）**

- `unified-event-contracts.ts`: 型定義の統一化
- `event-contracts.ts`: 型定義の統合
- `Character型`: 全体的な構造統一

#### **低優先度（長期的対応）**

- 型エイリアス方式の完全適用
- 型安全性の向上（any 約230件残存・段階的削減中。「100%達成」は当面の目標であり未達）
- 開発者体験の向上

### **🔧 実装方針**

#### **Phase 1: 緊急対応（本日中）**

1. 型アサーションによる一時的解決
2. 基本機能の動作確保
3. 型エラーの最小化

#### **Phase 2: 構造改善（1週間以内）**

1. 型定義の統一化
2. 型エイリアス方式の適用
3. 型安全性の向上

#### **Phase 3: 完全解決（1ヶ月以内）**

1. 全体的な型システムの見直し
2. 型安全性の100%達成
3. 開発効率の向上

### **📋 技術的課題**

#### **循環依存の回避**

```typescript
// ✅ 型エイリアス方式による循環依存回避
type CharacterModel = import('../../domains/character/models/character.model').Character
type CharacterCreateRequest = import('../../types/character.types').Character.CreateRequest

// ❌ 直接importによる循環依存リスク
import { Character } from '../../domains/character/models/character.model'
```

#### **型安全性の確保**

```typescript
// ✅ 型アサーションによる安全な型変換
const mappedCharacter: Character = {
  ...character,
  discordUserId: character.discord?.userId || '',
  discordChannelId: character.discord?.channelId || ''
  // 必須プロパティの適切な変換
}

// ❌ 不適切な型アサーション
const mappedCharacter = character as any // ← 型安全性を失う
```

---

## 🏗️ **型管理方式** `[実装完了: 2025-08-17]`

### **✅ 型エイリアス方式による統一管理**

#### **1. 設計原則**

```typescript
// ✅ 推奨: 型エイリアス方式
type CharacterModel = import('../../../domains/character/models/character.model').Character
type UpdateCharacterDto = import('../../../domains/character/dto/update-character.dto').UpdateCharacterDto
type DiceResult = import('../../../discord/utils/dice.util').DiceResult

// ❌ 非推奨: 毎回直接import
'character.updated': {
  character: import('../../../domains/character/models/character.model').Character
}
```

#### **2. 利点と効果**

| 観点                 | 型エイリアス方式       | 直接import方式        |
| -------------------- | ---------------------- | --------------------- |
| **可読性**           | ✅ 短くて明確          | ❌ 長くて読みにくい   |
| **保守性**           | ✅ 1箇所修正で全体更新 | ❌ 多数箇所の修正必要 |
| **一貫性**           | ✅ 統一された命名      | ❌ 型参照がバラバラ   |
| **コード量**         | ✅ 簡潔                | ❌ 冗長               |
| **リファクタリング** | ✅ 容易                | ❌ 手間がかかる       |

#### **3. 実装パターン**

##### **基本パターン**

```typescript
// event-contracts.ts
// 型エイリアス定義（循環依存回避のため直接import使用）
type CharacterModel = import('../../../domains/character/models/character.model').Character
type UpdateCharacterDto = import('../../../domains/character/dto/update-character.dto').UpdateCharacterDto
type DiceResult = import('../../../discord/utils/dice.util').DiceResult
type FeatureRequester = import('../../../events/contracts/character-events.contract').FeatureRequester

// 使用例
export interface CharacterEventContracts {
  'character.updated': {
    character: CharacterModel // ← 短くて明確
    updateType: string
    source: string
    timestamp: Date
  }

  'character.creation.requested': {
    createData: Character.CreateRequest
    requester?: FeatureRequester // ← 統一された型参照
    userId: string
  }
}
```

##### **命名規則**

- **Model型**: `CharacterModel`, `UserModel`, `DiceRollModel`
- **DTO型**: `UpdateCharacterDto`, `CreateUserDto`, `DiceRollInputDto`
- **Result型**: `DiceResult`, `ValidationResult`, `OperationResult`
- **Service型**: `FeatureRequester`, `EventHandler`, `ServiceContract`

#### **4. 循環依存対策**

```typescript
// ✅ 直接import方式で循環依存を回避
type CharacterModel = import('../../domains/character/models/character.model').Character

// ❌ 通常のimportは循環依存リスクあり
import { Character } from '../../domains/character/models/character.model'
```

#### **5. 適用範囲と基準**

##### **適用対象**

- **event-contracts.ts**: イベント型定義での型参照
- **大規模ファイル**: 同じ型を複数箇所で使用
- **型参照が複雑**: パスが長い、階層が深い

##### **適用基準**

- 同一ファイル内で同じ型を3回以上使用
- 型参照パスが50文字以上
- 型の保守性が重要なファイル

#### **6. 保守性の向上**

##### **パス変更時の影響**

```typescript
// ✅ 型エイリアス方式: 1箇所の修正のみ
type CharacterModel = import('../../../NEW_PATH/character.model').Character

// ❌ 直接import方式: 全箇所の修正が必要
'character.updated': {
  character: import('../../../NEW_PATH/character.model').Character // ← 全箇所修正
}
```

##### **型名変更時の影響**

```typescript
// ✅ 型エイリアス方式: エイリアス名のみ変更
type CharacterModel = import('../../../domains/character/models/character.model').Character

// ❌ 直接import方式: 全箇所の修正が必要
'character.updated': {
  character: import('../../../domains/character/models/character.model').Character // ← 全箇所修正
}
```

---

## 🔧 **TypeScript設定と型安全性**

### **✅ 現在のTypeScript設定**

```json
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
```

### **📊 型安全性の達成状況**

> ※以下のパーセンテージは2025年当時の自己評価スナップショット（履歴）。現状は **any 約230件残存（非テスト）・段階的削減中** であり、「全体的: 85%」「95%達成予定」等の楽観的見積もりは未達。最新は AI.refactor.md を参照。

```typescript
// [2025年当時の見積もり / 履歴]
const typeSafetyProgress = {
  基本型定義: '100% - 完全達成',
  JWT設定: '100% - 完全達成',
  'Discord.js型': '95% - ほぼ完了',
  イベント型: '80% - 進行中（型の不一致問題あり）',
  DTO型: '90% - ほぼ完了',
  全体的: '85% - 当時の見積もり（実態は any 約230件残存・進行中）'
}
```

### **🎯 型安全性向上のための推奨事項**

#### **1. any型の撲滅**

```typescript
// ❌ 避けるべき
const data: any = getData()

// ✅ 推奨
const data: unknown = getData()
const validatedData = validateData(data)
```

#### **2. 型ガードの活用**

```typescript
// ✅ 型安全な型ガード
function isCharacter(obj: unknown): obj is Character {
  return typeof obj === 'object' && obj !== null && 'characterId' in obj && 'characterName' in obj
}

// 使用例
if (isCharacter(data)) {
  // dataはCharacter型として扱える
  console.log(data.characterName)
}
```

#### **3. 型アサーションの適切な使用**

```typescript
// ✅ 適切な型アサーション
const result = processData() as Character

// ❌ 不適切な型アサーション
const result = processData() as any
```

---

## 📋 **今後の改善計画**

### **Phase 1: 緊急対応（本日中）** ✅ **完了**

- [x] 型アサーションによる一時的解決
- [x] 基本機能の動作確保
- [x] 型エラーの最小化

### **Phase 2: 構造改善（1週間以内）** ✅ **完了**

- [x] 型定義の統一化
- [x] 型エイリアス方式の適用
- [x] 型安全性の向上

### **Phase 3: 完全解決（1ヶ月以内）**

> ※当初の「1ヶ月以内」「100%達成」は楽観的な見積もりで未達。実態は any 約230件残存（非テスト）・段階的削減が進行中。

- [ ] 全体的な型システムの見直し
- [ ] 型安全性の向上（any の段階的削減。「100%」は長期目標、現状未達）
- [ ] 開発効率の向上

### **Phase 4: 最適化（長期的）**

- [ ] 型パフォーマンスの最適化
- [ ] 型推論の改善
- [ ] 開発者体験の向上

---

## 🔗 **関連ドキュメント**

- **[AI.md](./AI.md)** - プロジェクト概要・最新状況
- **[AI.architecture.md](./AI.architecture.md)** - システムアーキテクチャ・技術スタック
- **[AI.test.md](./AI.test.md)** - テスト戦略・カバレッジ分析
- **[AI.domain.md](./AI.domain.md)** - ドメイン駆動設計・イベント駆動アーキテクチャ

---

## 横断コード／型の置き場所（決定表＝正本: `src/ARCHITECTURE.md` §12）

型の置き場所の正本は **`src/ARCHITECTURE.md` の「§12 横断コード / 型の置き場所（決定表）」**。要点：

- **横断型は `core/types` に一本化**（旧 `src/types`・`shared/types` の分散を解消。`shared/types` は撤去済み、残る `src/types` は `core/types` へ集約）。
- feature/domain 固有型は各 module（`domains/*/types`、`discord/features/*/types`、イベント契約は `core/events`/`events/contracts`）。
- **例外**：`src/types/express/index.d.ts` の global 型拡張（`Request.user: JwtTokenPayload`）は tsconfig の型解決に関わるため安易に動かさない（移設時は typeRoots/include を整合）。

新規の横断型・リファクタ時はまず上記決定表で置き場所を決めること。

---

_このドキュメントは型の不一致問題と解決策を詳細に記録し、プロジェクトの型安全性向上を支援します。_
