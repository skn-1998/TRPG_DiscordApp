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
 * POST /character/from-template について front が消費する保証面。
 */
export interface CreateCharacterFromTemplateResultWire {
  characterId: string
}
