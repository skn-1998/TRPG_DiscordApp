import { DomainEvent, ErrorEvent } from '../../../shared/domain/events/base.event'
import { Character } from '../models/character.model'
import { CreateCharacterDto } from '../dto/create-character.dto'
import { UpdateCharacterDto } from '../dto/update-character.dto'

// ========================================
// Command Events (外部からのリクエスト)
// ========================================

/**
 * キャラクター更新リクエストイベント
 */
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

/**
 * キャラクター作成リクエストイベント
 */
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

/**
 * キャラクター削除リクエストイベント
 */
export class CharacterDeletionRequested extends DomainEvent {
  constructor(
    public readonly characterId: string,
    public readonly source: 'discord' | 'web' | 'api' = 'discord',
    public readonly userId: string,
    public readonly reason?: string
  ) {
    super(characterId)
  }

  getEventName(): string {
    return 'character.deletion.requested'
  }
}

/**
 * キャラクター検索リクエストイベント
 */
export class CharacterSearchRequested extends DomainEvent {
  constructor(
    public readonly searchCriteria: {
      characterId?: string
      channelId?: string
      characterName?: string
      userId?: string
    },
    public readonly source: 'discord' | 'web' | 'api' = 'discord',
    public readonly requesterId?: string
  ) {
    super(searchCriteria.characterId || searchCriteria.channelId || searchCriteria.userId || 'search')
  }

  getEventName(): string {
    return 'character.search.requested'
  }
}

// ========================================
// Domain Events (ドメイン内での状態変化)
// ========================================

/**
 * キャラクター更新イベント
 */
export class CharacterUpdated extends DomainEvent {
  constructor(
    public readonly character: Character,
    public readonly previousData: Partial<Character>,
    public readonly changedFields: string[]
  ) {
    super(character.characterId)
  }

  getEventName(): string {
    return 'character.updated'
  }
}

/**
 * キャラクター作成イベント
 */
export class CharacterCreated extends DomainEvent {
  constructor(public readonly character: Character) {
    super(character.characterId)
  }

  getEventName(): string {
    return 'character.created'
  }
}

/**
 * キャラクター削除イベント
 */
export class CharacterDeleted extends DomainEvent {
  constructor(
    public readonly characterId: string,
    public readonly deletedBy: string,
    public readonly deletedCharacterData: Character
  ) {
    super(characterId)
  }

  getEventName(): string {
    return 'character.deleted'
  }
}

/**
 * キャラクター検索完了イベント
 */
export class CharacterFound extends DomainEvent {
  constructor(
    public readonly character: Character,
    public readonly searchCriteria: Record<string, unknown>
  ) {
    super(character.characterId)
  }

  getEventName(): string {
    return 'character.found'
  }
}

/**
 * キャラクター一覧取得完了イベント
 */
export class CharacterListRetrieved extends DomainEvent {
  constructor(
    public readonly characters: Character[],
    public readonly userId: string,
    public readonly filters?: Record<string, unknown>
  ) {
    super(userId)
  }

  getEventName(): string {
    return 'character.list.retrieved'
  }
}

// ========================================
// Error Events (エラー状況)
// ========================================

/**
 * キャラクターが見つからないイベント
 */
export class CharacterNotFound extends ErrorEvent {
  constructor(
    public readonly searchCriteria: {
      characterId?: string
      channelId?: string
      characterName?: string
      userId?: string
    },
    public readonly source: string
  ) {
    super(
      searchCriteria.characterId || searchCriteria.channelId || searchCriteria.userId || 'unknown',
      'Character not found',
      source
    )
  }

  getEventName(): string {
    return 'character.not.found'
  }
}

/**
 * キャラクター検証失敗イベント
 */
export class CharacterValidationFailed extends ErrorEvent {
  constructor(
    public readonly characterData: Partial<Character> | CreateCharacterDto | UpdateCharacterDto,
    public readonly validationErrors: string[],
    public readonly source: string
  ) {
    super(
      'characterId' in characterData ? characterData.characterId || 'validation' : 'validation',
      validationErrors.join('; '),
      source
    )
  }

  getEventName(): string {
    return 'character.validation.failed'
  }
}

/**
 * キャラクター更新失敗イベント
 */
export class CharacterUpdateFailed extends ErrorEvent {
  constructor(
    public readonly channelId: string,
    public readonly updateData: UpdateCharacterDto,
    error: string | Error
  ) {
    super(channelId, error, 'character-service')
  }

  getEventName(): string {
    return 'character.update.failed'
  }
}

/**
 * キャラクター作成失敗イベント
 */
export class CharacterCreationFailed extends ErrorEvent {
  constructor(
    public readonly createData: CreateCharacterDto,
    error: string | Error
  ) {
    super(createData.discordUserId || 'unknown', error, 'character-service')
  }

  getEventName(): string {
    return 'character.creation.failed'
  }
}

/**
 * キャラクター削除失敗イベント
 */
export class CharacterDeletionFailed extends ErrorEvent {
  constructor(
    public readonly characterId: string,
    error: string | Error
  ) {
    super(characterId, error, 'character-service')
  }

  getEventName(): string {
    return 'character.deletion.failed'
  }
}

/**
 * キャラクターアクセス拒否イベント
 */
export class CharacterAccessDenied extends ErrorEvent {
  constructor(
    public readonly characterId: string,
    public readonly userId: string,
    public readonly source: string,
    public readonly action: string = 'access'
  ) {
    super(characterId, `Access denied for user ${userId} to character ${characterId}`, source)
  }

  getEventName(): string {
    return 'character.access.denied'
  }
}

/**
 * キャラクター制限超過イベント
 */
export class CharacterLimitExceeded extends ErrorEvent {
  constructor(
    public readonly userId: string,
    public readonly currentCount: number,
    public readonly maxLimit: number,
    public readonly source: string
  ) {
    super(userId, `Character limit exceeded: ${currentCount}/${maxLimit}`, source)
  }

  getEventName(): string {
    return 'character.limit.exceeded'
  }
}

// ========================================
// System Events (システムイベント)
// ========================================

/**
 * キャラクターDiscord統合イベント
 */
export class CharacterDiscordIntegrationEvent extends DomainEvent {
  constructor(
    public readonly characterId: string,
    public readonly discordAction: 'embed_updated' | 'channel_created' | 'message_sent',
    public readonly discordData: Record<string, unknown>
  ) {
    super(characterId)
  }

  getEventName(): string {
    return 'character.discord.integration'
  }
}

/**
 * キャラクター監査ログイベント
 */
export class CharacterAuditEvent extends DomainEvent {
  constructor(
    public readonly characterId: string,
    public readonly action: string,
    public readonly userId?: string,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(characterId)
  }

  getEventName(): string {
    return 'character.audit'
  }
}
