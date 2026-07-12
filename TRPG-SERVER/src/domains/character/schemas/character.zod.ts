import { z } from 'zod'

const finiteNumberSchema = z.number().finite()

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
    palette: z.array(characterPaletteEntrySchema).max(512).optional(),
    hub: characterHubSchema.optional(),
    appliedInteractionIds: appliedInteractionIdsSchema.optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional()
  })
  .strict()

export const materializedCharacterEntitySchema = characterEntitySchema.omit({ templatePin: true }).extend({
  templatePin: z.never().optional(),
  sheet: characterSheetStateSchema,
  computedCache: computedCacheSchema,
  palette: z.array(characterPaletteEntrySchema).max(512),
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
    palette: z.array(characterPaletteEntrySchema).max(512),
    status: attributeSectionSchema,
    skill: attributeSectionSchema,
    parameter: attributeSectionSchema,
    item: attributeSectionSchema,
    description: attributeSectionSchema,
    pendingRevision: z.number().int().positive(),
    appliedInteractionIds: z.array(z.string().min(1))
  })
  .strict()
