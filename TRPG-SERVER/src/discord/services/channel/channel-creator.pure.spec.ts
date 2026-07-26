/**
 * このファイル限定で discord.js の ChannelType に必要な enum 値を与える。
 * グローバルの jest-setup モックは ChannelType を { PublicThread: 11 } のみとしており、
 * GuildText / GuildVoice / PrivateThread 等の区別ができず、純関数の分岐検証ができないため。
 * 本体（channel-creator.pure.ts）も同じモック参照を使うので、enum 値の比較は一致する。
 */
jest.mock('discord.js', () => ({
  ChannelType: {
    GuildText: 0,
    GuildVoice: 2,
    GuildCategory: 4,
    GuildAnnouncement: 5,
    PublicThread: 11,
    PrivateThread: 12,
    GuildStageVoice: 13,
    GuildForum: 15
  }
}))

import { ChannelType } from 'discord.js'
import {
  buildChannelInfo,
  buildChannelCreateOptions,
  buildThreadCreateOptions,
  buildCategoryCreateOptions,
  buildPermissionOverwrites,
  buildDeniedPermissionMap,
  summarizePermissions,
  hasAnyPermission,
  convertChannelType,
  ChannelInfoSource
} from './channel-creator.pure'

/**
 * channel-creator.pure.ts の純関数群に対する単体テスト。
 * 副作用がないためモック不要。入力 → 出力のみで検証する。
 *
 * 注意: discord.js の ChannelType は jest-setup でモックされている。
 * テスト・本体ともに同一の（モックされた）参照を使うため、enum 値の比較は一致する。
 * 実 enum 値を requireActual で混在させない。
 */
describe('channel-creator.pure', () => {
  describe('buildChannelInfo', () => {
    const baseSource = (overrides: Partial<ChannelInfoSource> = {}): ChannelInfoSource => ({
      id: 'ch-1',
      type: 0,
      name: 'general',
      isThread: false,
      ...overrides
    })

    it('id / name / type を必ず含める', () => {
      // Act
      const result = buildChannelInfo(baseSource())

      // Assert
      expect(result.id).toBe('ch-1')
      expect(result.name).toBe('general')
      expect(result.type).toBe(ChannelType[0] || 'Unknown')
    })

    it('name が undefined のときは "Unknown" になる', () => {
      // Act
      const result = buildChannelInfo(baseSource({ name: undefined }))

      // Assert
      expect(result.name).toBe('Unknown')
    })

    it('未知の type は "Unknown" になる', () => {
      // Arrange: モックに存在しない type 値
      const result = buildChannelInfo(baseSource({ type: 9999 }))

      // Assert
      expect(result.type).toBe('Unknown')
    })

    it('guildId / parentId / topic は truthy のときだけ付与する', () => {
      // Act
      const result = buildChannelInfo(baseSource({ guildId: 'g-1', parentId: 'p-1', topic: 'hello' }))

      // Assert
      expect(result.guildId).toBe('g-1')
      expect(result.parentId).toBe('p-1')
      expect(result.topic).toBe('hello')
    })

    it('guildId / parentId / topic が falsy なら結果に含めない', () => {
      // Act
      const result = buildChannelInfo(baseSource({ guildId: null, parentId: undefined, topic: '' }))

      // Assert
      expect(result).not.toHaveProperty('guildId')
      expect(result).not.toHaveProperty('parentId')
      expect(result).not.toHaveProperty('topic')
    })

    it('isThread が true のとき memberCount を付与する', () => {
      // Act
      const result = buildChannelInfo(baseSource({ isThread: true, memberCount: 5 }))

      // Assert
      expect(result.memberCount).toBe(5)
    })

    it('isThread が false のとき memberCount を付与しない', () => {
      // Act
      const result = buildChannelInfo(baseSource({ isThread: false, memberCount: 5 }))

      // Assert
      expect(result).not.toHaveProperty('memberCount')
    })
  })

  describe('buildChannelCreateOptions', () => {
    it('options 未指定なら name と type(GuildText) のみ', () => {
      // Act
      const opts = buildChannelCreateOptions('general')

      // Assert
      expect(opts).toEqual({ name: 'general', type: ChannelType.GuildText })
    })

    it('type を指定した場合はその値を使う', () => {
      // Act
      const opts = buildChannelCreateOptions('t', { type: ChannelType.PublicThread })

      // Assert
      expect(opts.type).toBe(ChannelType.PublicThread)
    })

    it('parent / topic / permissions は truthy のときだけ付与する', () => {
      // Act
      const opts = buildChannelCreateOptions('c', {
        parent: 'parent-id',
        topic: 'topic',
        permissions: [{ id: 'x' }] as never
      })

      // Assert
      expect(opts.parent).toBe('parent-id')
      expect(opts.topic).toBe('topic')
      expect(opts.permissionOverwrites).toEqual([{ id: 'x' }])
    })

    it('permissions: [] は「無指定=カテゴリ同期」へ正規化し permissionOverwrites を付与しない', () => {
      // [] を明示すると「overwrite 無し」の指定になり親カテゴリとの権限同期が外れるため、
      // 無指定と同じ扱い（omit）へ正規化する
      const opts = buildChannelCreateOptions('c', { parent: 'parent-id', permissions: [] })

      expect(opts).not.toHaveProperty('permissionOverwrites')
    })

    it('position / nsfw / rateLimitPerUser は undefined でなければ付与する（0/false も含む）', () => {
      // Act
      const opts = buildChannelCreateOptions('c', {
        position: 0,
        nsfw: false,
        rateLimitPerUser: 0
      })

      // Assert: undefined 判定なので 0 / false も付与される
      expect(opts.position).toBe(0)
      expect(opts.nsfw).toBe(false)
      expect(opts.rateLimitPerUser).toBe(0)
    })

    it('未指定の position / nsfw / rateLimitPerUser は付与しない', () => {
      // Act
      const opts = buildChannelCreateOptions('c', {})

      // Assert
      expect(opts).not.toHaveProperty('position')
      expect(opts).not.toHaveProperty('nsfw')
      expect(opts).not.toHaveProperty('rateLimitPerUser')
    })

    it('GuildVoice のとき bitrate / userLimit を付与する', () => {
      // Act
      const opts = buildChannelCreateOptions('v', {
        type: ChannelType.GuildVoice,
        bitrate: 64000,
        userLimit: 10
      })

      // Assert
      expect(opts.bitrate).toBe(64000)
      expect(opts.userLimit).toBe(10)
    })

    it('GuildVoice 以外では bitrate / userLimit を付与しない', () => {
      // Act
      const opts = buildChannelCreateOptions('t', {
        type: ChannelType.GuildText,
        bitrate: 64000,
        userLimit: 10
      })

      // Assert
      expect(opts).not.toHaveProperty('bitrate')
      expect(opts).not.toHaveProperty('userLimit')
    })
  })

  describe('buildThreadCreateOptions', () => {
    it('options 未指定なら name と type(PublicThread) のみ', () => {
      // Act
      const opts = buildThreadCreateOptions('thread')

      // Assert
      expect(opts).toEqual({ name: 'thread', type: ChannelType.PublicThread })
    })

    it('type を指定した場合はその値を使う', () => {
      // Act
      const opts = buildThreadCreateOptions('thread', { type: ChannelType.PrivateThread })

      // Assert
      expect(opts.type).toBe(ChannelType.PrivateThread)
    })

    it('autoArchiveDuration / reason は truthy のときだけ付与する', () => {
      // Act
      const opts = buildThreadCreateOptions('thread', {
        autoArchiveDuration: 1440,
        reason: 'because'
      })

      // Assert
      expect(opts.autoArchiveDuration).toBe(1440)
      expect(opts.reason).toBe('because')
    })

    it('autoArchiveDuration / reason 未指定なら付与しない', () => {
      // Act
      const opts = buildThreadCreateOptions('thread', {})

      // Assert
      expect(opts).not.toHaveProperty('autoArchiveDuration')
      expect(opts).not.toHaveProperty('reason')
    })
  })

  describe('buildCategoryCreateOptions', () => {
    it('options 未指定なら name と type(GuildCategory) のみ', () => {
      // Act
      const opts = buildCategoryCreateOptions('cat')

      // Assert
      expect(opts).toEqual({ name: 'cat', type: ChannelType.GuildCategory })
    })

    it('position は undefined でなければ付与する（0 を含む）', () => {
      // Act
      const opts = buildCategoryCreateOptions('cat', { position: 0 })

      // Assert
      expect(opts.position).toBe(0)
    })

    it('permissions は truthy のときだけ付与する', () => {
      // Act
      const opts = buildCategoryCreateOptions('cat', {
        permissions: [{ id: 'x' }] as never
      })

      // Assert
      expect(opts.permissionOverwrites).toEqual([{ id: 'x' }])
    })

    it('未指定の position / permissions は付与しない', () => {
      // Act
      const opts = buildCategoryCreateOptions('cat', {})

      // Assert
      expect(opts).not.toHaveProperty('position')
      expect(opts).not.toHaveProperty('permissionOverwrites')
    })
  })

  describe('buildPermissionOverwrites', () => {
    it('allow / deny を両方付与できる', () => {
      // Act
      const overwrites = buildPermissionOverwrites({
        allow: ['ViewChannel'],
        deny: ['SendMessages']
      })

      // Assert
      expect(overwrites).toEqual({ allow: ['ViewChannel'], deny: ['SendMessages'] })
    })

    it('allow のみのときは deny を含めない', () => {
      // Act
      const overwrites = buildPermissionOverwrites({ allow: ['ViewChannel'] })

      // Assert
      expect(overwrites).toEqual({ allow: ['ViewChannel'] })
    })

    it('空オブジェクトのときは何も付与しない', () => {
      // Act
      const overwrites = buildPermissionOverwrites({})

      // Assert
      expect(overwrites).toEqual({})
    })
  })

  describe('buildDeniedPermissionMap', () => {
    it('すべての権限を false にした map を返す', () => {
      // Act
      const map = buildDeniedPermissionMap(['ViewChannel', 'SendMessages'])

      // Assert
      expect(map).toEqual({ ViewChannel: false, SendMessages: false })
    })

    it('空配列のときは空オブジェクトを返す', () => {
      // Act & Assert
      expect(buildDeniedPermissionMap([])).toEqual({})
    })
  })

  describe('summarizePermissions', () => {
    it('hasPermission の結果を権限名ごとに map 化する', () => {
      // Arrange
      const hasPermission = (p: string) => p === 'ViewChannel'

      // Act
      const result = summarizePermissions(['ViewChannel', 'SendMessages'], hasPermission)

      // Assert
      expect(result).toEqual({ ViewChannel: true, SendMessages: false })
    })

    it('空配列のときは空オブジェクトを返す', () => {
      // Act & Assert
      expect(summarizePermissions([], () => true)).toEqual({})
    })
  })

  describe('hasAnyPermission', () => {
    it('いずれかが true なら true', () => {
      // Act & Assert
      expect(hasAnyPermission({ a: false, b: true })).toBe(true)
    })

    it('すべて false なら false', () => {
      // Act & Assert
      expect(hasAnyPermission({ a: false, b: false })).toBe(false)
    })

    it('空オブジェクトは false', () => {
      // Act & Assert
      expect(hasAnyPermission({})).toBe(false)
    })
  })

  describe('convertChannelType', () => {
    it('既知の文字列を対応する ChannelType に変換する', () => {
      // Act & Assert
      expect(convertChannelType('text')).toBe(ChannelType.GuildText)
      expect(convertChannelType('voice')).toBe(ChannelType.GuildVoice)
      expect(convertChannelType('category')).toBe(ChannelType.GuildCategory)
      expect(convertChannelType('news')).toBe(ChannelType.GuildAnnouncement)
      expect(convertChannelType('stage')).toBe(ChannelType.GuildStageVoice)
      expect(convertChannelType('forum')).toBe(ChannelType.GuildForum)
      expect(convertChannelType('public_thread')).toBe(ChannelType.PublicThread)
      expect(convertChannelType('private_thread')).toBe(ChannelType.PrivateThread)
    })

    it('大文字混じりでも toLowerCase で変換する', () => {
      // Act & Assert
      expect(convertChannelType('Text')).toBe(ChannelType.GuildText)
      expect(convertChannelType('PUBLIC_THREAD')).toBe(ChannelType.PublicThread)
    })

    it('未知の文字列は GuildText にフォールバックする', () => {
      // Act & Assert
      expect(convertChannelType('unknown')).toBe(ChannelType.GuildText)
      expect(convertChannelType('')).toBe(ChannelType.GuildText)
    })
  })
})
