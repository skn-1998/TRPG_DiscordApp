import { z } from 'zod'

const semverSchema = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/)

export const sheetTemplateStatusSchema = z.enum(['draft', 'published', 'deprecated'])

export const sheetTemplateVisibilitySchema = z.enum(['private', 'unlisted', 'public'])

export const sheetTemplateSettingsSchema = z
  .object({
    rounding: z.enum(['floor', 'ceil', 'round'])
  })
  .passthrough()

export const sheetTemplateForkedFromSchema = z.object({
  templateId: z.string().min(1),
  version: semverSchema
})

export const characterSheetTemplateEntitySchema = z.object({
  templateId: z.string().min(1),
  status: sheetTemplateStatusSchema,
  version: semverSchema,
  schemaVersion: z.literal(3),
  name: z.string().min(1),
  gameSystemId: z.string().min(1).optional(),
  tags: z.array(z.string()),
  visibility: sheetTemplateVisibilitySchema,
  authorDiscordUserId: z.string().min(1),
  forkedFrom: sheetTemplateForkedFromSchema.optional(),
  license: z.string().min(1).optional(),
  sections: z.array(z.record(z.string(), z.unknown())),
  tables: z.array(z.record(z.string(), z.unknown())),
  settings: sheetTemplateSettingsSchema,
  draftRevision: z.number().int().min(0),
  publishedAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional()
})

export type CharacterSheetTemplateEntityInput = z.infer<typeof characterSheetTemplateEntitySchema>
