/**
 * Thread Manager Util
 *
 * ThreadManagerService から抽出した「純粋ロジック」群。
 * Discord I/O（fetch/create 等の副作用）や Date.now / setTimeout は一切持たず、
 * 入力（文字列・数値）から出力（文字列・数値）を組み立てるだけ。
 * 既存の thread-creation.util.ts / channel-manager.util.ts と同じ方針。
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

// E-3d: buildCreationFailedPayload は dead emit（恒常購読者ゼロの失敗イベント）専用の
// payload 組立関数だったため、emit 撤去に伴い削除した。
// E-3f: 作成完了イベント payload の組立関数（と専用入力型 CreationEventInput）も同様に
// dead emit（恒常購読者ゼロの作成完了イベント）専用だったため、emit 撤去に伴い削除した。
