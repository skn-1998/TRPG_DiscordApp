/**
 * Discord Interaction 共通ベース型
 *
 * @shoginn/discordjs-mock はClient/Guild/Channel/Userのモックを提供するが
 * Interaction系は含まれていないため、このファイルで独自に定義する。
 */

export interface MockDiscordUser {
  id: string
  username: string
  discriminator: string
  avatar: string | null
  bot: boolean
  globalName: string | null
  displayName: string
  tag: string
}

export interface MockDiscordGuild {
  id: string
  name: string
  icon: string | null
  ownerId: string
}

export interface MockDiscordChannel {
  id: string
  name: string
  type: number
  isTextBased: jest.Mock
  isThread: jest.Mock
}

export interface MockDiscordMember {
  id: string
  user: MockDiscordUser
  nickname: string | null
  displayName: string
  roles: { cache: Map<string, unknown> }
  permissions: { has: jest.Mock }
}

/**
 * 全インタラクション共通のベースモック
 */
export interface MockBaseInteraction {
  id: string
  applicationId: string
  token: string
  version: number
  guild: MockDiscordGuild | null
  guildId: string | null
  channel: MockDiscordChannel | null
  channelId: string
  user: MockDiscordUser
  member: MockDiscordMember | null
  replied: boolean
  deferred: boolean
  // 応答メソッド
  reply: jest.Mock
  deferReply: jest.Mock
  editReply: jest.Mock
  deleteReply: jest.Mock
  fetchReply: jest.Mock
  followUp: jest.Mock
  showModal: jest.Mock
}

/**
 * デフォルトのモックユーザーデータ
 */
export const DEFAULT_MOCK_USER: MockDiscordUser = {
  id: '123456789012345678',
  username: 'TestUser',
  discriminator: '0001',
  avatar: 'test-avatar-hash',
  bot: false,
  globalName: 'TestUser',
  displayName: 'TestUser',
  tag: 'TestUser#0001'
}

/**
 * デフォルトのモックギルドデータ
 */
export const DEFAULT_MOCK_GUILD: MockDiscordGuild = {
  id: '987654321098765432',
  name: 'テストサーバー',
  icon: null,
  ownerId: '123456789012345678'
}

/**
 * デフォルトのモックチャンネルデータ
 */
export const DEFAULT_MOCK_CHANNEL: MockDiscordChannel = {
  id: '555666777888999000',
  name: 'テストチャンネル',
  type: 0,
  isTextBased: jest.fn().mockReturnValue(true),
  isThread: jest.fn().mockReturnValue(false)
}

/**
 * デフォルトのモックメンバーデータ
 */
export const DEFAULT_MOCK_MEMBER: MockDiscordMember = {
  id: '123456789012345678',
  user: DEFAULT_MOCK_USER,
  nickname: null,
  displayName: 'TestUser',
  roles: { cache: new Map() },
  permissions: { has: jest.fn().mockReturnValue(true) }
}

/**
 * ベースインタラクションのデフォルト値を生成
 */
export function createBaseInteractionMock(overrides: Partial<MockBaseInteraction> = {}): MockBaseInteraction {
  return {
    id: 'test-interaction-id',
    applicationId: 'test-application-id',
    token: 'test-interaction-token',
    version: 1,
    guild: DEFAULT_MOCK_GUILD,
    guildId: DEFAULT_MOCK_GUILD.id,
    channel: DEFAULT_MOCK_CHANNEL,
    channelId: DEFAULT_MOCK_CHANNEL.id,
    user: DEFAULT_MOCK_USER,
    member: DEFAULT_MOCK_MEMBER,
    replied: false,
    deferred: false,
    reply: jest.fn().mockResolvedValue(undefined),
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    deleteReply: jest.fn().mockResolvedValue(undefined),
    fetchReply: jest.fn().mockResolvedValue({ id: 'test-message-id' }),
    followUp: jest.fn().mockResolvedValue(undefined),
    showModal: jest.fn().mockResolvedValue(undefined),
    ...overrides
  }
}
