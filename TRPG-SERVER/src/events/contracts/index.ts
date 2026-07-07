/**
 * Events Contracts Index（互換 barrel）
 *
 * 契約の唯一の定義源は unified-event-contracts.ts（E-4a で一本化）。
 * 本ファイルは再エクスポートと、バス（TypedEventService）向けの派生型のみを持つ。
 * ここに payload 型やイベント名を直接定義しないこと。
 */

export * from './unified-event-contracts'

import type { EventMap, EventName, EventPayload } from './unified-event-contracts'

// ============================================================================
// TypedEventService 向け派生型
// ============================================================================

/**
 * 旧 AppEventContracts 互換 alias（unified の map 型から導出）。
 * 旧実装の `[eventName: string]: any` フォールバックと `EventName = string` の弱型は
 * E-4a で廃止した（契約外イベントの emit/on はコンパイルエラーになる）。
 */
export type AppEventContracts = EventMap

// イベントハンドラーの型
export type TypedEventHandler<T extends EventName> = (payload: EventPayload<T>) => Promise<void> | void

// イベントリスナーの型
export interface TypedEventListener<T extends EventName> {
  event: T
  handler: TypedEventHandler<T>
}
