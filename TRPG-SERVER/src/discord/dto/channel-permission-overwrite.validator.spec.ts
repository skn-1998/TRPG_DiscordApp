/**
 * channel-permission-overwrite.validator の単体テスト。
 * permission overwrite（allow 6種 / deny は Administrator 以外 / type / id）と parentId の
 * Snowflake 検証について、手続き呼び出し・DTO デコレータ・ValidationPipe（HTTP 経路相当）の
 * 3経路が同じ判定になることを固定する。
 */
// グローバル jest-setup の discord.js モックは PermissionsBitField.Flags が主要6キーのみで、
// deny 側の広い権限（Connect / Speak / ManageWebhooks 等）を検証できないため、
// このファイル限定で実 discord.js と同じ bigint 値のキーを持つモックへ差し替える。
// 本体（validator）も同じモック参照を読むため、deny 許可キーはこの Flags から導出される。
// ChannelType も CreateChannelDto が参照するため、実 discord.js と同じ値で提供する。
jest.mock('discord.js', () => ({
  ChannelType: {
    GuildText: 0,
    GuildVoice: 2,
    GuildCategory: 4,
    GuildAnnouncement: 5,
    GuildStageVoice: 13,
    GuildDirectory: 14,
    GuildForum: 15,
    GuildMedia: 16
  },
  PermissionsBitField: {
    Flags: {
      CreateInstantInvite: 1n,
      Administrator: 8n,
      ManageChannels: 16n,
      AddReactions: 64n,
      ViewChannel: 1024n,
      SendMessages: 2048n,
      ManageMessages: 8192n,
      EmbedLinks: 16384n,
      AttachFiles: 32768n,
      ReadMessageHistory: 65536n,
      MentionEveryone: 131072n,
      Connect: 1048576n,
      Speak: 2097152n,
      ManageWebhooks: 536870912n,
      CreatePublicThreads: 34359738368n
    }
  }
}))

import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { validate } from 'class-validator'
import { PermissionsBitField } from 'discord.js'
import { APP_VALIDATION_PIPE_OPTIONS } from '../../core/http/validation-pipe.provider'
import {
  ALLOWED_CHANNEL_PERMISSION_ALLOW_KEYS,
  ALLOWED_CHANNEL_PERMISSION_DENY_KEYS,
  collectRequestedOverwritePermissionKeys,
  getChannelPermissionOverwritesValidationError,
  isDiscordSnowflake,
  toPermissionOverwriteResolvables
} from './channel-permission-overwrite.validator'
import type { CreateChannelPermissionOverwrite } from './channel-permission-overwrite.validator'
import { CreateChannelDto } from './create-channel.dto'

const SNOWFLAKE = '123456789012345678'

// AppModule の APP_PIPE と同一の共有設定で HTTP 経路の検証を再現する
const pipe = new ValidationPipe(APP_VALIDATION_PIPE_OPTIONS)

const buildDto = (overrides: Record<string, unknown>): CreateChannelDto =>
  Object.assign(new CreateChannelDto(), { guildId: 'g1', name: 'ch', ...overrides })

const validateDtoPermissionsError = async (permissions: unknown): Promise<boolean> => {
  const errors = await validate(buildDto({ permissions }))
  return errors.some((error) => error.property === 'permissions')
}

describe('channel-permission-overwrite.validator', () => {
  describe('許可キー定数', () => {
    it('allow は閲覧・投稿系の6種に限定される', () => {
      expect([...ALLOWED_CHANNEL_PERMISSION_ALLOW_KEYS]).toEqual([
        'ViewChannel',
        'SendMessages',
        'ReadMessageHistory',
        'AttachFiles',
        'EmbedLinks',
        'AddReactions'
      ])
    })

    it('deny は discord.js の Flags 全キーから Administrator だけを除いたもの', () => {
      expect(ALLOWED_CHANNEL_PERMISSION_DENY_KEYS).toEqual(
        Object.keys(PermissionsBitField.Flags).filter((key) => key !== 'Administrator')
      )
      expect(ALLOWED_CHANNEL_PERMISSION_DENY_KEYS).not.toContain('Administrator')
    })
  })

  // --- 判定テーブル（手続き・DTO デコレータの両経路で同じ結果になることを後段で固定する） ---

  const invalidCases: Array<[string, unknown]> = [
    ['permissions が配列でない', { id: SNOWFLAKE }],
    ['要素が null', [null]],
    ['要素が配列', [[]]],
    ['未知フィールドを含む', [{ id: SNOWFLAKE, managed: true }]],
    ['id が欠落', [{ allow: ['ViewChannel'] }]],
    ['id が Snowflake 形式でない', [{ id: 'not-a-snowflake' }]],
    ['allow が生 bitfield 文字列（配列でない）', [{ id: SNOWFLAKE, allow: '8' }]],
    ['allow が生 bitfield 数値（配列でない）', [{ id: SNOWFLAKE, allow: 8 }]],
    ['allow 要素が生 bitfield 文字列', [{ id: SNOWFLAKE, allow: ['8'] }]],
    ['allow 要素が生 bitfield 数値', [{ id: SNOWFLAKE, allow: [8] }]],
    ['deny 要素が生 bitfield 文字列', [{ id: SNOWFLAKE, deny: ['8'] }]],
    ['allow に管理系権限（ManageChannels）', [{ id: SNOWFLAKE, allow: ['ManageChannels'] }]],
    ['allow に ManageMessages（allow 対象外・deny 専用）', [{ id: SNOWFLAKE, allow: ['ManageMessages'] }]],
    ['allow に MentionEveryone（allow 対象外・deny 専用）', [{ id: SNOWFLAKE, allow: ['MentionEveryone'] }]],
    ['deny に Administrator', [{ id: SNOWFLAKE, deny: ['Administrator'] }]],
    ['type が不正値', [{ id: SNOWFLAKE, type: 'user' }]],
    ['type が非文字列', [{ id: SNOWFLAKE, type: 0 }]]
  ]

  const validCases: Array<[string, unknown]> = [
    ['permissions 未指定', undefined],
    // [] は形式上有効。「無指定=カテゴリ同期」への omit 正規化は channel-creator.pure が担う
    ['空配列', []],
    ['allow 全6種', [{ id: SNOWFLAKE, allow: [...ALLOWED_CHANNEL_PERMISSION_ALLOW_KEYS] }]],
    [
      'deny の広い指定（Connect/Speak/CreatePublicThreads/ManageWebhooks）',
      [{ id: SNOWFLAKE, deny: ['Connect', 'Speak', 'CreatePublicThreads', 'ManageWebhooks'] }]
    ],
    [
      'deny に MentionEveryone / ManageMessages（防御方向は許可）',
      [{ id: SNOWFLAKE, deny: ['MentionEveryone', 'ManageMessages'] }]
    ],
    ["type: 'role'", [{ id: SNOWFLAKE, type: 'role', allow: ['ViewChannel'] }]],
    ["type: 'member'", [{ id: SNOWFLAKE, type: 'member', deny: ['ViewChannel'] }]]
  ]

  describe('getChannelPermissionOverwritesValidationError（手続き検証）', () => {
    it.each(invalidCases)('%s はエラーを返す', (_label, permissions) => {
      expect(getChannelPermissionOverwritesValidationError(permissions)).toBeDefined()
    })

    it.each(validCases)('%s はエラーを返さない', (_label, permissions) => {
      expect(getChannelPermissionOverwritesValidationError(permissions)).toBeUndefined()
    })

    it('エラーメッセージへ受信値そのものを含めない（log injection 防止）', () => {
      const injected = 'MaliciousPermission\nfaked-log-line'
      const message = getChannelPermissionOverwritesValidationError([{ id: SNOWFLAKE, allow: [injected] }])

      expect(message).toBeDefined()
      expect(message).not.toContain(injected)
    })
  })

  describe('DTO デコレータ経由（class-validator）と手続き検証の一致', () => {
    it.each([...invalidCases, ...validCases])('%s は両経路で同じ判定になる', async (_label, permissions) => {
      const proceduralRejected = getChannelPermissionOverwritesValidationError(permissions) !== undefined
      const decoratorRejected = await validateDtoPermissionsError(permissions)

      expect(decoratorRejected).toBe(proceduralRejected)
    })
  })

  describe('ValidationPipe 経由（HTTP 経路相当）', () => {
    it('不正な permissions は BadRequestException で拒否される', async () => {
      const payload = { guildId: 'g1', name: 'ch', permissions: [{ id: SNOWFLAKE, deny: ['Administrator'] }] }

      await expect(pipe.transform(payload, { type: 'body', metatype: CreateChannelDto })).rejects.toBeInstanceOf(
        BadRequestException
      )
    })

    it('許可された permissions は通過する', async () => {
      const payload = {
        guildId: 'g1',
        name: 'ch',
        permissions: [{ id: SNOWFLAKE, allow: ['ViewChannel'], deny: ['Connect'], type: 'member' }]
      }

      const result = await pipe.transform(payload, { type: 'body', metatype: CreateChannelDto })

      expect(result.permissions).toEqual(payload.permissions)
    })
  })

  describe('isDiscordSnowflake / parentId 検証の一致', () => {
    const snowflakeCases: Array<[string, unknown, boolean]> = [
      ['17桁', '12345678901234567', true],
      ['18桁', SNOWFLAKE, true],
      ['19桁', '1234567890123456789', true],
      ['16桁（短すぎ）', '1234567890123456', false],
      ['20桁（長すぎ）', '12345678901234567890', false],
      ['数字以外を含む', 'abc456789012345678', false],
      ['空文字', '', false],
      ['数値型（文字列でない）', 1234567890123456, false],
      ['undefined', undefined, false]
    ]

    it.each(snowflakeCases)('%s → %p', (_label, value, expected) => {
      expect(isDiscordSnowflake(value)).toBe(expected)
    })

    it.each(snowflakeCases)(
      'parentId=%s の DTO デコレータ判定は共有 predicate と一致する（undefined は任意項目として通過）',
      async (_label, value, expected) => {
        const errors = await validate(buildDto({ parentId: value }))
        const rejected = errors.some((error) => error.property === 'parentId')

        // parentId は optional なので undefined は常に通過。それ以外は predicate と同一判定
        expect(rejected).toBe(value === undefined ? false : !expected)
      }
    )

    it('ValidationPipe 経由でも不正な parentId は BadRequestException で拒否される', async () => {
      const payload = { guildId: 'g1', name: 'ch', parentId: 'not-a-snowflake' }

      await expect(pipe.transform(payload, { type: 'body', metatype: CreateChannelDto })).rejects.toBeInstanceOf(
        BadRequestException
      )
    })
  })

  describe('collectRequestedOverwritePermissionKeys（caller-holds 検証用のキー集約）', () => {
    it('permissions 未指定は undefined（追加の権限要求なし）を返す', () => {
      expect(collectRequestedOverwritePermissionKeys(undefined)).toBeUndefined()
    })

    it('空配列は overwrite 無指定扱いとして undefined を返す', () => {
      expect(collectRequestedOverwritePermissionKeys([])).toBeUndefined()
    })

    it('allow/deny の和集合を重複除去して返す', () => {
      const keys = collectRequestedOverwritePermissionKeys([
        { id: SNOWFLAKE, allow: ['ViewChannel', 'SendMessages'], deny: ['ManageMessages'] },
        { id: SNOWFLAKE, deny: ['SendMessages', 'ManageMessages'] }
      ])

      expect(keys).toEqual(['ViewChannel', 'SendMessages', 'ManageMessages'])
    })

    it('allow/deny を持たない非空 overwrite は空配列（ManageRoles 要求のみ発生）を返す', () => {
      expect(collectRequestedOverwritePermissionKeys([{ id: SNOWFLAKE }])).toEqual([])
    })
  })

  describe('toPermissionOverwriteResolvables（SDK 契約への正規化）', () => {
    it('undefined はそのまま undefined を返す', () => {
      expect(toPermissionOverwriteResolvables(undefined)).toBeUndefined()
    })

    it("type: 'role' / 'member' を OverwriteType の実値（0 / 1）へ変換する", () => {
      const permissions: CreateChannelPermissionOverwrite[] = [
        { id: SNOWFLAKE, type: 'role', allow: ['ViewChannel'] },
        { id: SNOWFLAKE, type: 'member', deny: ['Connect'] }
      ]

      expect(toPermissionOverwriteResolvables(permissions)).toEqual([
        { id: SNOWFLAKE, type: 0, allow: ['ViewChannel'] },
        { id: SNOWFLAKE, type: 1, deny: ['Connect'] }
      ])
    })

    it('type 省略時は type フィールド自体を付けない（discord.js の解決に委ねる）', () => {
      const [overwrite] = toPermissionOverwriteResolvables([{ id: SNOWFLAKE, allow: ['ViewChannel'] }]) ?? []

      expect(overwrite).toEqual({ id: SNOWFLAKE, allow: ['ViewChannel'] })
      expect(overwrite).not.toHaveProperty('type')
    })

    it('allow / deny 省略時はフィールド自体を付けない', () => {
      const [overwrite] = toPermissionOverwriteResolvables([{ id: SNOWFLAKE }]) ?? []

      expect(overwrite).toEqual({ id: SNOWFLAKE })
      expect(overwrite).not.toHaveProperty('allow')
      expect(overwrite).not.toHaveProperty('deny')
    })
  })
})
