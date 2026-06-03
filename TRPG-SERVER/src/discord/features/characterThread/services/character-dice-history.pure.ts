import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { DiceRollTextInputDto } from 'src/domains/dice-roll/dto/create-dice-roll-text.dto'

/**
 * CharacterDiceHistoryService から抽出した純粋（および semi-pure）ヘルパ群。
 *
 * - DI なし。引数と戻り値だけで完結する。
 * - 時刻・乱数・I/O には触れない（throttle 判定の `now` 等は引数で受け取る）。
 * - discord.js の Builder 型には触れるが、I/O メソッド（fetch/send/edit）は呼ばない。
 *   discord.js 型に触れる純ヘルパは対象と同じ `interactions/button/` 配下へ置く方針に従う。
 *
 * 本体（imperative shell）が時刻・タイマー・client/channel I/O を担い、本モジュールは
 * 「判定・組立」のみを担当する。挙動は元 CharacterDiceHistoryService と同一。
 */

/**
 * Embed 更新スロットル判定（最重要・本体の2箇所で使用）。
 *
 * 前回更新時刻からの経過が minInterval 以上なら true（更新してよい）、未満なら false（スキップ）。
 * 元コードの分岐:
 *   - handleParentChannelMessage: `timeSinceLastUpdate < MIN_UPDATE_INTERVAL` ならスキップ
 *   - updateDiceRollHistoryAsync: `timeSinceLastUpdate >= MIN_UPDATE_INTERVAL` なら更新
 * を boolean に集約したもの（境界 `===` は更新側＝true）。
 */
export function shouldUpdateEmbed(lastUpdate: number, now: number, minInterval: number): boolean {
  return now - lastUpdate >= minInterval
}

/**
 * ダイスロール保存用 DTO を組み立てる（純粋）。
 *
 * uuid は副作用（乱数）なので呼び出し側で生成して `textId` として注入する。
 * キー・値の構成は元 saveRollResult と同一（userId='system'・後方互換キー含む）。
 */
export function buildSaveTextDto(params: {
  textId: string
  channelId: string
  diceCommand: string
  result: number
  resultText: string
  characterId: string
  characterName: string
}): DiceRollTextInputDto {
  const { textId, channelId, diceCommand, result, resultText, characterId, characterName } = params
  return {
    textId,
    channelId,
    userId: 'system', // 古いサービスから移行中
    diceExpression: diceCommand,
    result,
    resultDetails: resultText,
    characterId,
    characterName,
    // 後方互換性
    text: resultText,
    diceRoll: diceCommand,
    discordChannelId: channelId
  }
}

/**
 * ページネーション状態オブジェクトを組み立てる（純粋）。
 *
 * 元コードでは複数箇所で同じ形（pages / totalPages / currentPage=0 / characterId=undefined / messageId）
 * を組み立てていたため共通化。常に全キャラクター表示のため characterId は undefined。
 */
export function buildPaginationState<T>(
  pages: T[],
  messageId: string
): {
  pages: T[]
  totalPages: number
  currentPage: number
  characterId: undefined
  messageId: string
} {
  return {
    pages,
    totalPages: pages.length,
    currentPage: 0,
    characterId: undefined,
    messageId
  }
}

/**
 * フォールバック用の最小限のコントロール（ナビゲーション3ボタン）を作成する（semi-pure）。
 *
 * discord.js Builder を生成するため厳密な純粋関数ではないが、引数のみに依存し I/O は行わない。
 * customId 形（`dice-prev*${messageId}*${channelId}` 等）は不変（フロント非依存契約）。
 */
export function createFallbackControls(messageId: string, channelId: string): ActionRowBuilder<ButtonBuilder>[] {
  // 基本的なナビゲーションボタン
  const prevButton = new ButtonBuilder()
    .setCustomId(`dice-prev*${messageId}*${channelId}`)
    .setLabel('◀ 前へ')
    .setStyle(ButtonStyle.Primary)

  const pageInfoButton = new ButtonBuilder()
    .setCustomId(`dice-page-info*${messageId}*${channelId}`)
    .setLabel('ページ 1')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true)

  const nextButton = new ButtonBuilder()
    .setCustomId(`dice-next*${messageId}*${channelId}`)
    .setLabel('次へ ▶')
    .setStyle(ButtonStyle.Primary)

  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageInfoButton, nextButton)

  return [buttonRow]
}
