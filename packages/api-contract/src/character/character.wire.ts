import { z } from 'zod'
import {
  attributeSectionSchema,
  attributeValueSchema,
  characterHubStatusSchema,
  characterPaletteEntrySchema,
  characterSheetStateSchema,
  characterTemplatePinSchema,
  type CharacterSheetVisibility
} from './character.zod'

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export type CharacterAttributeValueWire = z.infer<typeof attributeValueSchema>

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export type CharacterAttributeSectionWire = z.infer<typeof attributeSectionSchema>

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export type CharacterSheetStateWire = z.infer<typeof characterSheetStateSchema>

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export type CharacterTemplatePinWire = z.infer<typeof characterTemplatePinSchema>

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export type CharacterPaletteEntryWire = z.infer<typeof characterPaletteEntrySchema>

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export type CharacterHubStatusWire = z.infer<typeof characterHubStatusSchema>

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export interface CharacterHubWire {
  status: CharacterHubStatusWire
  opId?: string
  messageId?: string
  threadId?: string
  pendingRevision?: number
  appliedRevision?: number
  retryAt?: string
  errorCode?: string
}

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export interface CharacterWire {
  _id?: string
  /** mongoose 内部メタ。参照しないこと。 */
  __v?: number
  characterId: string
  characterName: string
  gameSystemId: string
  discordUserId: string
  discordChannelId?: string
  discordThreadId?: string
  status?: CharacterAttributeSectionWire
  skill?: CharacterAttributeSectionWire
  parameter?: CharacterAttributeSectionWire
  item?: CharacterAttributeSectionWire
  description?: CharacterAttributeSectionWire
  sheet?: CharacterSheetStateWire
  templatePin?: CharacterTemplatePinWire
  computedCache?: Record<string, number | string | boolean>
  palette?: CharacterPaletteEntryWire[]
  hub?: CharacterHubWire
  appliedInteractionIds?: string[]
  createdAt?: string
  updatedAt?: string
}

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export interface CharacterSummaryWire {
  characterId: string
  characterName: string
  gameSystemId: string
  visibility: CharacterSheetVisibility
  templateVersion?: string
  hub?: {
    status: CharacterHubStatusWire
  }
}

/**
 * CharacterController の直列化応答形。正典は server 実装。
 * S5/S6 で server 側戻り型の契約参照化により機械固定予定。
 */
export interface CharacterDeleteResultWire {
  message: string
  characterId: string
}

/**
 * PUT /character/:id/sheet について front が消費する保証面。
 *
 * 実 wire には保証外の `character: CharacterEntity` が同乗している。
 * 実 wire をこの保証面まで絞るかは別スライスで決定する。
 */
export interface SaveCharacterSheetResultWire {
  revision: number
  noOp: boolean
  appliedChanges: number
}

/**
 * PUT /character/:id/sheet の真の競合時に ErrorEnvelope.cause へ載る直列化形。
 * cause は server filter が deny 集合（message/statusCode/error/issues）以外の body キーを通す汎用 pass-through。
 * 将来の診断キーを許容しつつ既知の競合契約だけを返すため、外側は .strip() とする。
 */
export const sheetMergeConflictSchema = z
  .object({
    characterId: z.string(),
    conflicts: z
      .array(
        z
          .object({
            path: z
              .object({
                fieldUid: z.string(),
                partsKey: z.string().optional()
              })
              .strict(),
            // z.unknown() 単体は欠落も受理するため、wire に常在する3値は必須に固定する。
            current: z.unknown().nonoptional(),
            base: z.unknown().nonoptional(),
            yours: z.unknown().nonoptional()
          })
          .strict()
      )
      .min(1),
    currentRevision: z.number().int().nonnegative()
  })
  .strip()

export type SheetMergeConflictWire = z.infer<typeof sheetMergeConflictSchema>

/**
 * POST /character/from-template の作成応答限りで提示する出目情報。
 * 永続化後にこの情報を再照会する API はない。
 */
export interface RollOnCreateResultWire {
  uid: string
  label: string
  notation: string
  total: number
  details: string
}

/**
 * POST /character/from-template について front が消費する保証面。
 */
export interface CreateCharacterFromTemplateResultWire {
  characterId: string
  rollOnCreateResults: RollOnCreateResultWire[]
}

/**
 * POST /character/:id/sheet/reroll について front が消費する保証面。
 *
 * `SaveCharacterSheetResultWire` と同じく、実 wire には保証外の `character` が同乗している。
 * 保証面には front が消費する値だけを名指しし、`character` は外に置いたままにする。
 *
 * キー名は作成応答の `RollOnCreateResultWire`（`uid` + `label`）とは揃えていない。
 * シートのパス語彙はリポジトリ全体で `fieldUid` が優勢で（`sheetMergeConflictSchema` の `path.fieldUid` など）、
 * 揃えるならどちらへ寄せるかを別途決める必要があるため、この経路では優勢な語彙を採る。
 */
export interface RerollCreationRollResultWire {
  /**
   * 振り直しで 1 つ進んだ後の revision。front は次の操作の基準（baseRevision）として必ず書き戻す。
   *
   * 保存経路（PUT /character/:id/sheet）とは baseRevision の意味が非対称である。
   * 保存は path ごとの baseValue CAS で競合を判定するので baseRevision は再送規約用の情報値だが、
   * この経路は sheet.revision と baseRevision の不一致がそのまま 409 になる
   * （server 側の根拠は CharacterSheetOperationService.rerollCreationRoll の staleRevisionConflict ガード。
   * 出目は再現できないため、保存経路のような再試行も行わない）。
   * よって書き戻しを省くと、2 回目以降の振り直しは必ず 409 で落ちる。
   */
  revision: number
  fieldUid: string
  /** 実行した記法。テンプレート宣言をそのまま実行するので補間はしていない。 */
  notation: string
  total: number
  details: string
  /**
   * 振り直し後にその field へ保存された値。
   *
   * front の編集画面はローカル state（values / baseline）を props から初期化して保持するため、
   * 振り直し後の値を知る手段が要る。出目の合計から保存形を front で組み立て直すと、
   * 「内訳を持てる field なら宣言された行き先キーへ書き、他の内訳キーは保持する」という変換規則が
   * server（creation-roll-value.util.ts）と front の 2 実装に分裂するので、server が書いた値を載せる。
   *
   * 型は同じ「シートの値」を `z.unknown().nonoptional()` で扱う `sheetMergeConflictSchema` に合わせる。
   * 内訳形（parts）の型は api-contract に無く、この経路のために持ち込まない。
   */
  value: unknown
}
