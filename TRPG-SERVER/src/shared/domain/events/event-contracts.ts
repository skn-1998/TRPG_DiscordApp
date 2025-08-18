/**
 * イベント契約の型定義
 * すべてのイベントの名前と引数の型を定義
 * AI.architecture.md設計方針に基づく型安全化対応
 */

// 型エイリアス定義（循環依存回避のため直接import使用）
type CharacterModel = import('../../../domains/character/models/character.model').Character
type UpdateCharacterDto = import('../../../domains/character/dto/update-character.dto').UpdateCharacterDto
type DiceResult = import('../../../discord/utils/dice.util').DiceResult
type FeatureRequester = import('../../../events/contracts/character-events.contract').FeatureRequester

// 新しい型定義のインポート
import { Discord } from '../../../types/discord.types'
import { Character } from '../../../types/character.types'
import { AttributeValue } from '../../../core/types/attribute.types'

// Character関連のイベント契約
export interface CharacterEventContracts {
  // Character検索関連
  'character.findByChannelId.requested': {
    channelId: string
    source: 'character-channel-service' | 'character-tab-buttons-service' | 'discord-facade' | string
    timestamp: Date
    tabType?: string
  }

  'character.findByChannelId.completed': {
    channelId: string
    character: CharacterModel | null
    source: string
    timestamp: Date
  }

  'character.findByChannelId.failed': {
    channelId: string
    error: string
    source: string
    timestamp: Date
  }

  'character.findById.requested': {
    characterId: string
    source: string
    timestamp: Date
  }

  'character.findById.completed': {
    characterId: string
    character: CharacterModel | null
    source: string
    timestamp: Date
  }

  'character.findById.failed': {
    characterId: string
    error: string
    source: string
    timestamp: Date
  }

  'character.findByName.requested': {
    characterName: string
    source: string
    timestamp: Date
  }

  'character.findByName.completed': {
    characterName: string
    character: CharacterModel | null
    source: string
    timestamp: Date
  }

  'character.findByName.failed': {
    characterName: string
    error: string
    source: string
    timestamp: Date
  }

  // Character更新関連
  'character.update.requested': {
    channelId: string
    updateData: UpdateCharacterDto
    userId?: string
    source: string
    timestamp: Date
  }

  'character.update.completed': {
    channelId: string
    character: CharacterModel
    source: string
    timestamp: Date
  }

  'character.update.failed': {
    channelId: string
    error: string
    source: string
    timestamp: Date
  }

  // Character作成関連
  'character.creation.requested': {
    createData: {
      characterName: string
      gameSystemId?: string
      discordUserId?: string
      discordChannelId?: string
      threadId?: string
      status?: Record<string, any>
      parameter?: Record<string, any>
      skill?: Record<string, any>
      item?: Record<string, any>
      description?: Record<string, any>
    }
    requester?: FeatureRequester
    userId: string
    source: string
    timestamp: Date
  }

  'character.creation.completed': {
    character: CharacterModel
    source: string
    timestamp: Date
  }

  'character.creation.failed': {
    createData: {
      characterName: string
      gameSystemId?: string
      discordUserId?: string
      discordChannelId?: string
      threadId?: string
      status?: Record<string, any>
      parameter?: Record<string, any>
      skill?: Record<string, any>
      item?: Record<string, any>
      description?: Record<string, any>
    }
    error: string
    source: string
    timestamp: Date
  }

  // Character更新イベント（汎用）
  'character.updated': {
    character: CharacterModel
    updateType: string
    channelId?: string
    source: string
    timestamp: Date
  }

  // Character作成イベント（汎用）
  'character.created': {
    character: CharacterModel
    source: string
    timestamp: Date
  }

  // Character削除イベント（汎用）
  'character.deleted': {
    character: CharacterModel
    source: string
    timestamp: Date
  }
}

// DiceRoll関連のイベント契約
export interface DiceRollEventContracts {
  'diceroll.execute.requested': {
    channelId: string
    diceExpression: string
    userId: string
    source: string
    timestamp: Date
  }

  'diceroll.execute.completed': {
    channelId: string
    result: DiceResult
    source: string
    timestamp: Date
  }

  'diceroll.execute.failed': {
    channelId: string
    error: string
    source: string
    timestamp: Date
  }
}

// Discord関連のイベント契約
export interface DiscordEventContracts {
  'discord.message.send.requested': {
    channelId: string
    content: string
    embeds?: unknown[]
    source: string
    timestamp: Date
  }

  'discord.channel.create.requested': {
    guildId: string
    channelName: string
    channelType: 'text' | 'voice' | 'category'
    source: string
    timestamp: Date
  }

  'discord.embed.character.update.requested': {
    character: CharacterModel
    channelId: string
    displayType?: 'basic' | 'enhanced' | 'compact'
    source: string
    timestamp: Date
  }

  'discord.embed.character.update.completed': {
    characterId: string
    channelId: string
    success: boolean
    source: string
    timestamp: Date
  }

  'discord.embed.character.update.failed': {
    characterId: string
    channelId: string
    error: string
    source: string
    timestamp: Date
  }

  // スレッド作成関連イベント
  'discord.thread.create.requested': {
    character: CharacterModel
    channelId: string
    guildId: string
    creatorId: string
    displayType?: 'basic' | 'enhanced' | 'compact'
    source: string
    timestamp: Date
  }

  'discord.thread.create.completed': {
    threadId: string
    threadUrl?: string
    character: CharacterModel
    source: string
    timestamp: Date
  }

  'discord.thread.create.failed': {
    characterId: string
    channelId: string
    error: string
    source: string
    timestamp: Date
  }

  // キャラクター表示関連イベント
  'discord.character.display.requested': {
    character: CharacterModel
    channelId: string
    guildId: string
    requesterId: string
    displayType?: 'basic' | 'enhanced' | 'compact'
    source: string
    timestamp: Date
  }

  'discord.character.display.completed': {
    characterId: string
    channelId: string
    success: boolean
    source: string
    timestamp: Date
  }

  'discord.character.display.failed': {
    characterId: string
    channelId: string
    error: string
    source: string
    timestamp: Date
  }

  // メッセージEmbedの更新イベント
  'discord.message.embed.update': {
    channelId: string
    messageId?: string
    character?: CharacterModel
    embed?: Discord.Embed
    success: boolean
    source: string
    timestamp: Date
  }
}

// CharacterEdit Feature関連のイベント契約
export interface CharacterEditEventContracts {
  // Character Creation Events (Event Bridge Integration)
  'characterEdit.creation.requested': {
    type: 'characterEdit.creation.requested'
    characterId: string
    createData: {
      characterName: string
      gameSystemId?: string
      discordUserId?: string
      discordChannelId?: string
      threadId?: string
      status?: Record<string, any>
      parameter?: Record<string, any>
      skill?: Record<string, any>
      item?: Record<string, any>
      description?: Record<string, any>
    }
    editContext: {
      channelId: string
      sectionType?: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      triggeredBy: 'modal' | 'button' | 'select_menu' | 'channel_create'
    }
    originalRequester?: FeatureRequester
    timestamp: Date
    userId?: string
    sessionId?: string
  }

  'characterEdit.creation.completed': {
    type: 'characterEdit.creation.completed'
    characterId: string
    character: CharacterModel
    editContext: {
      channelId: string
      sectionType?: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      triggeredBy: 'modal' | 'button' | 'select_menu' | 'channel_create'
    }
    originalRequester?: FeatureRequester
    timestamp: Date
    userId?: string
    sessionId?: string
  }

  'characterEdit.creation.failed': {
    type: 'characterEdit.creation.failed'
    characterId: string
    createData: {
      characterName: string
      gameSystemId?: string
      discordUserId?: string
      discordChannelId?: string
      threadId?: string
      status?: Record<string, any>
      parameter?: Record<string, any>
      skill?: Record<string, any>
      item?: Record<string, any>
      description?: Record<string, any>
    }
    error: {
      code: string
      message: string
      details?: Record<string, unknown>
    }
    editContext: {
      channelId: string
      sectionType?: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      triggeredBy: 'modal' | 'button' | 'select_menu' | 'channel_create'
    }
    originalRequester?: FeatureRequester
    timestamp: Date
    userId?: string
    sessionId?: string
  }

  // Modal Events
  'characterEdit.modal.opened': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    modal: {
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      fieldKey: string
      currentValue?: AttributeValue
    }
  }

  'characterEdit.modal.submitted': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    modal: {
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      fieldKey: string
      newValue: AttributeValue
      oldValue?: AttributeValue
    }
  }

  'characterEdit.modal.closed': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    modal: {
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      fieldKey: string
      cancelled: boolean
    }
  }

  // Section Events
  'characterEdit.section.selected': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    section: {
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      displayMode: 'list' | 'add' | 'edit'
    }
  }

  'characterEdit.field.selected': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    field: {
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      fieldKey: string
      action: 'edit' | 'add' | 'delete'
    }
  }

  // Validation Events
  'characterEdit.validation.started': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    validation: {
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      fieldKey: string
      value: AttributeValue
    }
  }

  'characterEdit.validation.completed': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    validation: {
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      fieldKey: string
      value: AttributeValue
      isValid: boolean
      errors?: string[]
    }
  }

  // Embed Update Events
  'characterEdit.embed.refresh.requested': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    embed: {
      channelId: string
      embedType: 'enhanced' | 'compact' | 'status' | 'parameter'
      section?: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
    }
  }

  'characterEdit.embed.updated': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    embed: {
      channelId: string
      messageId?: string
      embedType: 'enhanced' | 'compact' | 'status' | 'parameter'
      success: boolean
      updateMode: 'create' | 'update' | 'refresh'
    }
  }

  // Session Management Events
  'characterEdit.session.created': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    session: {
      sessionId: string
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      fieldKey: string
      expiresAt: Date
    }
  }

  'characterEdit.session.expired': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    session: {
      sessionId: string
      sectionType: 'status' | 'parameter' | 'skill' | 'item' | 'basic'
      fieldKey: string
    }
  }

  // Error Events
  'characterEdit.error.occurred': {
    characterId: string
    timestamp: Date
    userId?: string
    sessionId?: string
    error: {
      code: string
      message: string
      operation: string
      details?: Record<string, unknown>
      severity: 'low' | 'medium' | 'high'
    }
  }
}

// CharacterThread関連のイベント契約
export interface CharacterThreadEventContracts {
  // スレッド作成関連
  'character-thread.creation.requested': {
    threadId: string
    characterId: string
    characterName: string
    channelId: string
    creatorId: string
    guildId: string
    character: CharacterModel
    displayOptions: Discord.DisplayOptions
    timestamp: Date
    source: string
  }

  'character-thread.creation.completed': {
    threadId: string
    discordThreadId: string
    threadUrl: string
    characterId: string
    characterName: string
    channelId: string
    creatorId: string
    guildId: string
    timestamp: Date
    source: string
  }

  'character-thread.creation.failed': {
    threadId: string
    characterId: string
    characterName: string
    channelId: string
    creatorId: string
    guildId: string
    error: string
    timestamp: Date
    source: string
  }
}

// 統合されたイベント契約
export interface AppEventContracts
  extends CharacterEventContracts,
    DiceRollEventContracts,
    DiscordEventContracts,
    CharacterEditEventContracts,
    CharacterThreadEventContracts {}

// イベント名の型
export type EventName = keyof AppEventContracts

// 特定のイベントの引数の型を取得するヘルパー型
export type EventPayload<T extends EventName> = AppEventContracts[T]

// イベントハンドラーの型
export type TypedEventHandler<T extends EventName> = (payload: EventPayload<T>) => Promise<void> | void

// イベントリスナーの型
export interface TypedEventListener<T extends EventName> {
  event: T
  handler: TypedEventHandler<T>
}
