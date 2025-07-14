# TRPG-SERVER ドメイン駆動設計ドキュメント

## 📋 **ドキュメント概要** **[作成日: 2025-01-14]** **[更新日: 2025-01-14]**

このドキュメントは、TRPG-SERVERにおけるドメイン駆動設計（DDD）とイベント駆動アーキテクチャの導入に関する包括的な設計指針を記載しています。

## 🎯 **実装進捗状況**

### **✅ Phase 1 完了: 基盤構築**
- **BaseEvent Infrastructure**: ✅ 実装完了
- **EventBusService**: ✅ 実装完了
- **Character Domain Events**: ✅ 実装完了
- **CharacterApplicationService**: ✅ 実装完了
- **Module Integration**: ✅ 実装完了

### **✅ Phase 1.5 完了: プロトタイプ検証**
- **プロトタイプ実装**: ✅ CharacterNameUpdatePrototype実装完了
- **Discord Integration**: ✅ DiscordCharacterNamePrototype実装完了
- **Feature Flag System**: ✅ 実装完了
- **テスト**: ✅ 19個の単体テスト全て成功
- **性能検証**: ✅ 100ms以下の要件達成
- **既存システム共存**: ✅ 確認済み

### **✅ Phase 2 完了: Character ドメイン移行 (Week 2)**
- **段階的移行システム**: ✅ 実装完了
- **既存サービス拡張**: ✅ 実装完了
- **Discord統合レイヤー**: ✅ 実装完了

#### **✅ Phase 2 完了項目詳細**
**Phase 2.1**: ✅ キャラクター作成機能（イベント駆動対応完了）
**Phase 2.2**: ✅ キャラクター削除機能（イベント駆動対応完了）
**Phase 2.3**: ✅ キャラクター検索機能（今回実装完了）
  - CharacterService.findByChannelId()にFeature Flag対応追加
  - DiscordIntegrationService.requestCharacterSearch()実装
  - waitForCharacterSearchResult()実装
  - 検索機能テスト実装（6テストケース）

**Phase 2.4**: ✅ キャラクター更新機能（今回実装完了）
  - CharacterService.updateByChannelId()にFeature Flag対応追加
  - waitForCharacterUpdateResult()実装
  - 更新機能テスト実装（4テストケース）

### **🔄 Phase 3 開始: Discord統合層リファクタリング (Week 3)**
- **循環依存の完全除去**: 🔄 実装準備中
- **EventsModule簡素化**: 🔄 実装準備中
- **Discord統合レイヤー最適化**: 🔄 実装準備中

#### **Phase 3.1 実装結果** ✅
**AddCharaInfoService変換完了**:
- ✅ **依存関係の解決**: `SharedModule`を`DiscordModule`に明示的にインポートして、`EventBusService`の依存関係問題を解決
- ✅ **イベント駆動パターンへの変換**: `CharacterService`への直接呼び出しから`DiscordIntegrationService`を通じたイベント発行に変更
- ✅ **ビルド成功**: TypeScriptコンパイルエラー0件を達成
- ✅ **責任の分離**: 複雑なビジネスロジックを除去し、UIイベントの処理に集中

**発見された問題と解決策**:
```typescript
// Before: 複雑な依存関係とビジネスロジックが混在
@Injectable()
export class AddCharaInfoService {
  constructor(private readonly characterService: CharacterService) {}
  
  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    // 複雑なビジネスロジックとDiscord UI更新
    const character = await this.characterService.findByChannelId(channelId)
    const updatedCharacter = await this.characterService.updateByChannelId(channelId, data)
    // 複雑なDiscord UI更新ロジック
  }
}

// After: シンプルなイベント駆動パターン
@Injectable()
export class AddCharaInfoService {
  constructor(private readonly discordIntegration: DiscordIntegrationService) {}
  
  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    // シンプルなイベント発行のみ
    await this.discordIntegration.requestCharacterUpdate(channelId, data, userId)
    
    // 最小限のUIフィードバック
    await interaction.reply({ content: '更新を受け付けました', ephemeral: true })
  }
}
```

**技術的修正**:
- `instanceof TextChannel`チェックを安全な`channel.type === ChannelType.GuildText && 'send' in channel`に変更
- `DiscordModule`に`SharedModule`を明示的にインポート
- エラーハンドリングの改善と適切なログ出力

**Phase 3.1完了基準**:
- ✅ AddCharaInfoServiceの変換完了
- ✅ 依存関係問題の解決
- ⚠️ テストの修正は次フェーズで対応（機能的な変換は完了）

#### **Phase 3 詳細実装計画**

##### **3.1 Discord Events Handler 簡素化**
**目標**: 既存のDiscordイベントハンドラーをイベント駆動パターンに変換

**実装対象ファイル**:
- `src/discord/events/modal/add-chara-info.service.ts`
- `src/discord/events/button/character-dice-buttons.service.ts`
- `src/discord/events/select/character-channel.service.ts`
- `src/discord/commands/commands-components/character-thread.service.ts`

**実装パターン**:
```typescript
// Before: 直接CharacterServiceを呼び出し
@Injectable()
export class AddCharaInfoService {
  constructor(private readonly characterService: CharacterService) {}
  
  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    // 複雑なビジネスロジック
    const character = await this.characterService.findByChannelId(channelId)
    const updatedCharacter = await this.characterService.updateByChannelId(channelId, data)
    // Discord UI更新
  }
}

// After: DiscordIntegrationServiceを通じてイベント発行
@Injectable()
export class AddCharaInfoService {
  constructor(private readonly discordIntegration: DiscordIntegrationService) {}
  
  async execute(interaction: ModalSubmitInteraction): Promise<void> {
    // シンプルなイベント発行のみ
    await this.discordIntegration.requestCharacterUpdate(channelId, data, userId)
    
    // UI フィードバック
    await interaction.reply({ content: '更新を受け付けました', ephemeral: true })
  }
}
```

##### **3.2 循環依存除去実装スケジュール**

**Day 1: Discord Events Modal 変換**
- [ ] AddCharaInfoService → DiscordIntegration変換
- [ ] CustomDiceModalService → DiscordIntegration変換  
- [ ] Modal系サービスのテスト実装

**Day 2: Discord Events Button 変換**
- [ ] CharacterDiceButtonsService → DiscordIntegration変換
- [ ] CharaInfoButtonService → DiscordIntegration変換
- [ ] Button系サービスのテスト実装

**Day 3: Discord Events Select 変換**
- [ ] CharacterChannelService → DiscordIntegration変換
- [ ] ChangeCharaInfoService → DiscordIntegration変換
- [ ] Select系サービスのテスト実装

**Day 4: Discord Commands 変換**
- [ ] CharacterThreadService → DiscordIntegration変換
- [ ] Commands系サービスのテスト実装

**Day 5: 依存関係整理**
- [ ] CharacterModule から DiscordModule への依存除去
- [ ] EventsModule から CharacterModule への依存除去
- [ ] 新しい依存関係の検証

**Day 6-7: 統合テスト・検証**
- [ ] 循環依存が完全に除去されたことの確認
- [ ] 全Discord機能の動作確認
- [ ] パフォーマンステスト
- [ ] エラーハンドリングテスト

##### **3.3 予想される新しい依存関係構造**
```typescript
// Phase 3 完了後の依存関係 (一方向のみ)
DiscordModule → DiscordIntegrationModule 
                        ↓
              EventBusModule (Central Hub)
                        ↓
    ┌───────────────────┼───────────────────┐
    ↓                   ↓                   ↓
CharacterApplication  DiceRollApplication  UserApplication
    Module             Module              Module
    ↓                   ↓                   ↓
CharacterDomain      DiceRollDomain      UserDomain
    Module             Module              Module
    ↓                   ↓                   ↓
CharacterInfra       DiceRollInfra       UserInfra
    Module             Module              Module
```

##### **3.4 Phase 3 成功基準**
- ✅ 循環依存の完全除去 (0個の循環依存)
- ✅ 既存Discord機能の100%動作保証
- ✅ パフォーマンスの維持 (処理時間 ±10%以内)
- ✅ すべてのテストが合格
- ✅ コードの複雑性低下 (LOC 20%削減目標)

---

## 🔴 **現在の問題分析**

### **1. 循環依存問題**
```typescript
// 現在の問題ある構造
CharacterModule ←→ DiscordModule ←→ EventsModule
     ↑               ↑                ↑
  ビジネス     Discord Bot機能     UI/UXイベント
  ロジック     (外部システム)      (外部インタラクション)
```

#### **具体的な問題点**
- **External Dependencies on Domain**: 外部システム(Discord)がドメインロジックに直接依存
- **UI Layer Direct Domain Access**: UI層(Events)がビジネスロジック層に直接アクセス
- **Unclear Boundaries**: 責務の境界が曖昧
- **Poor Testability**: モック作成が困難、単体テストの複雑化
- **Tight Coupling**: 変更の影響範囲が広範囲に及ぶ

### **2. 設計原則違反**
- **依存関係逆転の原則 (DIP)** 違反
- **単一責任の原則 (SRP)** 違反
- **開放閉鎖の原則 (OCP)** 違反

---

## 🏗️ **新アーキテクチャ: ドメインイベント駆動設計**

### **1. アーキテクチャ全体像**

```typescript
┌─────────────────────────────────────────────────────────┐
│                 Presentation Layer                      │
│  ┌─────────────────┐  ┌─────────────────────────────┐   │
│  │  Discord Module │  │      Web API Module         │   │
│  │   (Adapter)     │  │       (Adapter)             │   │
│  │                 │  │                             │   │
│  │ Events/Commands │  │  Controllers/DTOs           │   │
│  └─────────────────┘  └─────────────────────────────┘   │
└─────────────┬───────────────────┬───────────────────────┘
              │                   │
      Domain Events       Domain Events
              ↓                   ↓
┌─────────────────────────────────────────────────────────┐
│               Application Layer                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Event Bus Service                  │   │
│  │         (Central Event Coordination)            │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Character   │  │  Dice Roll  │  │   User      │   │
│  │Application  │  │ Application │  │Application  │   │
│  │  Service    │  │   Service   │  │  Service    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────┬───────────────┬───────────────┬─────────┘
              │               │               │
         Domain Events   Domain Events   Domain Events
              ↓               ↓               ↓
┌─────────────────────────────────────────────────────────┐
│                 Domain Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Character   │  │  Dice Roll  │  │    User     │   │
│  │  Domain     │  │   Domain    │  │   Domain    │   │
│  │             │  │             │  │             │   │
│  │ Entities    │  │ Entities    │  │ Entities    │   │
│  │ Value Objs  │  │ Value Objs  │  │ Value Objs  │   │
│  │ Domain Evts │  │ Domain Evts │  │ Domain Evts │   │
│  │ Services    │  │ Services    │  │ Services    │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────┬───────────────┬───────────────┬─────────┘
              │               │               │
┌─────────────────────────────────────────────────────────┐
│              Infrastructure Layer                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ Character   │  │  Dice Roll  │  │    User     │   │
│  │Repository   │  │ Repository  │  │ Repository  │   │
│  │             │  │             │  │             │   │
│  │ MongoDB     │  │ MongoDB     │  │ MongoDB     │   │
│  │ Impl        │  │ Impl        │  │ Impl        │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### **2. 核となる設計原則**

#### **A. 依存関係逆転の原則 (DIP) 適用**
```typescript
// Before (問題ある依存)
DiscordModule → CharacterModule → CharacterService
                      ↓
                Database (MongoDB)

// After (依存関係逆転)
DiscordModule → EventBus ← CharacterApplicationService
                   ↓              ↓
           Domain Events    CharacterDomain
                              ↓
                      CharacterRepository
                              ↓
                        Database (MongoDB)
```

#### **B. 層責任の明確化**
- **Presentation Layer**: 外部インターフェース (Discord Bot, Web API)
- **Application Layer**: ユースケース調整、ドメインイベント処理
- **Domain Layer**: ビジネスルール、ドメインロジック
- **Infrastructure Layer**: データ永続化、外部サービス統合

#### **C. イベント駆動による疎結合**
```typescript
// 直接呼び出し (現在)
await characterService.updateByChannelId(channelId, data)
// → 強結合、テスト困難、変更の影響大

// イベント駆動 (新設計)
await eventBus.publish(new CharacterUpdateRequested(channelId, data))
// → 疎結合、テスト容易、拡張性高
```

---

## 📐 **ドメイン設計詳細**

### **1. ドメインイベント設計**

#### **1.1 基底ドメインイベント**
```typescript
// src/shared/domain/events/base.event.ts
export abstract class DomainEvent {
  readonly occurredOn: Date
  readonly eventId: string
  readonly aggregateId: string
  readonly version: number
  
  constructor(aggregateId: string, version: number = 1) {
    this.aggregateId = aggregateId
    this.eventId = crypto.randomUUID()
    this.occurredOn = new Date()
    this.version = version
  }
  
  abstract getEventName(): string
}
```

#### **1.2 Character ドメインイベント**
```typescript
// src/domains/character/events/character.events.ts

// Command Events (外部からのリクエスト)
export class CharacterUpdateRequested extends DomainEvent {
  constructor(
    public readonly channelId: string,
    public readonly updateData: UpdateCharacterDto,
    public readonly source: 'discord' | 'web' | 'api' = 'discord',
    public readonly userId?: string
  ) {
    super(channelId)
  }
  
  getEventName(): string {
    return 'character.update.requested'
  }
}

export class CharacterCreationRequested extends DomainEvent {
  constructor(
    public readonly createData: CreateCharacterDto,
    public readonly source: 'discord' | 'web' | 'api' = 'discord',
    public readonly userId: string
  ) {
    super(userId)
  }
  
  getEventName(): string {
    return 'character.creation.requested'
  }
}

// Domain Events (ドメイン内での状態変化)
export class CharacterUpdated extends DomainEvent {
  constructor(
    public readonly character: Character,
    public readonly previousData: Partial<Character>,
    public readonly changedFields: string[]
  ) {
    super(character.id)
  }
  
  getEventName(): string {
    return 'character.updated'
  }
}

export class CharacterCreated extends DomainEvent {
  constructor(
    public readonly character: Character
  ) {
    super(character.id)
  }
  
  getEventName(): string {
    return 'character.created'
  }
}

export class CharacterDeleted extends DomainEvent {
  constructor(
    public readonly characterId: string,
    public readonly deletedBy: string
  ) {
    super(characterId)
  }
  
  getEventName(): string {
    return 'character.deleted'
  }
}

// Error Events (エラー状況)
export class CharacterNotFound extends DomainEvent {
  constructor(
    public readonly searchCriteria: { channelId?: string, characterId?: string },
    public readonly source: string
  ) {
    super(searchCriteria.characterId || searchCriteria.channelId || 'unknown')
  }
  
  getEventName(): string {
    return 'character.not.found'
  }
}

export class CharacterValidationFailed extends DomainEvent {
  constructor(
    public readonly characterData: Partial<Character>,
    public readonly validationErrors: string[],
    public readonly source: string
  ) {
    super('validation-' + Date.now())
  }
  
  getEventName(): string {
    return 'character.validation.failed'
  }
}
```

### **2. イベントバス設計**

#### **2.1 Event Bus Service**
```typescript
// src/shared/application/event-bus.service.ts
export interface EventHandler<T extends DomainEvent> {
  handle(event: T): Promise<void>
}

@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name)
  
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly eventStore?: EventStore // オプショナル
  ) {}
  
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    this.logger.log(`Publishing event: ${event.getEventName()}`)
    
    // イベントストアに保存（オプショナル）
    if (this.eventStore) {
      await this.eventStore.save(event)
    }
    
    // イベント発行
    await this.eventEmitter.emitAsync(event.getEventName(), event)
    
    this.logger.log(`Event published successfully: ${event.getEventName()}`)
  }
  
  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>
  ): void {
    this.eventEmitter.on(eventName, async (event: T) => {
      try {
        await handler.handle(event)
      } catch (error) {
        this.logger.error(`Error handling event ${eventName}:`, error)
        // エラーイベントを発行
        await this.publish(new EventHandlingFailed(eventName, event, error))
      }
    })
  }
  
  // 複数のハンドラーをバッチで登録
  subscribeMany(handlers: Array<{ eventName: string, handler: EventHandler<any> }>): void {
    handlers.forEach(({ eventName, handler }) => {
      this.subscribe(eventName, handler)
    })
  }
}
```

#### **2.2 Event Store（オプショナル）**
```typescript
// src/shared/infrastructure/event-store.service.ts
export interface EventStore {
  save(event: DomainEvent): Promise<void>
  getEvents(aggregateId: string): Promise<DomainEvent[]>
  getEventsByType(eventName: string): Promise<DomainEvent[]>
}

@Injectable()
export class MongoEventStore implements EventStore {
  constructor(
    @InjectModel('Event') private readonly eventModel: Model<EventDocument>
  ) {}
  
  async save(event: DomainEvent): Promise<void> {
    const eventDocument = new this.eventModel({
      eventId: event.eventId,
      eventName: event.getEventName(),
      aggregateId: event.aggregateId,
      occurredOn: event.occurredOn,
      version: event.version,
      data: event
    })
    
    await eventDocument.save()
  }
  
  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const events = await this.eventModel
      .find({ aggregateId })
      .sort({ occurredOn: 1 })
      .exec()
    
    return events.map(e => e.data)
  }
  
  async getEventsByType(eventName: string): Promise<DomainEvent[]> {
    const events = await this.eventModel
      .find({ eventName })
      .sort({ occurredOn: 1 })
      .exec()
    
    return events.map(e => e.data)
  }
}
```

### **3. Application Service 設計**

#### **3.1 Character Application Service**
```typescript
// src/domains/character/application/character-application.service.ts
@Injectable()
export class CharacterApplicationService {
  private readonly logger = new Logger(CharacterApplicationService.name)
  
  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBusService
  ) {
    // イベントハンドラーを登録
    this.registerEventHandlers()
  }
  
  private registerEventHandlers(): void {
    this.eventBus.subscribeMany([
      {
        eventName: 'character.update.requested',
        handler: { handle: this.handleCharacterUpdateRequest.bind(this) }
      },
      {
        eventName: 'character.creation.requested',
        handler: { handle: this.handleCharacterCreationRequest.bind(this) }
      }
    ])
  }
  
  async handleCharacterUpdateRequest(event: CharacterUpdateRequested): Promise<void> {
    this.logger.log(`Handling character update request: ${event.channelId}`)
    
    try {
      // ビジネスルール検証
      const character = await this.characterRepository.findByChannelId(event.channelId)
      
      if (!character) {
        await this.eventBus.publish(
          new CharacterNotFound(
            { channelId: event.channelId },
            event.source
          )
        )
        return
      }
      
      // 権限チェック（必要に応じて）
      if (event.userId && !this.canUserModifyCharacter(character, event.userId)) {
        await this.eventBus.publish(
          new CharacterAccessDenied(character.id, event.userId, event.source)
        )
        return
      }
      
      // データ検証
      const validationErrors = this.validateUpdateData(event.updateData)
      if (validationErrors.length > 0) {
        await this.eventBus.publish(
          new CharacterValidationFailed(
            event.updateData,
            validationErrors,
            event.source
          )
        )
        return
      }
      
      // 更新実行
      const previousData = { ...character }
      const updatedCharacter = await this.characterRepository.updateByChannelId(
        event.channelId,
        event.updateData
      )
      
      if (!updatedCharacter) {
        throw new Error('Character update failed')
      }
      
      // 変更されたフィールドを特定
      const changedFields = this.getChangedFields(previousData, updatedCharacter)
      
      // 成功イベント発行
      await this.eventBus.publish(
        new CharacterUpdated(updatedCharacter, previousData, changedFields)
      )
      
      this.logger.log(`Character updated successfully: ${updatedCharacter.id}`)
      
    } catch (error) {
      this.logger.error(`Error handling character update request:`, error)
      await this.eventBus.publish(
        new CharacterUpdateFailed(event.channelId, event.updateData, error.message)
      )
    }
  }
  
  async handleCharacterCreationRequest(event: CharacterCreationRequested): Promise<void> {
    this.logger.log(`Handling character creation request for user: ${event.userId}`)
    
    try {
      // ユーザー存在確認
      const user = await this.userRepository.findById(event.userId)
      if (!user) {
        await this.eventBus.publish(
          new UserNotFound(event.userId, event.source)
        )
        return
      }
      
      // ビジネスルール検証（例：ユーザーあたりのキャラクター数制限）
      const userCharacters = await this.characterRepository.findByUserId(event.userId)
      if (userCharacters.length >= 50) { // 制限例
        await this.eventBus.publish(
          new CharacterLimitExceeded(event.userId, userCharacters.length, event.source)
        )
        return
      }
      
      // データ検証
      const validationErrors = this.validateCreationData(event.createData)
      if (validationErrors.length > 0) {
        await this.eventBus.publish(
          new CharacterValidationFailed(
            event.createData,
            validationErrors,
            event.source
          )
        )
        return
      }
      
      // キャラクター作成
      const character = await this.characterRepository.create(event.createData)
      
      // 成功イベント発行
      await this.eventBus.publish(
        new CharacterCreated(character)
      )
      
      this.logger.log(`Character created successfully: ${character.id}`)
      
    } catch (error) {
      this.logger.error(`Error handling character creation request:`, error)
      await this.eventBus.publish(
        new CharacterCreationFailed(event.createData, error.message)
      )
    }
  }
  
  private canUserModifyCharacter(character: Character, userId: string): boolean {
    // ビジネスルール：キャラクターの所有者のみが変更可能
    return character.discordUserId === userId
  }
  
  private validateUpdateData(updateData: UpdateCharacterDto): string[] {
    const errors: string[] = []
    
    // ビジネスルール検証
    if (updateData.characterName && updateData.characterName.length > 100) {
      errors.push('Character name must be 100 characters or less')
    }
    
    if (updateData.status && typeof updateData.status !== 'object') {
      errors.push('Character status must be an object')
    }
    
    // その他の検証...
    
    return errors
  }
  
  private validateCreationData(createData: CreateCharacterDto): string[] {
    const errors: string[] = []
    
    // 必須フィールド検証
    if (!createData.characterName || createData.characterName.trim() === '') {
      errors.push('Character name is required')
    }
    
    if (!createData.gameSystemId) {
      errors.push('Game system ID is required')
    }
    
    if (!createData.discordUserId) {
      errors.push('Discord user ID is required')
    }
    
    // その他の検証...
    
    return errors
  }
  
  private getChangedFields(previous: Character, current: Character): string[] {
    const changed: string[] = []
    
    Object.keys(current).forEach(key => {
      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        changed.push(key)
      }
    })
    
    return changed
  }
}
```

### **4. Discord Integration Layer 設計**

#### **4.1 Discord Integration Service**
```typescript
// src/discord/application/discord-integration.service.ts
@Injectable()
export class DiscordIntegrationService {
  private readonly logger = new Logger(DiscordIntegrationService.name)
  
  constructor(
    private readonly eventBus: EventBusService,
    private readonly discordService: DiscordService
  ) {
    this.registerEventHandlers()
  }
  
  private registerEventHandlers(): void {
    this.eventBus.subscribeMany([
      {
        eventName: 'character.updated',
        handler: { handle: this.handleCharacterUpdated.bind(this) }
      },
      {
        eventName: 'character.created',
        handler: { handle: this.handleCharacterCreated.bind(this) }
      },
      {
        eventName: 'character.not.found',
        handler: { handle: this.handleCharacterNotFound.bind(this) }
      },
      {
        eventName: 'character.validation.failed',
        handler: { handle: this.handleCharacterValidationFailed.bind(this) }
      }
    ])
  }
  
  // Discord からのリクエストをドメインイベントに変換
  async requestCharacterUpdate(
    channelId: string,
    updateData: UpdateCharacterDto,
    userId?: string
  ): Promise<void> {
    await this.eventBus.publish(
      new CharacterUpdateRequested(channelId, updateData, 'discord', userId)
    )
  }
  
  async requestCharacterCreation(
    createData: CreateCharacterDto,
    userId: string
  ): Promise<void> {
    await this.eventBus.publish(
      new CharacterCreationRequested(createData, 'discord', userId)
    )
  }
  
  // ドメインイベントを Discord の UI 更新に変換
  async handleCharacterUpdated(event: CharacterUpdated): Promise<void> {
    this.logger.log(`Updating Discord UI for character: ${event.character.id}`)
    
    try {
      // Discord Embed更新
      await this.discordService.updateCharacterEmbed(event.character)
      
      // 変更通知（必要に応じて）
      if (event.changedFields.includes('characterName')) {
        await this.discordService.notifyCharacterNameChange(
          event.character,
          event.previousData.characterName
        )
      }
      
    } catch (error) {
      this.logger.error(`Error updating Discord UI:`, error)
    }
  }
  
  async handleCharacterCreated(event: CharacterCreated): Promise<void> {
    this.logger.log(`Creating Discord UI for new character: ${event.character.id}`)
    
    try {
      // 新しいキャラクター用のチャンネル/スレッド作成
      await this.discordService.createCharacterChannel(event.character)
      
      // キャラクターEmbed作成
      await this.discordService.createCharacterEmbed(event.character)
      
    } catch (error) {
      this.logger.error(`Error creating Discord UI for new character:`, error)
    }
  }
  
  async handleCharacterNotFound(event: CharacterNotFound): Promise<void> {
    this.logger.warn(`Character not found: ${JSON.stringify(event.searchCriteria)}`)
    
    // Discord UIに適切なエラーメッセージを表示
    if (event.searchCriteria.channelId) {
      await this.discordService.sendErrorMessage(
        event.searchCriteria.channelId,
        'キャラクターが見つかりませんでした。'
      )
    }
  }
  
  async handleCharacterValidationFailed(event: CharacterValidationFailed): Promise<void> {
    this.logger.warn(`Character validation failed: ${event.validationErrors.join(', ')}`)
    
    // Discord UIに検証エラーを表示
    const errorMessage = `入力データに問題があります:\n${event.validationErrors.join('\n')}`
    
    // 元のインタラクションに対してエラーレスポンス
    // (実装詳細は具体的なDiscordインタラクションの種類による)
  }
}
```

#### **4.2 Discord Events Layer 簡素化**
```typescript
// src/discord/events/handlers/character-modal.handler.ts
@Injectable()
export class CharacterModalHandler {
  constructor(
    private readonly discordIntegration: DiscordIntegrationService
  ) {}
  
  async handleCharacterInfoUpdate(
    interaction: ModalSubmitInteraction,
    updateData: UpdateCharacterDto
  ): Promise<void> {
    // シンプルにドメインイベントを発行するだけ
    await this.discordIntegration.requestCharacterUpdate(
      interaction.channelId!,
      updateData,
      interaction.user.id
    )
    
    // UI フィードバック
    await interaction.reply({
      content: 'キャラクター情報の更新を受け付けました。',
      ephemeral: true
    })
  }
  
  async handleCharacterCreation(
    interaction: CommandInteraction,
    createData: CreateCharacterDto
  ): Promise<void> {
    // ドメインイベントを発行
    await this.discordIntegration.requestCharacterCreation(
      createData,
      interaction.user.id
    )
    
    // UI フィードバック
    await interaction.reply({
      content: 'キャラクター作成を開始しました...',
      ephemeral: true
    })
  }
}
```

---

## 📊 **移行戦略**

### **✅ Phase 1 完了: 基盤構築 (Week 1)**

#### **1.1 完了項目**
- ✅ `BaseEvent` クラス作成
- ✅ `EventBusService` 実装
- ✅ Character関連イベント定義
- ✅ `CharacterApplicationService` 実装
- ✅ SharedModule統合

### **✅ Phase 1.5 完了: プロトタイプ検証 (3 days)**

#### **1.5.1 プロトタイプ実装成果**
- ✅ **CharacterNameUpdatePrototype**: キャラクター名更新の最小実装
- ✅ **DiscordCharacterNamePrototype**: Discord UI更新の統合
- ✅ **Feature Flag System**: 段階的移行のための切り替え機能
- ✅ **パフォーマンス検証**: 100ms以下の処理時間達成
- ✅ **包括的テスト**: 19個の単体テスト全て成功

#### **1.5.2 検証結果**
- ✅ **機能性**: Discord モーダルからの名前更新が正常動作
- ✅ **信頼性**: エラーハンドリングが適切に動作
- ✅ **性能**: 既存システムと同等以下の処理時間
- ✅ **保守性**: 明確な責務分離とテスタビリティ
- ✅ **拡張性**: 他機能への適用パターンが確立

### **🔄 Phase 2 進行中: Character ドメイン移行 (Week 2)**

#### **2.1 移行対象機能**
```typescript
// 移行対象メソッド (優先順位順)
1. updateByChannelId() - ✅ プロトタイプで検証済み
2. create() - 新規キャラクター作成
3. deleteByChannelId() - キャラクター削除
4. findByChannelId() - 検索機能
5. updateCharacterStatus() - ステータス更新
6. updateCharacterImage() - 画像更新
```

#### **2.2 実装アプローチ**
```typescript
// 段階的移行のための拡張パターン
@Injectable()
export class CharacterService {
  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly eventBus: EventBusService,
    private readonly configService: AppConfigService
  ) {}
  
  async updateByChannelId(
    channelId: string,
    updateData: UpdateCharacterDto,
    userId?: string
  ): Promise<Character | null> {
    const useEventDriven = this.configService.get('prototype.characterNameUpdate')
    
    if (useEventDriven) {
      // Phase 2: イベント駆動方式
      await this.eventBus.publish(
        new CharacterUpdateRequested(channelId, updateData, 'api', userId)
      )
      
      // 非同期処理結果を待つ仕組み（Phase 2で実装）
      return await this.waitForCharacterUpdateResult(channelId, updateData)
    } else {
      // Phase 1: 既存の直接呼び出し方式
      return await this.characterRepository.updateByChannelId(channelId, updateData)
    }
  }
  
  private async waitForCharacterUpdateResult(
    channelId: string,
    updateData: UpdateCharacterDto
  ): Promise<Character | null> {
    // イベント結果を待つ機能（Phase 2で実装）
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Character update timeout'))
      }, 5000)
      
      const successHandler = (event: CharacterUpdated) => {
        if (event.character.channelId === channelId) {
          clearTimeout(timeout)
          resolve(event.character)
        }
      }
      
      const errorHandler = (event: CharacterUpdateFailed) => {
        if (event.channelId === channelId) {
          clearTimeout(timeout)
          reject(new Error(event.error))
        }
      }
      
      this.eventBus.subscribe('character.updated', { handle: successHandler })
      this.eventBus.subscribe('character.update.failed', { handle: errorHandler })
    })
  }
}
```

#### **2.3 Phase 2 実装計画**

##### **2.3.1 キャラクター作成機能の移行**
```typescript
// 新しいイベント定義
export class CharacterCreationRequested extends DomainEvent {
  constructor(
    public readonly createData: CreateCharacterDto,
    public readonly userId: string,
    public readonly source: 'discord' | 'web' | 'api' = 'discord'
  ) {
    super(userId)
  }
  
  getEventName(): string {
    return 'character.creation.requested'
  }
}

export class CharacterCreated extends DomainEvent {
  constructor(
    public readonly character: Character,
    public readonly source: string
  ) {
    super(character.id)
  }
  
  getEventName(): string {
    return 'character.created'
  }
}

export class CharacterCreationFailed extends DomainEvent {
  constructor(
    public readonly createData: CreateCharacterDto,
    public readonly error: string,
    public readonly validationErrors?: string[]
  ) {
    super('creation-failed-' + Date.now())
  }
  
  getEventName(): string {
    return 'character.creation.failed'
  }
}
```

##### **2.3.2 Application Service 拡張**
```typescript
// CharacterApplicationService に作成機能を追加
async handleCharacterCreationRequest(
  event: CharacterCreationRequested
): Promise<void> {
  this.logger.log(`Handling character creation request for user: ${event.userId}`)
  
  try {
    // 1. ユーザー存在確認
    const user = await this.userRepository.findByDiscordId(event.userId)
    if (!user) {
      await this.eventBus.publish(
        new UserNotFound(event.userId, event.source)
      )
      return
    }
    
    // 2. ビジネスルール検証
    const userCharacters = await this.characterRepository.findByUserId(event.userId)
    if (userCharacters.length >= 50) {
      await this.eventBus.publish(
        new CharacterLimitExceeded(event.userId, userCharacters.length, event.source)
      )
      return
    }
    
    // 3. データ検証
    const validationErrors = this.validateCreationData(event.createData)
    if (validationErrors.length > 0) {
      await this.eventBus.publish(
        new CharacterCreationFailed(
          event.createData,
          'Validation failed',
          validationErrors
        )
      )
      return
    }
    
    // 4. キャラクター作成
    const character = await this.characterRepository.create(event.createData)
    
    // 5. 成功イベント発行
    await this.eventBus.publish(
      new CharacterCreated(character, event.source)
    )
    
    this.logger.log(`Character created successfully: ${character.id}`)
    
  } catch (error) {
    this.logger.error(`Error handling character creation request:`, error)
    await this.eventBus.publish(
      new CharacterCreationFailed(event.createData, error.message)
    )
  }
}
```

##### **2.3.3 Discord Integration 拡張**
```typescript
// DiscordIntegrationService に作成機能を追加
async handleCharacterCreated(event: CharacterCreated): Promise<void> {
  this.logger.log(`Creating Discord UI for new character: ${event.character.id}`)
  
  try {
    // 1. 専用チャンネル/スレッド作成
    const channel = await this.discordService.createCharacterChannel(
      event.character.gameSystemId,
      event.character.characterName,
      event.character.discordUserId
    )
    
    // 2. キャラクター情報を更新（チャンネルID設定）
    await this.characterRepository.updateById(event.character.id, {
      channelId: channel.id
    })
    
    // 3. 初期Embed作成
    await this.discordService.createInitialCharacterEmbed(
      channel.id,
      event.character
    )
    
    this.logger.log(`Discord UI created for character: ${event.character.id}`)
    
  } catch (error) {
    this.logger.error(`Error creating Discord UI for character:`, error)
    
    // エラー時の補償処理
    await this.eventBus.publish(
      new CharacterDiscordSetupFailed(event.character.id, error.message)
    )
  }
}
```

#### **2.4 Phase 2 実装スケジュール**

##### **Day 1-2: キャラクター作成機能**
- [ ] CharacterCreationRequested/Created/Failed イベント定義
- [ ] CharacterApplicationService.handleCharacterCreationRequest 実装
- [ ] DiscordIntegrationService.handleCharacterCreated 実装
- [ ] CharacterService.create() にFeature Flag追加

##### **Day 3-4: キャラクター削除機能**
- [ ] CharacterDeletionRequested/Deleted/Failed イベント定義
- [ ] 削除時のビジネスルール実装（権限チェック、関連データ処理）
- [ ] Discord チャンネル削除処理
- [ ] CharacterService.deleteByChannelId() にFeature Flag追加

##### **Day 5-6: 検索・ステータス更新機能**
- [ ] CharacterQueryRequested/Found/NotFound イベント定義
- [ ] CharacterStatusUpdateRequested/Updated イベント定義
- [ ] 対応するApplication Service実装
- [ ] Discord UI更新処理

##### **Day 7: 統合テスト・デバッグ**
- [ ] 全機能のEnd-to-Endテスト
- [ ] パフォーマンス測定
- [ ] エラーハンドリングの検証
- [ ] Feature Flag切り替えテスト

### **Phase 3: Discord統合層リファクタリング (Week 3)**

#### **3.1 EventsModule 簡素化**
```typescript
// Phase 3 で実装する構造
EventsModule
├── imports: [DiscordIntegrationModule]
├── providers: [
│   ButtonEventHandler,
│   ModalEventHandler,
│   SelectMenuEventHandler,
│   CommandEventHandler
│ ]
└── exports: [EventHandlers]

// 各ハンドラーはDiscordIntegrationServiceを使用
@Injectable()
export class ButtonEventHandler {
  constructor(
    private readonly discordIntegration: DiscordIntegrationService
  ) {}
  
  async handleCharacterDiceButton(interaction: ButtonInteraction): Promise<void> {
    // 複雑なビジネスロジックは持たず、イベント発行のみ
    await this.discordIntegration.requestDiceRoll(
      interaction.channelId!,
      interaction.customId,
      interaction.user.id
    )
    
    await interaction.reply({
      content: 'ダイスロールを実行しています...',
      ephemeral: true
    })
  }
}
```

#### **3.2 循環依存の完全除去**
```typescript
// Phase 3 で実現する依存関係
DiscordModule → DiscordIntegrationModule → EventBusModule
                                        ↓
EventBusModule → CharacterApplicationModule → CharacterDomainModule
              → DiceRollApplicationModule  → DiceRollDomainModule
              → UserApplicationModule      → UserDomainModule
                                        ↓
                               CharacterInfrastructureModule
                               DiceRollInfrastructureModule
                               UserInfrastructureModule
```

### **Phase 4: テスト・最適化 (Week 4)**

#### **4.1 包括的テスト戦略**
```typescript
// 各層のテスト戦略
1. Domain Layer Tests (単体テスト)
   - イベント定義のテスト
   - ドメインロジックのテスト
   - 値オブジェクトのテスト

2. Application Layer Tests (統合テスト)
   - Application Service の各メソッドテスト
   - イベントハンドラーのテスト
   - ビジネスルール検証のテスト

3. Infrastructure Layer Tests (統合テスト)
   - Repository実装のテスト
   - 外部サービス統合のテスト
   - データベース操作のテスト

4. Presentation Layer Tests (E2Eテスト)
   - Discord インタラクションのテスト
   - API エンドポイントのテスト
   - エラーハンドリングのテスト
```

#### **4.2 パフォーマンス最適化**
- [ ] イベントバッチ処理の実装
- [ ] 非同期処理の最適化
- [ ] メモリ使用量の監視
- [ ] レスポンス時間の監視

#### **4.3 運用監視**
- [ ] イベントフロー可視化
- [ ] エラー監視アラート
- [ ] パフォーマンス監視ダッシュボード
- [ ] ビジネスメトリクス取得

---

## 🎯 **期待される効果**

### **1. アーキテクチャ品質向上**
- **循環依存の完全解決**: モジュール間の一方向依存
- **責務分離の明確化**: 各層の役割が明確
- **テスタビリティ大幅向上**: 独立したユニットテスト可能

### **2. 開発効率向上**
- **変更の影響範囲限定**: ドメインロジック変更がUIに影響しない
- **並行開発促進**: 各層を独立して開発可能
- **デバッグ効率向上**: イベントログによる処理追跡

### **3. 拡張性・保守性向上**
- **新機能追加の容易さ**: 新しいイベントハンドラーを追加するだけ
- **外部システム統合**: Slack、Teams等の追加が容易
- **ビジネスルール変更**: ドメイン層のみの変更で対応可能

### **4. パフォーマンス・信頼性向上**
- **非同期処理**: UI応答性向上
- **エラー隔離**: 一部の処理失敗が全体に影響しない
- **イベントソーシング**: 監査ログ、デバッグ情報の蓄積

---

## 🚨 **リスクと対策**

### **主要リスク**

#### **1. 移行中の機能停止リスク**
- **リスク**: 既存機能が一時的に利用不可能になる
- **対策**: Feature Flag による段階的移行
- **緊急時対応**: 即座に旧システムに切り戻し可能

#### **2. 複雑性増加リスク**
- **リスク**: イベント駆動により処理フローが複雑化
- **対策**: 詳細なドキュメント、フロー図の作成
- **監視**: イベントフローの可視化ツール導入

#### **3. パフォーマンス懸念**
- **リスク**: イベント処理によるレイテンシ増加
- **対策**: 非同期処理の最適化、イベントバッチ処理
- **モニタリング**: APM ツールでの性能監視

#### **4. チーム学習コスト**
- **リスク**: 新しいアーキテクチャパターンの学習時間
- **対策**: 段階的な教育プログラム、ペアプログラミング
- **サポート**: アーキテクチャガイドライン作成

### **対策詳細**

#### **A. Feature Flag システム**
```typescript
// 機能切り替えのための設定
export const FeatureFlags = {
  USE_EVENT_DRIVEN_CHARACTER_UPDATE: process.env.USE_EVENT_DRIVEN_CHARACTER_UPDATE === 'true',
  USE_EVENT_DRIVEN_CHARACTER_CREATE: process.env.USE_EVENT_DRIVEN_CHARACTER_CREATE === 'true',
  USE_EVENT_DRIVEN_CHARACTER_DELETE: process.env.USE_EVENT_DRIVEN_CHARACTER_DELETE === 'true',
  USE_EVENT_DRIVEN_DICE_ROLL: process.env.USE_EVENT_DRIVEN_DICE_ROLL === 'true',
  ENABLE_EVENT_STORE: process.env.ENABLE_EVENT_STORE === 'true'
}
```

#### **B. 段階的移行計画**
```typescript
// Phase 2: Character機能完全移行 (50% 移行)
// Phase 3: Discord統合層リファクタリング (80% 移行)
// Phase 4: 全機能移行完了 (100% 移行)
```

#### **C. ロールバック戦略**
```typescript
// 緊急時の即座切り戻し
if (EMERGENCY_ROLLBACK) {
  // すべてのFeature Flagを無効化
  Object.keys(FeatureFlags).forEach(key => {
    FeatureFlags[key] = false
  })
  // 旧システムで継続稼働
}
```

---

## 📚 **参考資料・学習リソース**

### **書籍**
- "Domain-Driven Design" by Eric Evans
- "Implementing Domain-Driven Design" by Vaughn Vernon
- "Event-Driven Architecture" by Hugh McKee

### **実装パターン**
- CQRS (Command Query Responsibility Segregation)
- Event Sourcing
- Hexagonal Architecture
- Clean Architecture

### **技術スタック**
- NestJS Event Emitter
- MongoDB Change Streams
- RxJS Observables
- Class Transformer/Validator

---

## 🧪 **プロトタイプ作成計画**

### **プロトタイプ目標**
新しいイベント駆動アーキテクチャの実行可能性を検証し、既存システムとの共存を確認する最小限の実装を作成します。

### **Phase 1.5: プロトタイプ実装 (3-5 days)**

#### **1. プロトタイプ対象機能**
- **Character Name Update** (キャラクター名更新)
  - 理由: 最もシンプルで影響範囲が限定的
  - 検証項目: Event Bus, Application Service, Discord Integration

#### **2. プロトタイプ実装範囲**
```typescript
// プロトタイプで実装する最小限の機能
CharacterNameUpdateRequested → CharacterApplicationService → CharacterNameUpdated
                                         ↓
                                CharacterRepository.updateName()
                                         ↓
                                DiscordIntegrationService.updateCharacterNameInDiscord()
```

#### **3. プロトタイプ実装ファイル**
```bash
# 新規作成ファイル
src/domains/character/application/prototype/
├── character-name-update.prototype.ts
├── character-name-events.prototype.ts
└── prototype.module.ts

# 既存ファイル拡張
src/domains/character/character.service.ts (Feature Flag追加)
src/discord/events/modal/add-chara-info.service.ts (プロトタイプ呼び出し)
```

#### **4. プロトタイプ成功基準**
- ✅ Discord モーダルからキャラクター名更新が正常動作
- ✅ イベントログが正しく出力される
- ✅ 既存機能に影響を与えない
- ✅ エラーハンドリングが適切に動作
- ✅ 処理時間が既存システムと同等以下

#### **5. プロトタイプ検証項目**
- **機能性**: 基本的な更新処理が動作する
- **信頼性**: エラー時の適切な処理
- **性能**: レスポンス時間の測定
- **保守性**: コードの可読性・テスタビリティ
- **拡張性**: 他機能への適用可能性

### **プロトタイプ実装コード**

#### **1. プロトタイプ専用イベント**
```typescript
// src/domains/character/application/prototype/character-name-events.prototype.ts
export class CharacterNameUpdateRequestedPrototype extends DomainEvent {
  constructor(
    public readonly channelId: string,
    public readonly newName: string,
    public readonly userId: string
  ) {
    super(channelId)
  }
  
  getEventName(): string {
    return 'character.name.update.requested.prototype'
  }
}

export class CharacterNameUpdatedPrototype extends DomainEvent {
  constructor(
    public readonly characterId: string,
    public readonly oldName: string,
    public readonly newName: string,
    public readonly channelId: string
  ) {
    super(characterId)
  }
  
  getEventName(): string {
    return 'character.name.updated.prototype'
  }
}
```

#### **2. プロトタイプ Application Service**
```typescript
// src/domains/character/application/prototype/character-name-update.prototype.ts
@Injectable()
export class CharacterNameUpdatePrototype {
  private readonly logger = new Logger(CharacterNameUpdatePrototype.name)
  
  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly eventBus: EventBusService
  ) {
    this.registerEventHandlers()
  }
  
  private registerEventHandlers(): void {
    this.eventBus.subscribe(
      'character.name.update.requested.prototype',
      { handle: this.handleCharacterNameUpdateRequest.bind(this) }
    )
  }
  
  async handleCharacterNameUpdateRequest(
    event: CharacterNameUpdateRequestedPrototype
  ): Promise<void> {
    const startTime = Date.now()
    this.logger.log(`[PROTOTYPE] Processing character name update: ${event.channelId}`)
    
    try {
      // 1. 既存キャラクター取得
      const character = await this.characterRepository.findByChannelId(event.channelId)
      
      if (!character) {
        this.logger.error(`[PROTOTYPE] Character not found: ${event.channelId}`)
        return
      }
      
      // 2. 名前変更
      const oldName = character.characterName
      const updateData = { characterName: event.newName }
      
      const updatedCharacter = await this.characterRepository.updateByChannelId(
        event.channelId,
        updateData
      )
      
      if (!updatedCharacter) {
        this.logger.error(`[PROTOTYPE] Failed to update character name: ${event.channelId}`)
        return
      }
      
      // 3. 成功イベント発行
      await this.eventBus.publish(
        new CharacterNameUpdatedPrototype(
          updatedCharacter.id,
          oldName,
          event.newName,
          event.channelId
        )
      )
      
      const processingTime = Date.now() - startTime
      this.logger.log(
        `[PROTOTYPE] Character name updated successfully in ${processingTime}ms: ${updatedCharacter.id}`
      )
      
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error updating character name:`, error)
      throw error
    }
  }
}
```

#### **3. Discord Integration プロトタイプ**
```typescript
// src/discord/application/prototype/discord-character-name.prototype.ts
@Injectable()
export class DiscordCharacterNamePrototype {
  private readonly logger = new Logger(DiscordCharacterNamePrototype.name)
  
  constructor(
    private readonly eventBus: EventBusService,
    private readonly discordService: DiscordService
  ) {
    this.registerEventHandlers()
  }
  
  private registerEventHandlers(): void {
    this.eventBus.subscribe(
      'character.name.updated.prototype',
      { handle: this.handleCharacterNameUpdated.bind(this) }
    )
  }
  
  async requestCharacterNameUpdate(
    channelId: string,
    newName: string,
    userId: string
  ): Promise<void> {
    this.logger.log(`[PROTOTYPE] Requesting character name update: ${channelId}`)
    
    await this.eventBus.publish(
      new CharacterNameUpdateRequestedPrototype(channelId, newName, userId)
    )
  }
  
  async handleCharacterNameUpdated(
    event: CharacterNameUpdatedPrototype
  ): Promise<void> {
    this.logger.log(`[PROTOTYPE] Updating Discord UI for character name change: ${event.characterId}`)
    
    try {
      // Discord Embed の更新
      // 実装は既存のDiscordServiceメソッドを使用
      await this.discordService.updateCharacterEmbedName(
        event.channelId,
        event.oldName,
        event.newName
      )
      
      this.logger.log(`[PROTOTYPE] Discord UI updated successfully`)
      
    } catch (error) {
      this.logger.error(`[PROTOTYPE] Error updating Discord UI:`, error)
    }
  }
}
```

#### **4. Feature Flag Integration**
```typescript
// src/domains/character/character.service.ts (既存サービス拡張)
@Injectable()
export class CharacterService {
  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly prototypeService: CharacterNameUpdatePrototype,
    @Inject('PROTOTYPE_CHARACTER_NAME_UPDATE') 
    private readonly usePrototype: boolean = false
  ) {}
  
  async updateCharacterName(
    channelId: string,
    newName: string,
    userId: string
  ): Promise<Character | null> {
    if (this.usePrototype) {
      // プロトタイプ版を使用
      await this.prototypeService.requestCharacterNameUpdate(channelId, newName, userId)
      return null // 非同期処理のため即座にnullを返す
    } else {
      // 既存の直接更新
      return await this.characterRepository.updateByChannelId(channelId, { characterName: newName })
    }
  }
}
```

---

## 🎯 **次の作業項目**

### **Phase 2 開始: Character ドメイン移行**

#### **優先順位 1: キャラクター作成機能の移行**
1. **イベント定義** (30分)
   - CharacterCreationRequested
   - CharacterCreated
   - CharacterCreationFailed

2. **Application Service 拡張** (60分)
   - handleCharacterCreationRequest メソッド実装
   - ビジネスルール検証ロジック
   - エラーハンドリング

3. **Discord Integration 拡張** (45分)
   - handleCharacterCreated メソッド実装
   - チャンネル作成処理
   - 初期Embed作成

4. **既存サービス拡張** (30分)
   - CharacterService.create() にFeature Flag追加
   - 段階的移行のための分岐処理

5. **テスト実装** (60分)
   - 単体テスト
   - 統合テスト
   - エラーケーステスト

**推定所要時間: 3-4時間**

これらの作業を完了後、キャラクター削除機能、検索機能の順で進めていきます。