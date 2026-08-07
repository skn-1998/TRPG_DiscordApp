/**
 * character-sheet-template ドメインの永続化境界スキーマ（TRPG-SERVER 内部形）。
 *
 * ここで検証しているのは mongoose 永続化直前のドメインオブジェクトであり、
 * **HTTP wire の形ではない**（z.date() は Date インスタンス・.strict() は _id 等の
 * 実行時キーを拒否する）。フロントエンド／ブラウザでこのスキーマを parse しないこと。
 * wire 用の型が必要になったら character.wire.ts として別途書き下ろす（S4 指針）。
 */
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

/**
 * 永続化境界の検証スキーマ（server 内部形）。
 *
 * z.date() のため HTTP wire を parse できず、.passthrough() で未知キーも許容する。
 * フロントエンドで import・parse しないこと。
 * wire 型は @trpg/api-contract 内に S4 で新設予定の character.wire.ts を使う
 * （front から使う場合は trpg-next-app/eslint.config.mjs の no-restricted-imports（`@trpg/api-contract` の allowImportNames）への追加が必要）。
 */
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
