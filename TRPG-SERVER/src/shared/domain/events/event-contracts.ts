/**
 * イベント契約の型定義
 * すべてのイベントの名前と引数の型を定義
 */

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
    character: import('../../../domains/character/models/character.model').Character | null
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
    character: import('../../../domains/character/models/character.model').Character | null
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
    character: import('../../../domains/character/models/character.model').Character | null
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
    updateData: import('../../../domains/character/dto/update-character.dto').UpdateCharacterDto
    userId?: string
    source: string
    timestamp: Date
  }

  'character.update.completed': {
    channelId: string
    character: import('../../../domains/character/models/character.model').Character
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
    createData: import('../../../domains/character/dto/create-character.dto').CreateCharacterDto
    userId: string
    source: string
    timestamp: Date
  }

  'character.creation.completed': {
    character: import('../../../domains/character/models/character.model').Character
    source: string
    timestamp: Date
  }

  'character.creation.failed': {
    createData: import('../../../domains/character/dto/create-character.dto').CreateCharacterDto
    error: string
    source: string
    timestamp: Date
  }

  // Character更新イベント（汎用）
  'character.updated': {
    character: import('../../../domains/character/models/character.model').Character
    updateType: string
    channelId?: string
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
    result: import('../../../discord/utils/dice.util').DiceResult
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
    character: import('../../../domains/character/models/character.model').Character
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
    character: import('../../../domains/character/models/character.model').Character
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
    character: import('../../../domains/character/models/character.model').Character
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
    character: import('../../../domains/character/models/character.model').Character
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
    character?: import('../../../domains/character/models/character.model').Character
    embed?: any
    success: boolean
    source: string
    timestamp: Date
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
    character: import('../../../domains/character/models/character.model').Character
    displayOptions: any
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
