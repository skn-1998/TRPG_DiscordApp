/**
 * Thread Manager Util
 *
 * ThreadManagerService から抽出した「純粋ロジック」群。
 * Discord I/O（fetch/create/emit 等の副作用）や Date.now / setTimeout は一切持たず、
 * 入力（文字列・数値・Date）から出力（文字列・数値・プレーンな payload オブジェクト）を
 * 組み立てるだけ。既存の thread-creation.util.ts / channel-manager.util.ts と同じ方針。
 */

/**
 * スレッド URL を生成する純粋関数。
 * 形式は `https://discord.com/channels/${guildId}/${threadId}`。
 */
export function buildThreadUrl(guildId: string, threadId: string): string {
  return `https://discord.com/channels/${guildId}/${threadId}`
}

/**
 * Exponential backoff の次回待機ミリ秒を返す純粋関数（現在値の 2 倍）。
 */
export function nextBackoffDelay(current: number): number {
  return current * 2
}

/** スレッド作成完了イベント payload の組立に必要な入力 */
export interface CreationEventInput {
  threadId: string
  characterId: string
  characterName: string
  channelId: string
  creatorId: string
  guildId: string
}

/**
 * `character-thread.creation.completed` の payload を組み立てる純粋関数。
 * timestamp は呼び出し側から Date を注入する（Date.now に触れない）。
 */
export function buildCreationCompletedPayload(
  input: CreationEventInput,
  threadUrl: string,
  timestamp: Date
): {
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
} {
  return {
    threadId: input.threadId,
    discordThreadId: input.threadId,
    threadUrl,
    characterId: input.characterId,
    characterName: input.characterName,
    channelId: input.channelId,
    creatorId: input.creatorId,
    guildId: input.guildId,
    timestamp,
    source: 'thread-manager-service'
  }
}

/**
 * `character-thread.creation.failed` の payload を組み立てる純粋関数。
 * threadId（`temp-${nowMs}` 形式）と timestamp は呼び出し側から注入する。
 */
export function buildCreationFailedPayload(
  input: Omit<CreationEventInput, 'threadId'>,
  tempThreadId: string,
  error: string,
  timestamp: Date
): {
  threadId: string
  characterId: string
  characterName: string
  channelId: string
  creatorId: string
  guildId: string
  error: string
  timestamp: Date
  source: string
} {
  return {
    threadId: tempThreadId,
    characterId: input.characterId,
    characterName: input.characterName,
    channelId: input.channelId,
    creatorId: input.creatorId,
    guildId: input.guildId,
    error,
    timestamp,
    source: 'thread-manager-service'
  }
}
