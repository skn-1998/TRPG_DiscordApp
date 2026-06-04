/**
 * characterThread プリセットダイス（system 別クイックロール）customId 契約（純粋モジュール）
 *
 * - 生成フォーマット: `dice_{system}_{action}_{channelId}`
 *   system: coc7 / dnd5e / sw25、action: 1d100 / sanity / save / 2d6 / attack 等、channelId: snowflake（`_` 非含有）。
 * - handler 照合 pattern（正規表現）: `/^dice_(coc7|dnd5e|sw25)_/`
 *   （routed 済みの `dice_generic_` とは prefix が異なるため衝突しない）
 *
 * P1-D 後続（方針A・最小機能化）: これら preset ボタンは実送出されるが従来 registry 未対応だった
 * （クリックで「現在処理できません」）。専用ゲームルール（SAN 値比較・武器ダメージ式等）は未実装かつ
 * findByChannelId が stats を返さないため、暫定として **system 既定 notation を振り action をラベル化**して機能させる。
 *
 * discord.js / NestJS DI に依存しない純粋な文字列契約のみを提供する。
 */

export type PresetDiceSystem = 'coc7' | 'dnd5e' | 'sw25'

/** handler の getCustomIdPattern() が返す正規表現（不変・3 system のいずれか） */
export const PRESET_DICE_CUSTOM_ID_PATTERN = /^dice_(coc7|dnd5e|sw25)_/

export interface ParsedPresetDiceCustomId {
  system: PresetDiceSystem
  action: string
  channelId: string
}

const VALID_SYSTEMS: readonly PresetDiceSystem[] = ['coc7', 'dnd5e', 'sw25']

export const PresetDiceCustomId = {
  pattern: PRESET_DICE_CUSTOM_ID_PATTERN,

  /** `dice_{system}_{action}_{channelId}` を生成する（純粋）。 */
  create(system: PresetDiceSystem, action: string, channelId: string): string {
    return `dice_${system}_${action}_${channelId}`
  },

  /**
   * `dice_{system}_{action}_{channelId}` を分解する（純粋・`dice_generic_` の split 方式に倣う）。
   * `_` split で parts[1]=system / parts[2]=action / parts.slice(3)=channelId。
   * system が coc7/dnd5e/sw25 でない、action / channelId が空の場合は null。
   */
  parse(customId: string): ParsedPresetDiceCustomId | null {
    const parts = customId.split('_')
    if (parts.length < 4 || parts[0] !== 'dice') {
      return null
    }
    const system = parts[1] as PresetDiceSystem
    if (!VALID_SYSTEMS.includes(system)) {
      return null
    }
    const action = parts[2]
    const channelId = parts.slice(3).join('_')
    if (!action || !channelId) {
      return null
    }
    return { system, action, channelId }
  }
} as const

/** system 既定の notation（暫定機能化のロール式）。 */
const SYSTEM_DEFAULT_NOTATION: Record<PresetDiceSystem, string> = {
  coc7: '1d100',
  dnd5e: '1d20',
  sw25: '2d6'
}

/**
 * action ごとの reason ラベル（生成側ボタンラベルに対応）。
 * base action（system 既定 notation そのもの）はラベルのみ、専用ルール未実装の semantic action は「（簡易）」を付す。
 */
const ACTION_REASON: Record<PresetDiceSystem, Record<string, string>> = {
  coc7: {
    '1d100': '技能判定',
    sanity: 'SAN値判定（簡易）',
    idea: 'アイデア（簡易）',
    luck: '幸運（簡易）',
    damage: 'ダメージ（簡易）'
  },
  dnd5e: {
    '1d20': 'd20攻撃',
    save: 'セーヴィング・スロー（簡易）',
    ability: '能力値判定（簡易）',
    damage: 'ダメージ（簡易）'
  },
  sw25: {
    '2d6': '2d6判定',
    attack: '命中判定（簡易）',
    damage: 'ダメージ（簡易）',
    magic: '魔法行使（簡易）'
  }
}

export interface ResolvedPresetDiceRoll {
  /** 実際に振る notation（system 既定。専用ルール未実装のため固定） */
  notation: string
  /** ロール理由（DB 保存・表示に使うラベル） */
  reason: string
}

/**
 * system / action から、暫定機能化のロール notation と reason を解決する（純粋）。
 * notation は system 既定（coc7=1d100 / dnd5e=1d20 / sw25=2d6）固定。
 * reason は既知 action のラベル、未知 action は `${action}（簡易）` フォールバック。
 */
export function resolvePresetDiceRoll(system: PresetDiceSystem, action: string): ResolvedPresetDiceRoll {
  const notation = SYSTEM_DEFAULT_NOTATION[system]
  const reason = ACTION_REASON[system]?.[action] ?? `${action}（簡易）`
  return { notation, reason }
}
