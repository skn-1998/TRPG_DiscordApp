import { PermissionsBitField } from 'discord.js'
import { registerDecorator } from 'class-validator'
import type { ValidationArguments, ValidationOptions } from 'class-validator'
import type { OverwriteResolvable, OverwriteType, PermissionsString } from 'discord.js'

const DISCORD_SNOWFLAKE_PATTERN = /^\d{17,19}$/

/**
 * Discord Snowflake（17〜19桁の数字文字列）かを判定する共有 predicate。
 * DTO デコレータと controller の手続き検証の両方がこれを使い、判定のズレを防ぐ。
 */
export function isDiscordSnowflake(value: unknown): value is string {
  return typeof value === 'string' && DISCORD_SNOWFLAKE_PATTERN.test(value)
}

// Why: allow は「呼び出し元が Bot 経由で第三者へ付与させる」方向の操作。閲覧・投稿系の6種に限定する。
// ManageMessages / MentionEveryone 等を allow に含めると、呼び出し元自身が持たない権限を
// Bot が代理付与する権限昇格経路になるため除外する（deny 側では防御方向なので許可される）。
export const ALLOWED_CHANNEL_PERMISSION_ALLOW_KEYS = [
  'ViewChannel',
  'SendMessages',
  'ReadMessageHistory',
  'AttachFiles',
  'EmbedLinks',
  'AddReactions'
] as const satisfies readonly PermissionsString[]

export type AllowedChannelPermissionAllowKey = (typeof ALLOWED_CHANNEL_PERMISSION_ALLOW_KEYS)[number]

export type AllowedChannelPermissionDenyKey = Exclude<PermissionsString, 'Administrator'>

// Why: deny は権限を狭める防御方向の overwrite なので、Administrator を除く全権限を許可する。
// 権限名の正本は discord.js の PermissionsBitField.Flags（文字列の独自網羅を二重管理しない）。
// 実行時の絞り込みは caller-holds 検証（呼出者が deny 指定キーを自身も保持すること）が担う。
export const ALLOWED_CHANNEL_PERMISSION_DENY_KEYS = (
  Object.keys(PermissionsBitField.Flags) as PermissionsString[]
).filter(
  (key): key is AllowedChannelPermissionDenyKey => key !== 'Administrator'
) satisfies AllowedChannelPermissionDenyKey[]

export const CHANNEL_PERMISSION_OVERWRITE_TYPES = ['role', 'member'] as const

export type ChannelPermissionOverwriteType = (typeof CHANNEL_PERMISSION_OVERWRITE_TYPES)[number]

export interface CreateChannelPermissionOverwrite {
  readonly id: string
  readonly allow?: AllowedChannelPermissionAllowKey[]
  readonly deny?: AllowedChannelPermissionDenyKey[]
  /** 省略時は id が role か member かの解決を discord.js に委ねる */
  readonly type?: ChannelPermissionOverwriteType
}

const ALLOW_KEY_SET = new Set<string>(ALLOWED_CHANNEL_PERMISSION_ALLOW_KEYS)
const DENY_KEY_SET = new Set<string>(ALLOWED_CHANNEL_PERMISSION_DENY_KEYS)
const OVERWRITE_TYPE_SET = new Set<string>(CHANNEL_PERMISSION_OVERWRITE_TYPES)
const ALLOWED_OVERWRITE_FIELDS = new Set(['id', 'allow', 'deny', 'type'])

// Why: エラーメッセージへ受信値そのものを埋め込まない。メッセージは logger.warn へも流れるため、
// 任意文字列を含めると log injection の経路になる（位置＝index/field だけで特定できる）。
export function getChannelPermissionOverwritesValidationError(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined
  }

  if (!Array.isArray(value)) {
    return 'permissions は配列で指定してください'
  }

  for (const [index, overwrite] of value.entries()) {
    if (overwrite === null || typeof overwrite !== 'object' || Array.isArray(overwrite)) {
      return `permissions[${index}] はオブジェクトで指定してください`
    }

    const fields = Object.keys(overwrite)
    const unsupportedField = fields.find((field) => !ALLOWED_OVERWRITE_FIELDS.has(field))
    if (unsupportedField) {
      return `permissions[${index}] に指定できないフィールドが含まれています`
    }

    const candidate = overwrite as Record<string, unknown>
    if (!isDiscordSnowflake(candidate.id)) {
      return `permissions[${index}].id は17〜19桁のDiscord Snowflake文字列で指定してください`
    }

    if (
      candidate.type !== undefined &&
      (typeof candidate.type !== 'string' || !OVERWRITE_TYPE_SET.has(candidate.type))
    ) {
      return `permissions[${index}].type は 'role' または 'member' で指定してください`
    }

    for (const field of ['allow', 'deny'] as const) {
      const permissions = candidate[field]
      if (permissions === undefined) {
        continue
      }

      if (!Array.isArray(permissions)) {
        return `permissions[${index}].${field} は権限名の配列で指定してください`
      }

      const allowedKeySet = field === 'allow' ? ALLOW_KEY_SET : DENY_KEY_SET
      const hasUnsupportedPermission = permissions.some(
        (permission) => typeof permission !== 'string' || !allowedKeySet.has(permission)
      )
      if (hasUnsupportedPermission) {
        return `permissions[${index}].${field} に許可されていない権限が含まれています`
      }
    }
  }

  return undefined
}

export function IsValidChannelPermissionOverwrites(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      name: 'isValidChannelPermissionOverwrites',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return getChannelPermissionOverwritesValidationError(value) === undefined
        },
        defaultMessage(args: ValidationArguments): string {
          return (
            getChannelPermissionOverwritesValidationError(args.value) ??
            'permissions のpermission overwrite形式が不正です'
          )
        }
      }
    })
  }
}

/** isDiscordSnowflake を DTO プロパティ検証として適用するデコレータ（共有 predicate と同一判定） */
export function IsDiscordSnowflake(validationOptions?: ValidationOptions): PropertyDecorator {
  return (target: object, propertyKey: string | symbol): void => {
    registerDecorator({
      name: 'isDiscordSnowflake',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isDiscordSnowflake(value)
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} は17〜19桁のDiscord Snowflake文字列で指定してください`
        }
      }
    })
  }
}

// NOTE: 規約例外 - OverwriteType を値 import せず literal を enum member 型で拘束している。
// jest の discord.js グローバルモックが OverwriteType を提供しておらず、値 import だと
// controller spec 経由の実行で落ちるため。discord.js 側の実値とズレると型エラーで検出される。
const OVERWRITE_TYPE_BY_NAME: { readonly role: OverwriteType.Role; readonly member: OverwriteType.Member } = {
  role: 0,
  member: 1
}

/**
 * 非空の permission overwrite が呼出者へ追加要求する権限キー（allow/deny の和集合・重複除去）を返す。
 *
 * 戻り値の契約:
 * - undefined … permissions が未指定または空配列（= overwrite 無指定扱い）。追加の権限要求は発生しない。
 * - 配列（空を含む）… 非空 overwrite あり。呼出者に ManageRoles と各キーの保持（caller-holds）を要求する。
 */
export function collectRequestedOverwritePermissionKeys(
  permissions: readonly CreateChannelPermissionOverwrite[] | undefined
): PermissionsString[] | undefined {
  if (permissions === undefined || permissions.length === 0) {
    return undefined
  }

  const keys = new Set<PermissionsString>()
  for (const overwrite of permissions) {
    for (const key of [...(overwrite.allow ?? []), ...(overwrite.deny ?? [])]) {
      keys.add(key)
    }
  }
  return [...keys]
}

/**
 * 検証済みの HTTP 表現を discord.js の OverwriteResolvable へ正規化する。
 * type 省略時はフィールド自体を付けず、role/member の解決を discord.js に委ねる。
 */
export function toPermissionOverwriteResolvables(
  permissions: readonly CreateChannelPermissionOverwrite[] | undefined
): OverwriteResolvable[] | undefined {
  if (permissions === undefined) {
    return undefined
  }

  return permissions.map((overwrite) => ({
    id: overwrite.id,
    ...(overwrite.allow !== undefined ? { allow: overwrite.allow } : {}),
    ...(overwrite.deny !== undefined ? { deny: overwrite.deny } : {}),
    ...(overwrite.type !== undefined ? { type: OVERWRITE_TYPE_BY_NAME[overwrite.type] } : {})
  }))
}
