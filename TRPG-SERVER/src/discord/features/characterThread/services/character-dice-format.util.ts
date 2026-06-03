import { DiceRollRequest, DiceRollResult } from 'src/discord/utils/dice-roll.interface'

/**
 * character-dice-buttons の純粋関数（副作用なし・discord.js / Nest 非依存）。
 *
 * ここに置く関数は I/O・DI・framework に依存しない計算/整形のみ。
 * （ARCHITECTURE §12 決定表：純粋関数で feature 固有なら同 feature 配下の util）
 */

/** ダイスロール結果に応じた絵文字を取得（挙動は元 getResultStyle と同一） */
export function getResultEmoji(
  diceResult: { critical?: boolean; fumble?: boolean; success?: boolean; failure?: boolean },
  result: number
): string {
  if (diceResult.critical || result < 5) {
    return '🌟 ' // クリティカル
  } else if (diceResult.fumble || result > 95) {
    return '💥' // ファンブル
  } else if (diceResult.success) {
    return '✅' // 成功
  } else if (diceResult.failure) {
    return '❌' // 失敗
  } else {
    return '🎲' // 普通のロール
  }
}

/** スレッドへ送信する結果テキストをフォーマット（挙動は元 formatResultText と同一） */
export function formatResultText(
  resultEmoji: string,
  characterName: string,
  skillName: string | null,
  diceText: string
): string {
  if (skillName) {
    return `${resultEmoji}**${characterName}** の **${skillName}** ロール：${diceText}`
  } else {
    return `${resultEmoji}**${characterName}**：${diceText}`
  }
}

/** 成功度を日本語テキストへ変換（挙動は元 getSuccessText と同一） */
export function getSuccessText(success: boolean | number): string {
  // boolean型の場合
  if (typeof success === 'boolean') {
    return success ? '成功' : '失敗'
  }

  // number型の場合
  switch (success) {
    case 1:
      return '成功'
    case 2:
      return 'ハード成功'
    case 3:
      return 'イクストリーム成功'
    case 4:
      return 'クリティカル'
    case -1:
      return '失敗'
    case -2:
      return 'ファンブル'
    default:
      return '不明'
  }
}

/**
 * ダイスロール結果をテキスト形式でフォーマット（挙動は元 formatDiceRollResultAsText と同一）。
 *
 * 末尾に現在時刻（toLocaleTimeString）を含むため厳密には決定的ではないが、
 * 入力→整形のロジックは純粋。時刻取得は呼び出し時点の現在時刻に依存する。
 */
export function formatDiceRollResultAsText(result: DiceRollResult, req: DiceRollRequest): string {
  let text = '🎲 **ダイスロール結果**\n\n'

  // キャラクター情報
  if (req.characterName) {
    text += `**キャラクター**: ${req.characterName}\n`
  }

  // スキル名と目標値
  if (req.skillName) {
    text += `**スキル**: ${req.skillName}`
    if (req.targetValue) {
      text += ` (目標値: ${req.targetValue})`
    }
    text += '\n'
  }

  // ダイス記法と結果
  text += `**ダイス**: ${req.notation}\n`
  text += `**結果**: ${result.result}\n`

  // 成功判定の結果
  if (result.success !== undefined) {
    text += `**判定**: ${getSuccessText(result.success)}\n`
  }

  // タイムスタンプ
  text += `\n_${new Date().toLocaleTimeString()}_`

  return text
}
