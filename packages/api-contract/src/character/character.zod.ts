/**
 * character ドメインの永続化境界スキーマ（TRPG-SERVER 内部形）。
 *
 * ここで検証しているのは mongoose 永続化直前のドメインオブジェクトであり、
 * **HTTP wire の形ではない**（z.date() は Date インスタンス・.strict() は _id 等の
 * 実行時キーを拒否する）。フロントエンド／ブラウザでこのスキーマを parse しないこと。
 * wire 用の型が必要になったら character.wire.ts として別途書き下ろす（S4 指針）。
 */
import { z } from 'zod'

const finiteNumberSchema = z.number().finite()
const PALETTE_MAX_ENTRIES = 512

export const attributeValueSchema = z
  .object({
    name: z.string().optional(),
    index: finiteNumberSchema.optional(),
    values: z.record(z.string(), finiteNumberSchema).optional(),
    description: z.string().optional(),
    dice: z.string().optional(),
    isVisible: z.boolean().optional()
  })
  .strict()

export const attributeSectionSchema = z.record(z.string(), attributeValueSchema)

export const characterSheetStateSchema = z
  .object({
    templateId: z.string().min(1),
    templateVersion: z.string().min(1),
    revision: z.number().int().positive(),
    values: z.record(z.string(), z.unknown())
  })
  .strict()

export const characterTemplatePinSchema = z
  .object({
    templateId: z.string().min(1),
    templateVersion: z.string().min(1),
    pinnedBy: z.string().min(1)
  })
  .strict()

const paletteFieldRefSchema = z
  .object({
    uid: z.string().min(1),
    rowId: z.string().min(1).optional()
  })
  .strict()

const rollPaletteEntrySchema = z
  .object({
    key: z.string().min(1),
    fieldRef: paletteFieldRefSchema,
    label: z.string(),
    kind: z.literal('roll'),
    notation: z.string().min(1),
    group: z.string()
  })
  .strict()

const resourcePaletteEntrySchema = z
  .object({
    key: z.string().min(1),
    fieldRef: paletteFieldRefSchema,
    label: z.string(),
    kind: z.literal('resource'),
    deltas: z.array(finiteNumberSchema),
    group: z.string()
  })
  .strict()

export const characterPaletteEntrySchema = z.discriminatedUnion('kind', [
  rollPaletteEntrySchema,
  resourcePaletteEntrySchema
])

export const characterHubStatusSchema = z.enum(['none', 'publishing', 'active', 'error'])

export const characterHubSchema = z
  .object({
    status: characterHubStatusSchema,
    opId: z.string().optional(),
    messageId: z.string().optional(),
    threadId: z.string().optional(),
    pendingRevision: z.number().int().nonnegative().optional(),
    appliedRevision: z.number().int().nonnegative().optional(),
    retryAt: z.date().optional(),
    errorCode: z.string().optional()
  })
  .strict()

const computedCacheSchema = z.record(z.string(), z.union([finiteNumberSchema, z.string(), z.boolean()]))

const appliedInteractionIdsSchema = z.array(z.string().min(1)).max(20)

/**
 * 永続化境界の検証スキーマ（server 内部形）。
 *
 * z.date()/.strict() のため HTTP wire を parse できない。
 * フロントエンドで import・parse しないこと。
 * wire 型は @trpg/api-contract 内に S4 で新設予定の character.wire.ts を使う
 * （front から使う場合は trpg-remix-app/eslint.config.js の allowImportNames への追加が必要）。
 */
export const characterEntitySchema = z
  .object({
    characterId: z.string().min(1),
    characterName: z.string().min(1),
    gameSystemId: z.string(),
    discordUserId: z.string(),
    discordChannelId: z.string(),
    discordThreadId: z.string().optional(),
    status: attributeSectionSchema,
    skill: attributeSectionSchema.optional(),
    parameter: attributeSectionSchema.optional(),
    item: attributeSectionSchema.optional(),
    description: attributeSectionSchema.optional(),
    sheet: characterSheetStateSchema.optional(),
    templatePin: characterTemplatePinSchema.optional(),
    computedCache: computedCacheSchema.optional(),
    palette: z.array(characterPaletteEntrySchema).max(PALETTE_MAX_ENTRIES).optional(),
    hub: characterHubSchema.optional(),
    appliedInteractionIds: appliedInteractionIdsSchema.optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional()
  })
  .strict()

/**
 * 永続化境界の検証スキーマ（server 内部形）。
 *
 * z.date()/.strict() のため HTTP wire を parse できない。
 * フロントエンドで import・parse しないこと。
 * wire 型は @trpg/api-contract 内に S4 で新設予定の character.wire.ts を使う
 * （front から使う場合は trpg-remix-app/eslint.config.js の allowImportNames への追加が必要）。
 */
export const materializedCharacterEntitySchema = characterEntitySchema.omit({ templatePin: true }).extend({
  templatePin: z.never().optional(),
  sheet: characterSheetStateSchema,
  computedCache: computedCacheSchema,
  palette: z.array(characterPaletteEntrySchema).max(PALETTE_MAX_ENTRIES),
  hub: characterHubSchema,
  appliedInteractionIds: appliedInteractionIdsSchema,
  status: attributeSectionSchema,
  skill: attributeSectionSchema,
  parameter: attributeSectionSchema,
  item: attributeSectionSchema,
  description: attributeSectionSchema
})

export const saveSheetMaterializedPayloadSchema = z
  .object({
    values: z.record(z.string(), z.unknown()),
    computedCache: computedCacheSchema,
    palette: z.array(characterPaletteEntrySchema).max(PALETTE_MAX_ENTRIES),
    status: attributeSectionSchema,
    skill: attributeSectionSchema,
    parameter: attributeSectionSchema,
    item: attributeSectionSchema,
    description: attributeSectionSchema,
    pendingRevision: z.number().int().positive(),
    appliedInteractionIds: z.array(z.string().min(1))
  })
  .strict()
