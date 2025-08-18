/**
 * Character分散スキーマ管理
 * AI.architecture.md Phase 3: 分散スキーマ管理の実装
 * ランタイム型安全性とドメイン独立性を実現
 */

import { z } from 'zod'

/**
 * 基本フィールドのスキーマ定義
 */
const CharacterIdSchema = z.string().uuid('CharacterIDはUUID形式である必要があります')
const CharacterNameSchema = z
  .string()
  .min(1, 'キャラクター名は必須です')
  .max(50, 'キャラクター名は50文字以下である必要があります')
const GameSystemIdSchema = z.string().min(1, 'ゲームシステムIDは必須です')
const DiscordUserIdSchema = z.string().regex(/^\d{17,19}$/, 'Discord UserIDの形式が正しくありません')
const DiscordChannelIdSchema = z.string().regex(/^\d{17,19}$/, 'Discord ChannelIDの形式が正しくありません')

/**
 * 属性値のスキーマ
 * 既存のAttributeValue型と互換性を保つ
 */
export const AttributeValueSchema = z.object({
  name: z.string().optional(),
  index: z.number().int().min(0).optional(),
  values: z.record(z.string(), z.number()).optional().default({}),
  description: z.string().optional(),
  isVisible: z.boolean().optional().default(true)
})

/**
 * 属性セクションのスキーマ
 */
export const AttributeSectionSchema = z.record(z.string(), AttributeValueSchema)

/**
 * Discordインテグレーション情報
 */
const DiscordIntegrationSchema = z
  .object({
    userId: DiscordUserIdSchema,
    channelId: DiscordChannelIdSchema.optional(),
    editChannelId: DiscordChannelIdSchema.optional(),
    threadId: DiscordChannelIdSchema.optional()
  })
  .optional()

/**
 * キャラクターエンティティのスキーマ
 * データベースストレージ用の完全なスキーマ
 */
export const CharacterEntitySchema = z.object({
  characterId: CharacterIdSchema,
  characterName: CharacterNameSchema,
  gameSystemId: GameSystemIdSchema,
  discord: DiscordIntegrationSchema,
  status: AttributeSectionSchema.default({}),
  parameter: AttributeSectionSchema.optional().default({}),
  skill: AttributeSectionSchema.optional().default({}),
  item: AttributeSectionSchema.optional().default({}),
  description: AttributeSectionSchema.optional().default({}),
  createdAt: z.date(),
  updatedAt: z.date()
})

/**
 * キャラクター作成リクエストのスキーマ
 * 外部からの入力用
 */
export const CharacterCreateRequestSchema = z.object({
  characterName: CharacterNameSchema,
  gameSystemId: GameSystemIdSchema,
  discordUserId: DiscordUserIdSchema,
  discord: z
    .object({
      channelId: DiscordChannelIdSchema.optional(),
      threadId: DiscordChannelIdSchema.optional()
    })
    .optional(),
  initialData: z
    .object({
      status: z.record(z.string(), AttributeValueSchema.partial()).optional(),
      parameter: z.record(z.string(), AttributeValueSchema.partial()).optional(),
      skill: z.record(z.string(), AttributeValueSchema.partial()).optional(),
      item: z.record(z.string(), AttributeValueSchema.partial()).optional(),
      description: z.record(z.string(), AttributeValueSchema.partial()).optional()
    })
    .optional()
})

/**
 * キャラクター更新リクエストのスキーマ
 */
export const CharacterUpdateRequestSchema = z.object({
  characterId: CharacterIdSchema,
  updates: z.object({
    characterName: CharacterNameSchema.optional(),
    gameSystemId: GameSystemIdSchema.optional(),
    discord: DiscordIntegrationSchema.optional(),
    status: z.record(z.string(), AttributeValueSchema.partial()).optional(),
    parameter: z.record(z.string(), AttributeValueSchema.partial()).optional(),
    skill: z.record(z.string(), AttributeValueSchema.partial()).optional(),
    item: z.record(z.string(), AttributeValueSchema.partial()).optional(),
    description: z.record(z.string(), AttributeValueSchema.partial()).optional()
  }),
  reason: z.string().optional()
})

/**
 * キャラクター検索条件のスキーマ
 */
export const CharacterSearchCriteriaSchema = z.object({
  characterId: CharacterIdSchema.optional(),
  characterName: z.string().optional(),
  gameSystemId: GameSystemIdSchema.optional(),
  discordUserId: DiscordUserIdSchema.optional(),
  discord: z
    .object({
      channelId: DiscordChannelIdSchema.optional(),
      threadId: DiscordChannelIdSchema.optional()
    })
    .optional(),
  createdAt: z
    .object({
      from: z.date().optional(),
      to: z.date().optional()
    })
    .optional()
})

/**
 * 型の推論
 */
export type CharacterEntity = z.infer<typeof CharacterEntitySchema>
export type CharacterCreateRequest = z.infer<typeof CharacterCreateRequestSchema>
export type CharacterUpdateRequest = z.infer<typeof CharacterUpdateRequestSchema>
export type CharacterSearchCriteria = z.infer<typeof CharacterSearchCriteriaSchema>
export type AttributeValue = z.infer<typeof AttributeValueSchema>
export type AttributeSection = z.infer<typeof AttributeSectionSchema>

/**
 * バリデーション関数
 * ランタイム型安全性を提供
 */
export const validateCharacterEntity = (data: unknown): CharacterEntity => {
  return CharacterEntitySchema.parse(data)
}

export const validateCharacterCreateRequest = (data: unknown): CharacterCreateRequest => {
  return CharacterCreateRequestSchema.parse(data)
}

export const validateCharacterUpdateRequest = (data: unknown): CharacterUpdateRequest => {
  return CharacterUpdateRequestSchema.parse(data)
}

export const validateCharacterSearchCriteria = (data: unknown): CharacterSearchCriteria => {
  return CharacterSearchCriteriaSchema.parse(data)
}

/**
 * 安全なバリデーション（エラーハンドリング付き）
 */
export const safeValidateCharacterEntity = (
  data: unknown
): { success: true; data: CharacterEntity } | { success: false; error: z.ZodError } => {
  const result = CharacterEntitySchema.safeParse(data)
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error }
}

export const safeValidateCharacterCreateRequest = (
  data: unknown
): { success: true; data: CharacterCreateRequest } | { success: false; error: z.ZodError } => {
  const result = CharacterCreateRequestSchema.safeParse(data)
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error }
}

/**
 * 部分バリデーション
 * 既存データの部分更新用
 */
export const validateCharacterPartialUpdate = (data: unknown): Partial<CharacterEntity> => {
  return CharacterEntitySchema.partial().parse(data)
}

/**
 * カスタムバリデーター
 * ビジネスロジック固有の検証
 */
export const validateCharacterBusinessRules = (
  character: CharacterEntity
): { valid: true } | { valid: false; errors: string[] } => {
  const errors: string[] = []

  // ゲームシステム固有のバリデーション
  if (character.gameSystemId === 'coc7th') {
    // Call of Cthulhu 7th Edition の特別なルール
    const san = character.status?.['san']
    if (san && san.values) {
      const sanValue = Object.values(san.values).reduce((sum, v) => sum + v, 0)
      if (sanValue < 0 || sanValue > 99) {
        errors.push('SAN値は0-99の範囲である必要があります')
      }
    }
  }

  // Discord関連の整合性チェック
  if (character.discord?.channelId && character.discord?.editChannelId) {
    if (character.discord.channelId === character.discord.editChannelId) {
      errors.push('キャラクターチャンネルと編集チャンネルは異なる必要があります')
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors }
}

/**
 * スキーマバージョン管理
 */
export const SCHEMA_VERSION = '1.0.0' as const
export const SCHEMA_COMPATIBILITY = {
  minimumSupported: '1.0.0',
  maximumSupported: '1.0.0'
} as const

/**
 * マイグレーション支援
 */
export const createCharacterEntityFromLegacy = (legacyData: any): CharacterEntity => {
  // レガシーデータ形式からの変換ロジック
  const migrated = {
    ...legacyData,
    discord: legacyData.discordUserId
      ? {
          userId: legacyData.discordUserId,
          channelId: legacyData.discordChannelId,
          editChannelId: legacyData.discordEditChannelId,
          threadId: legacyData.threadId
        }
      : undefined,
    createdAt: legacyData.createdAt ? new Date(legacyData.createdAt) : new Date(),
    updatedAt: legacyData.updatedAt ? new Date(legacyData.updatedAt) : new Date()
  }

  return validateCharacterEntity(migrated)
}
