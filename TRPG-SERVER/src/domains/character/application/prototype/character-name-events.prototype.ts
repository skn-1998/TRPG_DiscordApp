import { DomainEvent } from '../../../../shared/domain/events/base.event'

/**
 * プロトタイプ: キャラクター名更新要求イベント
 * Discord等の外部システムからの名前更新要求を表現
 */
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

/**
 * プロトタイプ: キャラクター名更新完了イベント
 * ドメイン内でのキャラクター名更新完了を表現
 */
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

/**
 * プロトタイプ: キャラクター名更新失敗イベント
 * 更新処理中のエラーを表現
 */
export class CharacterNameUpdateFailedPrototype extends DomainEvent {
  constructor(
    public readonly channelId: string,
    public readonly newName: string,
    public readonly errorMessage: string,
    public readonly userId: string
  ) {
    super(channelId)
  }

  getEventName(): string {
    return 'character.name.update.failed.prototype'
  }
}
