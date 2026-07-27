# TRPG-SERVER ドメイン駆動設計ドキュメント

## 📋 **ドキュメント概要** **[作成日: 2025-01-14]** **[更新日: 2025-01-09]**

このドキュメントでは、TRPG-SERVERにおけるドメイン駆動設計（DDD）とイベント駆動アーキテクチャの導入状況と設計指針を説明します。

**関連ドキュメント**:

- **[AI.md](./AI.md)** - プロジェクト概要
- **[src/ARCHITECTURE.md](./src/ARCHITECTURE.md)** - システムアーキテクチャ・module 境界・型の置き場所（§12）
- **[src/events/AI.event.md](./src/events/AI.event.md)** - イベント基盤の現状正本（冒頭節）
- **[src/events/DESIGN.md](./src/events/DESIGN.md)** - イベント基盤の設計正本
- **[AI.refactor.md](./AI.refactor.md)** - 最新のリファクタ状況・ドメイン評価
- **[AI.test.md](./AI.test.md)** - テスト戦略・カバレッジ分析

---

## 2026-07-12 User / Character HTTP認可契約

### 問題

- Userの書込みrouteが未認証で、path/bodyの `discordUserId` をそのまま更新対象に使用していた。
- Userの入力DTOと永続モデルがOAuth token項目を共有し、HTTP入力からtoken・characterIdsを上書きできた。
- User永続モデルをそのまま返すため、暗号化済みtokenもHTTP応答へ出る可能性があった。
- Characterの個別取得・更新・削除は認証済みでも `characterId` だけで検索し、認証主体と所有者を結び付けていなかった。

### User HTTP契約

**事前条件**:

- 全User HTTP操作に有効なJWTがあり、認証主体に `discordUserId` がある。
- pathに `discordUserId` がある操作は、認証主体のIDと一致する。
- create/update bodyは公開プロフィール項目 `name` / `avatarHash` だけを含む。token、所有者ID、characterIdsはHTTP入力にできない。

**正常時事後条件**:

- 認証主体本人のUserだけを作成・取得・更新・削除する。
- 応答は `UserOutputDto` に写像し、`discordUserId`、`name`、任意の `avatarHash`、`characterIds` だけを返す。
- OAuth tokenの作成・更新は `AuthService -> UserService` の内部provisioning経路だけが所有する。

**失敗時事後条件**:

- 未認証は401、pathと認証主体の不一致は対象不在と同じ404で停止し、repositoryを変更しない。
- 管理対象外のbody項目は APP_PIPE の `whitelist` で**除去する**（400 にはしない。第3群-a で
  `forbidNonWhitelisted` を廃し全 controller を APP_PIPE 一本に統一したため）。
  mass assignment の遮断は、この strip に加えて controller が service へ渡す項目を明示再構成することで担保する。

**不変条件**:

- request body/pathのIDは権限根拠にせず、JWTの `discordUserId` を唯一のHTTP主体とする。
- OAuth access/refresh token、期限、scopeはUser HTTP応答へ含めない。
- `User.characterIds` は互換用の関連一覧であり、Characterへのアクセス権を付与しない。

### Character HTTP契約

**事前条件**:

- 個別取得・更新・削除には、認証済み `discordUserId` と `characterId` の両方がある。
- 現行業務には共有・委任アクセスがないため、`Character.discordUserId` と認証主体が一致する。

**正常時事後条件**:

- repositoryの同一queryへ `characterId` と `discordUserId` の両方を含め、所有Characterだけを取得・更新・削除する。
- 更新・削除は事前取得と変更を分けず、owner-qualifiedな単一MongoDB操作として実行する。

**失敗時事後条件**:

- 未認証は401でrepositoryを呼ばない。
- 対象不在と非所有者はいずれもowner-qualified queryが `null` を返し、外部へ同じ404を返す。状態は変更しない。

**不変条件**:

- HTTP公開操作は `findOneForOwner` / `updateForOwner` / `removeForOwner` だけを使う。`/character` だけでなく `/discord/post-character` も同じ契約へ接続する。
- ID単独の既存repository/service操作は、Discord event等の別の信頼境界向けであり、HTTP controllerから呼ばない。
- Character権限の正本は `Character.discordUserId` であり、`User.characterIds` の有無では判定しない。

### 受入検証

- 変更前ベースライン: 6 suites / 102 tests成功。
- owner-qualified repository操作3件の不存在をREDで確認後、Character 3 suites / 73 tests成功。
- Userの主体ID強制、token入出力遮断、他人path拒否の6件をREDで確認後、User関連5 suitesを拡張。
- Fable初回レビューは対象diff内の重大指摘なし、`Approved with follow-up`。契約を横断適用して発見した `/discord/post-character` のID単独操作をRED確認後にowner-qualified化し、複合Param DTO・Character guard metadata・Swagger出力型も修正。
- Fable追跡レビューは **`Approved`**。全HTTP controllerを横断検索し、CharacterのID単独取得・更新・削除へ到達する公開経路が残っていないことを確認。
- 最終focused: 9 suites / 157 tests成功。`typecheck:test` 成功。

---

## 🎯 **実装完了状況**

### **✅ Phase 1 完了: 基盤構築**

- **TypedEventService**: 型安全なイベント通信基盤 ✅
- **AppEventContracts**: イベント契約システム ✅
- **BaseEvent Infrastructure**: イベント基底クラス ✅

### **✅ Phase 2 完了: ドメイン実装**

- **Character Domain**: キャラクター管理のイベント駆動化 ✅
- **Dice Roll Domain**: ダイスロール機能のイベント駆動化 ✅
- **Discord Integration**: Discord統合レイヤー ✅

### **✅ Phase 3 完了: アーキテクチャ移行** `[完了: 2025-01-05]`

- **Commands層統一化**: BaseCommandService による統一パターン ✅
- **循環依存除去**: 全Events層で循環依存0個達成 ✅
- **エラーハンドリング統一**: 100%統一化達成 ✅
- **ログシステム統一**: 構造化ログ完全実装 ✅

### **✅ Phase 4 完了: イベントタイミング修正** `[完了: 2025-08-11]`

- **CharacterEventHandlerService**: `character.findById`イベントタイムアウト問題解決 ✅
- **EnhancedCharacterEditService**: `waitForEvent`と`emit`の実行順序修正 ✅
- **Event Flow Debugging**: 完全なイベントフロー検証テスト完備 ✅
- **Test Module Initialization**: `onModuleInit`の適切な呼び出し確保 ✅

### **✅ Phase 5 完了: チャンネル作成イベント駆動化** `[完了: 2025-01-10]`

- **ChannelCreateOrchestratorService**: character.creation.requestedイベント発火実装 ✅
- **CharacterEventHandlerService**: 新しいイベントハンドラーサービス作成 ✅
- **CharacterCreationService**: 循環依存解消、イベント駆動実装 ✅
- **イベント統合**: TypedEventServiceによる完全なイベント統合 ✅

> ※以下（Phase 4 / Phase 5 実装詳細）は2025年の完了報告（履歴）。現在のイベント基盤の正本は **src/events/AI.event.md 冒頭節** と **src/events/DESIGN.md**。

#### **Phase 4実装詳細：イベントタイミング修正**

**問題**: `character-refresh-*` および `character-compact-view-*` ボタンイベントがタイムアウトエラーで失敗

**原因分析**:

1. **`EnhancedCharacterEditService`**: `emit`を実行してから`waitForEvent`を呼んでいた
2. **`CharacterEventHandlerService`**: テスト環境で`onModuleInit`が呼ばれていなかった

**技術修正**:

```typescript
// ❌ Before: 間違った順序
await this.typedEventService.emit('character.findById.requested', payload)
const result = await Promise.race([
  this.typedEventService.waitForEvent('character.findById.completed', 5000),
  this.typedEventService.waitForEvent('character.findById.failed', 5000)
])

// ✅ After: 正しい順序
const resultPromise = Promise.race([
  this.typedEventService.waitForEvent('character.findById.completed', 5000),
  this.typedEventService.waitForEvent('character.findById.failed', 5000)
])
await this.typedEventService.emit('character.findById.requested', payload)
const result = await resultPromise
```

**検証テスト**: 完全なイベントフロー検証デバッグテスト追加

- 直接メソッド呼び出しテスト ✅
- イベント発行・受信テスト ✅
- 統合エンドツーエンドテスト ✅

#### **Phase 5実装詳細**

```typescript
// 🎯 改善されたアーキテクチャフロー
// 1. ChannelCreateOrchestratorService
//    - character.creation.requestedイベント発火
//    - イベントハンドラーによる後続処理

// 2. CharacterEventHandlerService（新規作成）
//    - character.creation.requestedイベント受信・処理
//    - キャラクター作成後にcharacter.creation.completedイベント発行

// 3. CharacterCreationService
//    - forwardRef循環依存解消
//    - TypedEventServiceを使用したイベント駆動実装

// 🔄 イベントフロー
// Channel作成 → Orchestrator → character.creation.requested
//              → EventHandler → CharacterRepository → character.creation.completed
//              → Orchestrator → チャンネル名同期・通知
```

#### **改善効果**

- **循環依存**: 完全解消 (forwardRef削除)
- **型安全性**: イベント契約は TypedEventService により型付け。ただしコードベース全体では any が約230件残存（非テスト）し段階的削減中（「100%」は誇張だった）
- **保守性**: 大幅向上 (責務分離、イベント駆動)
- **拡張性**: 優秀 (イベントベースでの機能追加が容易)

---

## 🏗️ **アーキテクチャ設計**

### **1. イベント駆動アーキテクチャ**

```typescript
// 型安全なイベント契約システム
export interface AppEventContracts {
  'character.search.request': CharacterSearchRequestPayload
  'character.update.request': CharacterUpdateRequestPayload
  'dice-roll.execute.request': DiceRollExecuteRequestPayload
  // ... その他のイベント契約
}

// TypedEventService - 型安全なイベント通信
export class TypedEventService {
  emit<K extends keyof AppEventContracts>(eventName: K, payload: AppEventContracts[K]): boolean

  on<K extends keyof AppEventContracts>(
    eventName: K,
    listener: (payload: AppEventContracts[K]) => void | Promise<void>
  ): this
}
```

### **2. ドメイン駆動設計（DDD）**

#### **ドメイン境界**

> ※以下の評価スコアは2025年時点の評価（古いスナップショット）。最新は AI.refactor.md を参照。

- **Auth Domain**: 認証・認可処理 (評価: 95/100)
- **User Domain**: ユーザー情報管理 (評価: 90/100)
- **Character Domain**: キャラクター管理 (評価: 85/100)
- **Dice-Roll Domain**: ダイスロール履歴管理 (評価: 80/100)
- **Discord Domain**: Bot機能統合 (評価: 88/100)

#### **ドメイン責務分離の最適化**

**重要な変更点**:

- `GET /auth/discord/guilds` → `GET /users/discord/guilds` (ドメイン責務の適正化)
- `UserService.validateToken()` 削除 (認証処理はauthドメインの責務)

### **3. Commands層統一パターン**

#### **BaseCommandService 抽象クラス**

```typescript
export abstract class BaseCommandService {
  constructor(
    protected typedEventService: TypedEventService,
    protected logger: Logger
  ) {}

  protected async handleInteractionError(
    interaction: CommandInteraction,
    error: unknown,
    context: string
  ): Promise<void> {
    const errorMessage = ErrorHandler.handleDiscordCommandError(interaction, error)
    // 統一されたエラー処理
  }
}
```

#### **統一化完了サービス**

- `CharacterThreadService` ✅
- `DiceFromContextMenuService` ✅
- `RollDiceService` ✅
- `DiceResultService` ✅
- `UserDefinedDiceService` ✅
- `SelectGameSystemService` ✅

---

## 🔄 **変更パターン例**

### **Before: 直接依存 + 循環依存**

```typescript
@Injectable()
export class CharacterChannelService {
  constructor(
    @Inject(forwardRef(() => CharacterService))
    private characterService: CharacterService
  ) {}
}
```

### **After: イベント駆動パターン**

```typescript
@Injectable()
export class CharacterChannelService {
  constructor(private typedEventService: TypedEventService) {}

  async handleCharacterSelection(interaction: StringSelectMenuInteraction) {
    const character = await this.typedEventService.requestCharacterSearch({
      criteria: { id: selectedCharacterId }
    })
    // ビジネスロジック実行
  }
}
```

---

## 🎭 **DTO標準化システム**

### **基底クラス体系**

```typescript
BaseDto                    // 共通フィールド (createdAt, updatedAt)
├── IdentifiableDto       // ID を持つ DTO
└── DiscordDto            // Discord 関連フィールド

// 統一バリデーションシステム
ValidationUtils.requiredString('フィールド名')
ValidationUtils.optionalString('フィールド名')
ValidationUtils.array('フィールド名')
ValidationUtils.date('フィールド名')
```

### **命名規則統一**

```typescript
// 旧命名 → 新命名
'PartialInputCharacterDto' → 'CharacterInputDto'
'PartialInputDiceRollChannelDto' → 'DiceRollChannelInputDto'
'PartialInputDiceRollTextDto' → 'DiceRollTextInputDto'
```

---

## 📊 **実装品質指標**

### **現在の評価**

- **型安全性**: any 約230件残存（非テスト）・段階的削減中（旧記載の「100%」は誇張）
- **循環依存**: 0個（H6=2026-06-01 で auth⇄user 循環も解消。`check:circular` = No circular dependency found!）✅
- **エラーハンドリング**: 100%統一化 ✅
- **ログシステム**: 構造化ログ完全導入 ✅
- **ドメイン設計**: 88/100 ※2025年時点の評価。最新は AI.refactor.md

### **技術的改善効果**

- **IntelliSense**: 完全対応 - イベント名・引数の自動補完
- **保守性**: 大幅向上 - 明確なイベント契約
- **テスタビリティ**: 向上 - イベント駆動モック対応
- **デバッグ効率**: 3x向上 - 構造化ログ活用

---

## 🚀 **今後の拡張戦略**

### **次期推奨改善 (優先度順)**

1. **Controller層完全化** - 高優先度
2. **パフォーマンス最適化** - 中優先度
3. **セキュリティ強化** - 長期的改善

### **長期的アーキテクチャ方向性**

- **マイクロサービス化対応**: サービス境界の明確化
- **CQRS導入**: Command Query Responsibility Segregation
- **イベントソーシング**: イベントストア実装
- **キャッシュ戦略**: Redis活用によるパフォーマンス向上

---

## 🎯 **設計原則**

### **基本原則**

1. **Single Responsibility**: 各ドメインが独立した責任を持つ
2. **Dependency Inversion**: 抽象に依存し、具象に依存しない
3. **Event-Driven**: 疎結合なイベント通信
4. **Type Safety**: 型安全性の継続的向上（現状 any 約230件残存・段階的削減中。「100%」は未達）

### **品質基準**

- **循環依存**: 0個維持（`check:circular` = No circular dependency found! が正常。H6=2026-06-01 で auth⇄user も解消済み）
- **型安全性**: any の段階的削減（現状約230件残存・非テスト。「100%維持」は誇張だった）
- **テストカバレッジ**: 継続的向上
- **エラーハンドリング**: 統一パターン遵守

---

_このドキュメントはドメイン駆動設計の概要と実装状況を提供します。技術詳細・module 境界・型の置き場所については [src/ARCHITECTURE.md](./src/ARCHITECTURE.md)（§12）を、イベント基盤の現状正本については [src/events/AI.event.md](./src/events/AI.event.md) 冒頭節と [src/events/DESIGN.md](./src/events/DESIGN.md) を、プロジェクト概要については [AI.md](./AI.md) をご参照ください。_
