/**
 * ダイスロール履歴の保存先 channelId を解決する純関数群
 *
 * キャラ解決キー（customId 由来 = character.discordChannelId）と保存キーを分離する
 * 2026-06-11 の意味論を、discord.js 非依存の純関数として保持する（E-6e で
 * dice-roll-logic.service.ts / custom-dice-modal.service.ts から移設）。
 * discord 側は interaction → context への変換だけを持つ。
 */

/**
 * ボタン系ロール（DiceRollLogicService）の保存キー解決コンテキスト
 */
export interface DiceSaveChannelContext {
  /** キャラ解決に使った lookup キー（customId 由来） */
  channelId: string
  /** スレッド内の場合の実親チャンネル ID（欠落あり得る） */
  parentId?: string | null
  /** 実行チャンネルがスレッド（Public/Private）かどうか */
  isThread: boolean
}

/**
 * 履歴の保存先 channelId を解決する
 *
 * スレッド内のロールは、結果メッセージの投稿先（実親チャンネル）と同じキーで保存し、
 * /dice-result（実行チャンネルで検索）と一致させる。キャラ登録チャンネルの外で
 * 作成されたスレッドでも履歴が実親チャンネルから引けるようにするための分離。
 * スレッド外・parentId 欠落時は従来どおり lookup キー（customId 由来）で保存する。
 */
export function resolveSaveChannelId(ctx: DiceSaveChannelContext): string {
  if (ctx.isThread) {
    return ctx.parentId ?? ctx.channelId
  }
  return ctx.channelId
}

/**
 * モーダル系ロール（CustomDiceModalService.saveRollHistory）の保存キー解決コンテキスト
 */
export interface ModalSaveChannelContext {
  /** スレッド内の場合の実親チャンネル ID（スレッド外は null/undefined） */
  threadParentId?: string | null
  /** キャラクターの discordChannelId */
  characterChannelId?: string | null
  /** customId 由来の抽出 ID（channelId または characterId） */
  extractedChannelId?: string | null
  /** interaction の現在チャンネル ID */
  currentChannelId?: string | null
}

/**
 * モーダル系ロールの保存先 channelId を 4 段 fallback で解決する
 *
 * 優先順位: スレッド実親チャンネル → character.discordChannelId → customId 由来 → 現在チャンネル。
 * すべて欠落している場合は null（呼び出し元は保存をスキップしてログのみ）。
 */
export function resolveModalSaveChannelId(ctx: ModalSaveChannelContext): string | null {
  return ctx.threadParentId || ctx.characterChannelId || ctx.extractedChannelId || ctx.currentChannelId || null
}
