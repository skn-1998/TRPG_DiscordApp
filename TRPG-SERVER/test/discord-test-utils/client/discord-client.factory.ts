/**
 * Discord Client / Guild / Channel / User のモックファクトリ
 *
 * @shoginn/discordjs-mock を活用して本物の discord.js インスタンスを生成する。
 * ただし jest.mock('discord.js', ...) が有効な環境では動作しないため、
 * このファイルは jest.mock を呼び出していない spec.ts か、
 * jest.requireActual を使う場面で使用すること。
 *
 * @note
 * 通常のインタラクションテストでは interactions/ 配下のファクトリで十分。
 * このファクトリは「Discordチャンネルへのメッセージ送信」や
 * 「スレッド作成」などの実際の Discord オブジェクトが必要な場合に使う。
 */

// NOTE: @shoginn/discordjs-mock は discord.js v14.16+ が peerDependency だが
// このプロジェクトは v14.14.1 のため、型エラーが発生する可能性がある。
// その場合は以下のコメントアウトを解除して mock実装に切り替える。

// import {
//   mockClientUser,
//   mockGuild,
//   mockTextChannel,
//   mockUser,
//   mockGuildMember,
// } from '@shoginn/discordjs-mock'
// import { Client, GatewayIntentBits } from 'discord.js'

/**
 * テスト用の Discord Client を生成する（モック版）
 *
 * @shoginn/discordjs-mock が利用できない環境向けのフォールバック実装。
 */
export function createMockDiscordClient() {
  return {
    login: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnThis(),
    once: jest.fn().mockReturnThis(),
    off: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    channels: {
      fetch: jest.fn().mockResolvedValue(createMockTextChannel())
    },
    guilds: {
      fetch: jest.fn().mockResolvedValue(createMockGuild())
    },
    users: {
      fetch: jest.fn().mockResolvedValue(createMockUser())
    },
    user: {
      id: 'bot-user-id',
      username: 'TestBot',
      tag: 'TestBot#0000',
      bot: true
    },
    application: {
      id: 'test-application-id',
      commands: {
        set: jest.fn().mockResolvedValue([])
      }
    }
  }
}

/**
 * テスト用のテキストチャンネルモックを生成する
 */
export function createMockTextChannel(overrides: Record<string, unknown> = {}) {
  return {
    id: '555666777888999000',
    name: 'test-channel',
    type: 0,
    guildId: '987654321098765432',
    isTextBased: jest.fn().mockReturnValue(true),
    isThread: jest.fn().mockReturnValue(false),
    isDMBased: jest.fn().mockReturnValue(false),
    send: jest.fn().mockResolvedValue({
      id: 'test-message-id',
      content: '',
      delete: jest.fn().mockResolvedValue(undefined),
      edit: jest.fn().mockResolvedValue(undefined)
    }),
    messages: {
      fetch: jest.fn().mockResolvedValue(new Map())
    },
    threads: {
      create: jest.fn().mockResolvedValue(createMockThread()),
      cache: new Map()
    },
    bulkDelete: jest.fn().mockResolvedValue(new Map()),
    ...overrides
  }
}

/**
 * テスト用のスレッドチャンネルモックを生成する
 */
export function createMockThread(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-thread-id',
    name: 'test-thread',
    type: 11, // PublicThread
    isTextBased: jest.fn().mockReturnValue(true),
    isThread: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue({ id: 'test-message-id' }),
    setArchived: jest.fn().mockResolvedValue(undefined),
    setName: jest.fn().mockResolvedValue(undefined),
    members: {
      add: jest.fn().mockResolvedValue(undefined),
      cache: new Map()
    },
    ...overrides
  }
}

/**
 * テスト用のギルドモックを生成する
 */
export function createMockGuild(overrides: Record<string, unknown> = {}) {
  return {
    id: '987654321098765432',
    name: 'テストサーバー',
    icon: null,
    ownerId: '123456789012345678',
    channels: {
      create: jest.fn().mockResolvedValue(createMockTextChannel()),
      cache: new Map(),
      fetch: jest.fn().mockResolvedValue(createMockTextChannel())
    },
    members: {
      fetch: jest.fn().mockResolvedValue(createMockMember()),
      cache: new Map()
    },
    roles: {
      cache: new Map()
    },
    ...overrides
  }
}

/**
 * テスト用のユーザーモックを生成する
 */
export function createMockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: '123456789012345678',
    username: 'TestUser',
    discriminator: '0001',
    avatar: null,
    bot: false,
    globalName: 'TestUser',
    displayName: 'TestUser',
    tag: 'TestUser#0001',
    ...overrides
  }
}

/**
 * テスト用のギルドメンバーモックを生成する
 */
export function createMockMember(overrides: Record<string, unknown> = {}) {
  return {
    id: '123456789012345678',
    user: createMockUser(),
    nickname: null,
    displayName: 'TestUser',
    roles: { cache: new Map() },
    permissions: { has: jest.fn().mockReturnValue(true) },
    joinedAt: new Date(),
    ...overrides
  }
}
