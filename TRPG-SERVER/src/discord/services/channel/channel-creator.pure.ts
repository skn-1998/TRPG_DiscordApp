/**
 * ChannelCreatorService の純粋関数群（Pure functions）
 *
 * 設計方針:
 * - 副作用を持たない（fetch / create / edit / delete / ログ / I/O に触れない）。
 * - discord.js の型・enum（ChannelType）には触れてよいが、Client / Guild / Channel の
 *   I/O メソッドは呼ばない。引数として渡された「素の値」だけで判断・組立を行う。
 *   → `services/channel/` 配下の純モジュール（DI なし）として配置するため、
 *     `shared/`（discord.js import 禁止）の制約には抵触しない。
 * - 各関数は ChannelCreatorService の I/O メソッドから組立・集計ロジックだけを抜き出し、
 *   現挙動（条件付き option 付与・型変換 map・権限集計）をそのまま再現する。
 *
 * I/O（fetch/guilds.fetch/channels.create/threads.create/permissionOverwrites/edit/delete/
 * members.fetch）は呼び出し側（imperative shell = ChannelCreatorService）が担う。
 */
import { ChannelType, OverwriteResolvable } from 'discord.js'

/** getChannelInfo が返すチャンネル情報の形 */
export interface ChannelInfo {
  id: string
  name: string
  type: string
  guildId?: string
  parentId?: string
  topic?: string
  memberCount?: number
}

/** buildChannelInfo に必要な、I/O に触れない最小のチャンネルメタ情報 */
export interface ChannelInfoSource {
  id: string
  type: number
  /** discord.js の channel.name は string | null。'name' を持たない場合は undefined を渡す。 */
  name?: string | null
  guildId?: string | null
  parentId?: string | null
  topic?: string | null
  isThread: boolean
  /** discord.js の memberCount は number | null になり得る。 */
  memberCount?: number | null
}

/** createChannel の option（現挙動の分岐をそのまま保持） */
export interface CreateChannelOptionsInput {
  type?: ChannelType
  parent?: string
  topic?: string
  permissions?: OverwriteResolvable[]
  position?: number
  nsfw?: boolean
  bitrate?: number
  userLimit?: number
  rateLimitPerUser?: number
}

/** createThread の option */
export interface CreateThreadOptionsInput {
  type?: ChannelType.PublicThread | ChannelType.PrivateThread
  autoArchiveDuration?: 60 | 1440 | 4320 | 10080
  reason?: string
}

/** createCategory の option */
export interface CreateCategoryOptionsInput {
  position?: number
  permissions?: OverwriteResolvable[]
}

/**
 * getChannelInfo の結果オブジェクトを組み立てる純関数。
 * 現挙動の再現:
 * - name は 'name' を持てばその値、無ければ 'Unknown'。
 * - type は `ChannelType[channel.type] || 'Unknown'`。
 * - guildId/parentId/topic は truthy のときのみ付与。
 * - isThread のとき memberCount を付与。
 */
export function buildChannelInfo(source: ChannelInfoSource): ChannelInfo {
  const result: ChannelInfo = {
    id: source.id,
    // 元実装と同じく "'name' in channel" 相当（= undefined でない）なら値をそのまま採用。
    // discord.js の name は string|null になり得るため、元の `result: any` と同じ実態を許容する。
    name: (source.name !== undefined ? source.name : 'Unknown') as string,
    type: ChannelType[source.type] || 'Unknown'
  }

  if (source.guildId) {
    result.guildId = source.guildId
  }

  if (source.parentId) {
    result.parentId = source.parentId
  }

  if (source.topic) {
    result.topic = source.topic
  }

  if (source.isThread) {
    // memberCount は number|null になり得るが、元実装（result: any）の実態を維持する。
    result.memberCount = source.memberCount as number | undefined
  }

  return result
}

/**
 * createChannel に渡す option オブジェクトを組み立てる純関数。
 * 現挙動の分岐（type デフォルト・truthy/undefined 判定・Voice 固有）をそのまま再現する。
 */
export function buildChannelCreateOptions(name: string, options?: CreateChannelOptionsInput): Record<string, unknown> {
  const channelOptions: Record<string, unknown> = {
    name,
    type: options?.type || ChannelType.GuildText
  }

  if (options?.parent) {
    channelOptions.parent = options.parent
  }

  if (options?.topic) {
    channelOptions.topic = options.topic
  }

  // Why: permissionOverwrites に [] を明示すると「overwrite 無し」の指定になり、無指定時の
  // 既定（親カテゴリと権限同期）と挙動が変わる。[] は「無指定=カテゴリ同期」へ正規化して omit する。
  if (options?.permissions && options.permissions.length > 0) {
    channelOptions.permissionOverwrites = options.permissions
  }

  if (options?.position !== undefined) {
    channelOptions.position = options.position
  }

  if (options?.nsfw !== undefined) {
    channelOptions.nsfw = options.nsfw
  }

  if (options?.rateLimitPerUser !== undefined) {
    channelOptions.rateLimitPerUser = options.rateLimitPerUser
  }

  // ボイスチャンネル固有のオプション
  if (options?.type === ChannelType.GuildVoice) {
    if (options?.bitrate) {
      channelOptions.bitrate = options.bitrate
    }
    if (options?.userLimit) {
      channelOptions.userLimit = options.userLimit
    }
  }

  return channelOptions
}

/**
 * createThread に渡す option オブジェクトを組み立てる純関数。
 * 現挙動: type デフォルトは PublicThread、autoArchiveDuration/reason は truthy のとき付与。
 */
export function buildThreadCreateOptions(name: string, options?: CreateThreadOptionsInput): Record<string, unknown> {
  const threadOptions: Record<string, unknown> = {
    name,
    type: options?.type || ChannelType.PublicThread
  }

  if (options?.autoArchiveDuration) {
    threadOptions.autoArchiveDuration = options.autoArchiveDuration
  }

  if (options?.reason) {
    threadOptions.reason = options.reason
  }

  return threadOptions
}

/**
 * createCategory に渡す option オブジェクトを組み立てる純関数。
 * 現挙動: type は固定で GuildCategory、position は undefined 以外なら付与、permissions は truthy で付与。
 */
export function buildCategoryCreateOptions(
  name: string,
  options?: CreateCategoryOptionsInput
): Record<string, unknown> {
  const categoryOptions: Record<string, unknown> = {
    name,
    type: ChannelType.GuildCategory
  }

  if (options?.position !== undefined) {
    categoryOptions.position = options.position
  }

  // NOTE: buildChannelCreateOptions の length>0 判定と非対称（ここは [] でも permissionOverwrites: [] を付ける）。
  // production 呼出ゼロのため現挙動を保持している。揃える場合は spec と同時に変更すること。
  if (options?.permissions) {
    categoryOptions.permissionOverwrites = options.permissions
  }

  return categoryOptions
}

/**
 * setChannelPermissions に渡す overwrite オブジェクトを組み立てる純関数。
 * 現挙動: allow/deny は truthy のときのみ付与する。
 */
export function buildPermissionOverwrites(permissions: { allow?: string[]; deny?: string[] }): Record<string, unknown> {
  const overwrites: Record<string, unknown> = {}

  if (permissions.allow) {
    overwrites.allow = permissions.allow
  }

  if (permissions.deny) {
    overwrites.deny = permissions.deny
  }

  return overwrites
}

/**
 * 権限名 → 許可フラグの map を、すべて false で初期化して返す純関数。
 * guild の無いチャンネルや例外時のフォールバックとして使う（現挙動の
 * `Object.fromEntries(permissions.map((p) => [p, false]))` と同一）。
 */
export function buildDeniedPermissionMap(permissions: string[]): Record<string, boolean> {
  return Object.fromEntries(permissions.map((p) => [p, false]))
}

/**
 * 各権限について「持っているか」を判定する関数を受け取り、
 * 権限名 → 真偽の map を組み立てる純関数。
 * `hasPermission` は discord.js の `member.permissions.has` を呼び出し側で束ねたもの。
 */
export function summarizePermissions(
  permissions: string[],
  hasPermission: (permission: string) => boolean
): Record<string, boolean> {
  const permissionResults: Record<string, boolean> = {}
  for (const permission of permissions) {
    permissionResults[permission] = hasPermission(permission)
  }
  return permissionResults
}

/**
 * 権限集計 map から hasAccess（いずれかが true か）を判定する純関数。
 * 現挙動: `Object.values(...).some(Boolean)`。
 */
export function hasAnyPermission(permissionResults: Record<string, boolean>): boolean {
  return Object.values(permissionResults).some(Boolean)
}

/**
 * 文字列のチャンネルタイプを discord.js の ChannelType に変換する純関数。
 * 現挙動: 既知は対応する値、未知は GuildText にフォールバック（toLowerCase）。
 */
export function convertChannelType(type: string): ChannelType {
  const typeMap: Record<string, ChannelType> = {
    text: ChannelType.GuildText,
    voice: ChannelType.GuildVoice,
    category: ChannelType.GuildCategory,
    news: ChannelType.GuildAnnouncement,
    stage: ChannelType.GuildStageVoice,
    forum: ChannelType.GuildForum,
    public_thread: ChannelType.PublicThread,
    private_thread: ChannelType.PrivateThread
  }

  return typeMap[type.toLowerCase()] || ChannelType.GuildText
}
