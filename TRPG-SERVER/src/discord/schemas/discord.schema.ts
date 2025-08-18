/**
 * Discord分散スキーマ管理
 * AI.architecture.md Phase 3: Discord固有の要件を独立管理
 * Discord.js API との整合性とランタイム型安全性を実現
 */

import { z } from 'zod'
import { CharacterEntitySchema } from '../../domains/character/schemas/character.schema'

/**
 * Discord ID関連の基本スキーマ
 */
const DiscordIdSchema = z.string().regex(/^\d{17,19}$/, 'Discord IDの形式が正しくありません')
const DiscordUrlSchema = z.string().url('有効なURLである必要があります')
const ColorSchema = z.number().int().min(0).max(16777215, '色は0-16777215の範囲である必要があります')

/**
 * Discord Embedフィールドのスキーマ
 */
export const DiscordEmbedFieldSchema = z.object({
  name: z.string().max(256, 'フィールド名は256文字以下である必要があります'),
  value: z.string().max(1024, 'フィールド値は1024文字以下である必要があります'),
  inline: z.boolean().optional().default(false)
})

/**
 * Discord Embedのスキーマ
 * Discord.js EmbedBuilder仕様に準拠
 */
export const DiscordEmbedSchema = z
  .object({
    title: z.string().max(256, 'タイトルは256文字以下である必要があります').optional(),
    description: z.string().max(4096, '説明は4096文字以下である必要があります').optional(),
    color: ColorSchema.optional(),
    fields: z.array(DiscordEmbedFieldSchema).max(25, 'フィールドは最大25個まで設定できます').optional(),
    thumbnail: z
      .object({
        url: DiscordUrlSchema,
        height: z.number().int().positive().optional(),
        width: z.number().int().positive().optional()
      })
      .optional(),
    image: z
      .object({
        url: DiscordUrlSchema,
        height: z.number().int().positive().optional(),
        width: z.number().int().positive().optional()
      })
      .optional(),
    footer: z
      .object({
        text: z.string().max(2048, 'フッターテキストは2048文字以下である必要があります'),
        icon_url: DiscordUrlSchema.optional()
      })
      .optional(),
    author: z
      .object({
        name: z.string().max(256, '作成者名は256文字以下である必要があります'),
        url: DiscordUrlSchema.optional(),
        icon_url: DiscordUrlSchema.optional()
      })
      .optional(),
    timestamp: z.string().datetime('有効なISO日時形式である必要があります').optional(),
    url: DiscordUrlSchema.optional()
  })
  .refine((embed) => {
    // Embedの総文字数制限（6000文字）
    const titleLength = embed.title?.length || 0
    const descriptionLength = embed.description?.length || 0
    const fieldsLength = embed.fields?.reduce((sum, field) => sum + field.name.length + field.value.length, 0) || 0
    const footerLength = embed.footer?.text.length || 0
    const authorLength = embed.author?.name.length || 0

    return titleLength + descriptionLength + fieldsLength + footerLength + authorLength <= 6000
  }, 'Embed全体の文字数は6000文字以下である必要があります')

/**
 * Discord表示オプションのスキーマ
 */
export const DiscordDisplayOptionsSchema = z.object({
  showAvatar: z.boolean().default(true),
  showTimestamp: z.boolean().default(true),
  compactMode: z.boolean().default(false),
  theme: z.enum(['light', 'dark', 'auto']).default('auto'),
  enableAnimations: z.boolean().default(true)
})

/**
 * Discordチャンネル情報のスキーマ
 */
export const DiscordChannelInfoSchema = z.object({
  channelId: DiscordIdSchema,
  channelName: z.string().max(100, 'チャンネル名は100文字以下である必要があります').optional(),
  guildId: DiscordIdSchema.optional(),
  type: z.enum(['text', 'voice', 'thread', 'category']).default('text')
})

/**
 * Discordユーザー情報のスキーマ
 */
export const DiscordUserInfoSchema = z.object({
  userId: DiscordIdSchema,
  username: z.string().max(32, 'ユーザー名は32文字以下である必要があります').optional(),
  displayName: z.string().max(32, '表示名は32文字以下である必要があります').optional(),
  avatarUrl: DiscordUrlSchema.optional()
})

/**
 * Discord権限設定のスキーマ
 */
const DiscordPermissionSchema = z.enum([
  'basic',
  'character_edit',
  'character_delete',
  'admin',
  'game_system_coc7th',
  'game_system_dnd5e',
  'game_system_sw25'
])

/**
 * キャラクター-Discordチャンネル関連付けのスキーマ
 */
export const DiscordCharacterChannelSchema = z.object({
  channel: DiscordChannelInfoSchema,
  user: DiscordUserInfoSchema,
  characterId: z.string().uuid('CharacterIDはUUID形式である必要があります'),
  permissions: z.array(DiscordPermissionSchema).default(['basic']),
  createdAt: z.date(),
  updatedAt: z.date().optional()
})

/**
 * Discord通知設定のスキーマ
 */
export const DiscordNotificationSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  notificationChannelId: DiscordIdSchema.optional(),
  level: z.enum(['all', 'important', 'critical']).default('important'),
  mentions: z
    .object({
      users: z.boolean().default(false),
      roles: z.boolean().default(false),
      everyone: z.boolean().default(false)
    })
    .default({
      users: false,
      roles: false,
      everyone: false
    })
})

/**
 * Discord統合キャラクターのスキーマ
 * CharacterEntityとDiscord固有情報を組み合わせ
 */
export const DiscordIntegratedCharacterSchema = z.object({
  characterData: CharacterEntitySchema,
  discordIntegration: DiscordCharacterChannelSchema,
  displaySettings: DiscordDisplayOptionsSchema.default({
    showAvatar: true,
    showTimestamp: true,
    compactMode: false,
    theme: 'auto',
    enableAnimations: true
  }),
  notificationSettings: DiscordNotificationSettingsSchema.default({
    enabled: false,
    level: 'important',
    mentions: {
      users: false,
      roles: false,
      everyone: false
    }
  })
})

/**
 * Discord操作結果のスキーマ
 */
export const DiscordOperationResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()).optional()
    })
    .optional(),
  timestamp: z.date()
})

/**
 * Discordメッセージコンポーネントのスキーマ
 */
export const DiscordButtonSchema = z.object({
  customId: z.string().max(100, 'カスタムIDは100文字以下である必要があります'),
  label: z.string().max(80, 'ボタンラベルは80文字以下である必要があります'),
  style: z.enum(['Primary', 'Secondary', 'Success', 'Danger', 'Link']).default('Secondary'),
  emoji: z.string().optional(),
  disabled: z.boolean().default(false),
  url: DiscordUrlSchema.optional()
})

export const DiscordSelectMenuSchema = z.object({
  customId: z.string().max(100, 'カスタムIDは100文字以下である必要があります'),
  placeholder: z.string().max(150, 'プレースホルダーは150文字以下である必要があります').optional(),
  options: z
    .array(
      z.object({
        label: z.string().max(100, 'オプションラベルは100文字以下である必要があります'),
        value: z.string().max(100, 'オプション値は100文字以下である必要があります'),
        description: z.string().max(100, 'オプション説明は100文字以下である必要があります').optional(),
        emoji: z.string().optional(),
        default: z.boolean().default(false)
      })
    )
    .min(1, '最低1つのオプションが必要です')
    .max(25, 'オプションは最大25個まで設定できます'),
  minValues: z.number().int().min(0).max(25).default(1),
  maxValues: z.number().int().min(1).max(25).default(1),
  disabled: z.boolean().default(false)
})

/**
 * 型の推論
 */
export type DiscordEmbed = z.infer<typeof DiscordEmbedSchema>
export type DiscordEmbedField = z.infer<typeof DiscordEmbedFieldSchema>
export type DiscordDisplayOptions = z.infer<typeof DiscordDisplayOptionsSchema>
export type DiscordChannelInfo = z.infer<typeof DiscordChannelInfoSchema>
export type DiscordUserInfo = z.infer<typeof DiscordUserInfoSchema>
export type DiscordCharacterChannel = z.infer<typeof DiscordCharacterChannelSchema>
export type DiscordNotificationSettings = z.infer<typeof DiscordNotificationSettingsSchema>
export type DiscordIntegratedCharacter = z.infer<typeof DiscordIntegratedCharacterSchema>
export type DiscordOperationResult = z.infer<typeof DiscordOperationResultSchema>
export type DiscordButton = z.infer<typeof DiscordButtonSchema>
export type DiscordSelectMenu = z.infer<typeof DiscordSelectMenuSchema>

/**
 * バリデーション関数
 */
export const validateDiscordEmbed = (data: unknown): DiscordEmbed => {
  return DiscordEmbedSchema.parse(data)
}

export const validateDiscordDisplayOptions = (data: unknown): DiscordDisplayOptions => {
  return DiscordDisplayOptionsSchema.parse(data)
}

export const validateDiscordCharacterChannel = (data: unknown): DiscordCharacterChannel => {
  return DiscordCharacterChannelSchema.parse(data)
}

export const validateDiscordIntegratedCharacter = (data: unknown): DiscordIntegratedCharacter => {
  return DiscordIntegratedCharacterSchema.parse(data)
}

/**
 * 安全なバリデーション
 */
export const safeValidateDiscordEmbed = (
  data: unknown
): { success: true; data: DiscordEmbed } | { success: false; error: z.ZodError } => {
  const result = DiscordEmbedSchema.safeParse(data)
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error }
}

export const safeValidateDiscordIntegratedCharacter = (
  data: unknown
): { success: true; data: DiscordIntegratedCharacter } | { success: false; error: z.ZodError } => {
  const result = DiscordIntegratedCharacterSchema.safeParse(data)
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error }
}

/**
 * Discord API制限チェック
 */
export const validateDiscordLimits = {
  /**
   * Embedが Discord API の制限に準拠しているかチェック
   */
  checkEmbedLimits: (embed: DiscordEmbed): { valid: true } | { valid: false; violations: string[] } => {
    const violations: string[] = []

    if (embed.fields && embed.fields.length > 25) {
      violations.push('フィールドは最大25個まで')
    }

    const totalLength =
      (embed.title?.length || 0) +
      (embed.description?.length || 0) +
      (embed.fields?.reduce((sum, field) => sum + field.name.length + field.value.length, 0) || 0) +
      (embed.footer?.text.length || 0) +
      (embed.author?.name.length || 0)

    if (totalLength > 6000) {
      violations.push(`Embed全体の文字数制限超過: ${totalLength}/6000文字`)
    }

    return violations.length === 0 ? { valid: true } : { valid: false, violations }
  },

  /**
   * コンポーネントの制限チェック
   */
  checkComponentLimits: (
    components: (DiscordButton | DiscordSelectMenu)[]
  ): { valid: true } | { valid: false; violations: string[] } => {
    const violations: string[] = []

    if (components.length > 25) {
      violations.push('コンポーネントは最大25個まで')
    }

    return violations.length === 0 ? { valid: true } : { valid: false, violations }
  }
}

/**
 * スキーマバージョン管理
 */
export const DISCORD_SCHEMA_VERSION = '1.0.0' as const
export const DISCORD_SCHEMA_COMPATIBILITY = {
  minimumDiscordJsVersion: '14.0.0',
  maximumDiscordJsVersion: '15.0.0'
} as const
