import { AttributeSection } from '../../../core/types/attribute.types'

export interface CharacterSheetState {
  templateId: string
  templateVersion: string
  revision: number
  values: Record<string, unknown>
}

export interface CharacterTemplatePin {
  templateId: string
  templateVersion: string
  pinnedBy: string
}

interface CharacterPaletteEntryBase {
  key: string
  fieldRef: {
    uid: string
    rowId?: string
  }
  label: string
  group: string
}

export type CharacterPaletteEntry =
  | (CharacterPaletteEntryBase & {
      kind: 'roll'
      notation: string
      deltas?: never
    })
  | (CharacterPaletteEntryBase & {
      kind: 'resource'
      notation?: never
      deltas: number[]
    })

export type CharacterHubStatus = 'none' | 'publishing' | 'active' | 'error'

export interface CharacterHub {
  status: CharacterHubStatus
  opId?: string
  messageId?: string
  threadId?: string
  pendingRevision?: number
  appliedRevision?: number
  retryAt?: Date
  errorCode?: string
}

export type CharacterHubTransition = Pick<CharacterHub, 'status'> & Partial<Omit<CharacterHub, 'status'>>

export type CharacterState = 'legacy-unpinned' | 'legacy-pinned' | 'materialized'

/**
 * キャラクター公開エンティティ（plain object・E-6d）
 *
 * 🎯 責務:
 * - repository / CharacterService / イベント契約 / discord 層が扱うキャラクターの公開型
 * - Mongoose Document API（save/toObject 等）を持たない plain object であることを型で保証する
 *
 * 📏 契約:
 * - repository 境界で plain 化される（読み取り系は .lean()、create は save 後の .toObject()）。
 *   消費側で toObject ガードや Document 判定は不要。
 * - `_id` は**型としての公開契約に含めない**（永続化の内部事情）。ただし実行時の plain オブジェクトには
 *   従来互換で `_id` が残り得る（lean/toObject は除去しない・summary クエリのみ -_id 指定）。
 *   消費側は `_id` に依存しないこと（依存が必要になったら契約への昇格を検討）。
 * - 既存 DB の default 欠損レコード（旧データ）は lean 経路で schema default 補完を受けない
 *   （E-6d Codex レビュー Low。消費側は optional chaining 前提のため実害は限定的・
 *   新規作成は CharacterService.create が section を正規化して保存するため影響なし）。
 * - createdAt / updatedAt は @Schema({ timestamps: true }) により DB 側で付与される
 *   （作成入力には現れないため optional）。
 * - 永続化スキーマ定義は @Schema クラス `Character`（character.model.ts・persistence 専用）が正。
 *   フィールドを増減する場合は両者を同期させること。
 */
export interface CharacterEntity {
  characterId: string
  characterName: string
  gameSystemId: string
  discordUserId: string
  discordChannelId: string
  discordThreadId?: string
  status: AttributeSection
  skill?: AttributeSection
  parameter?: AttributeSection
  item?: AttributeSection
  description?: AttributeSection
  sheet?: CharacterSheetState
  templatePin?: CharacterTemplatePin
  computedCache?: Record<string, number | string | boolean>
  palette?: CharacterPaletteEntry[]
  hub?: CharacterHub
  appliedInteractionIds?: string[]
  createdAt?: Date
  updatedAt?: Date
}

export type LegacyCharacterEntity = Omit<
  CharacterEntity,
  'sheet' | 'templatePin' | 'computedCache' | 'palette' | 'hub' | 'appliedInteractionIds'
>

/**
 * Phase 2 の3状態を決定的に解決する。
 * sheet が正本なので、移行途中に templatePin と同時に存在しても materialized を優先する。
 */
export const resolveCharacterState = (character: Pick<CharacterEntity, 'sheet' | 'templatePin'>): CharacterState => {
  if (character.sheet !== undefined) return 'materialized'
  if (character.templatePin !== undefined) return 'legacy-pinned'
  return 'legacy-unpinned'
}

export type MaterializedCharacterEntity = Omit<CharacterEntity, 'templatePin'> &
  Required<
    Pick<
      CharacterEntity,
      | 'sheet'
      | 'computedCache'
      | 'palette'
      | 'hub'
      | 'appliedInteractionIds'
      | 'status'
      | 'parameter'
      | 'skill'
      | 'item'
      | 'description'
    >
  > & { templatePin?: never }

export interface SaveSheetMaterializedPayload {
  values: Record<string, unknown>
  computedCache: Record<string, number | string | boolean>
  palette: CharacterPaletteEntry[]
  status: AttributeSection
  parameter: AttributeSection
  skill: AttributeSection
  item: AttributeSection
  description: AttributeSection
  pendingRevision: number
  appliedInteractionIds: string[]
}
