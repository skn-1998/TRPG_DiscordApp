// グローバル jest-setup の discord.js モックを無効化し、
// 実際の EmbedBuilder / StringSelectMenuBuilder / ChannelType（GuildText）挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test, TestingModule } from '@nestjs/testing'
import { ChannelType, Collection } from 'discord.js'
import { CharacterUIService } from './character-ui.service'
import { DiscordClientService } from 'src/discord/services/discord-client.service'
import { Character } from 'src/domains/character/models/character.model'

/**
 * Characterization tests for CharacterUIService.
 *
 * 目的: 分割リファクタ前後で「どの channel API を・どの引数で呼ぶか／何を送信・編集するか」を固定する安全網。
 * Discord I/O はモック client/channel/message に差し替え、純粋構築は util の実挙動を通す（unmock）。
 *
 * 緑/黄評価:
 * - 緑: sendMessage, sendCharacterDeletionNotification, updateChannelName, archiveChannel,
 *       addChannelArchiveEmoji, updateChannelStatusDisplay, getTextChannel,
 *       sendCharacterEmbedWithSelectMenu, handleSectionSelectInteraction（モックで素直に固定可能）
 * - 黄: updateCharacterEmbed, removeCharacterEmbeds, createOrUpdateCharacterEmbed
 *       （messages.fetch の Collection.find/filter を扱うため、実 discord.js Collection で固定）
 * - 赤: なし（全公開メソッドを書ける範囲で固定）
 */
describe('CharacterUIService (characterization)', () => {
  let service: CharacterUIService
  let module: TestingModule
  let mockClient: any

  const BOT_ID = 'bot-user-id'

  /** 送信/編集/削除を記録できるメッセージモック */
  const makeMessage = (overrides: Record<string, unknown> = {}) => ({
    id: 'sent-message-id',
    author: { id: BOT_ID },
    embeds: [],
    edit: jest.fn().mockResolvedValue({ id: 'edited-message-id' }),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides
  })

  /** GuildText チャンネルモック */
  const makeChannel = (overrides: Record<string, unknown> = {}) => ({
    id: 'channel-1',
    type: ChannelType.GuildText,
    isTextBased: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue(makeMessage()),
    edit: jest.fn().mockResolvedValue(undefined),
    setTopic: jest.fn().mockResolvedValue(undefined),
    setName: jest.fn().mockResolvedValue(undefined),
    messages: {
      fetch: jest.fn().mockResolvedValue(new Collection())
    },
    guild: {
      roles: { everyone: { id: 'everyone-role' } }
    },
    permissionOverwrites: {
      edit: jest.fn().mockResolvedValue(undefined)
    },
    ...overrides
  })

  const buildCharacter = (overrides: Partial<Character> = {}): Character =>
    ({
      characterId: 'char-1234',
      characterName: 'テスト太郎',
      discordChannelId: 'channel-1',
      ...overrides
    }) as unknown as Character

  beforeEach(async () => {
    mockClient = {
      user: { id: BOT_ID },
      channels: { fetch: jest.fn() },
      guilds: { fetch: jest.fn() }
    }

    module = await Test.createTestingModule({
      providers: [
        CharacterUIService,
        {
          provide: DiscordClientService,
          useValue: { getClient: jest.fn().mockReturnValue(mockClient) }
        }
      ]
    }).compile()

    service = module.get<CharacterUIService>(CharacterUIService)
    jest.clearAllMocks()
  })

  afterEach(async () => {
    await module.close()
  })

  describe('sendMessage', () => {
    it('content を channel.send に渡し messageId を返す', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      const result = await service.sendMessage({ channelId: 'channel-1', content: 'hello' })

      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel-1')
      expect(channel.send).toHaveBeenCalledWith({ content: 'hello' })
      expect(result).toEqual({ success: true, messageId: 'sent-message-id' })
    })

    it('client が無い場合は失敗を返し send しない', async () => {
      ;(service as any).discordClientService.getClient.mockReturnValue(null)
      const result = await service.sendMessage({ channelId: 'channel-1', content: 'x' })
      expect(result).toEqual({ success: false, error: 'Discord client not available' })
    })

    it('テキストチャンネルでない場合は Invalid channel を返す', async () => {
      const channel = makeChannel({ isTextBased: jest.fn().mockReturnValue(false) })
      mockClient.channels.fetch.mockResolvedValue(channel)
      const result = await service.sendMessage({ channelId: 'channel-1', content: 'x' })
      expect(result).toEqual({ success: false, error: 'Invalid channel' })
      expect(channel.send).not.toHaveBeenCalled()
    })
  })

  describe('getTextChannel', () => {
    it('GuildText チャンネルをそのまま返す', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)
      const result = await service.getTextChannel('channel-1')
      expect(result).toBe(channel)
    })

    it('GuildText でない場合は null を返す', async () => {
      const channel = makeChannel({ type: ChannelType.GuildVoice })
      mockClient.channels.fetch.mockResolvedValue(channel)
      const result = await service.getTextChannel('channel-1')
      expect(result).toBeNull()
    })
  })

  describe('sendCharacterDeletionNotification', () => {
    it('userId 付き削除メッセージを送信する', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.sendCharacterDeletionNotification('channel-1', 'テスト太郎', 'user-99')

      expect(channel.send).toHaveBeenCalledWith({
        content: '<@user-99> キャラクター「テスト太郎」が削除されました。'
      })
    })
  })

  describe('updateChannelName', () => {
    it('channel.setName を新しい名前で呼ぶ', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.updateChannelName('channel-1', 'new-name')

      expect(channel.setName).toHaveBeenCalledWith('new-name')
    })

    it('GuildText でない場合は throw する', async () => {
      const channel = makeChannel({ type: ChannelType.GuildVoice })
      mockClient.channels.fetch.mockResolvedValue(channel)
      await expect(service.updateChannelName('channel-1', 'x')).rejects.toThrow('Invalid text channel')
    })
  })

  describe('archiveChannel', () => {
    it('everyone ロールに対し SendMessages/AddReactions を false にする', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.archiveChannel('channel-1')

      expect(channel.permissionOverwrites.edit).toHaveBeenCalledWith(channel.guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false
      })
    })
  })

  describe('addChannelArchiveEmoji', () => {
    it('アーカイブ通知メッセージを送信する', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.addChannelArchiveEmoji('channel-1')

      expect(channel.send).toHaveBeenCalledWith({
        content: '🗄️ このチャンネルはアーカイブされました'
      })
    })
  })

  describe('updateChannelStatusDisplay', () => {
    it('status を含むトピックテキストを setTopic に渡す', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.updateChannelStatusDisplay(
        'channel-1',
        buildCharacter({ status: { hp: 10, mp: 5 } as unknown as Character['status'] })
      )

      expect(channel.setTopic).toHaveBeenCalledWith('🎭 テスト太郎 | HP: 10 | MP: 5')
    })
  })

  describe('updateCharacterEmbed', () => {
    it('既存のキャラクター情報 Embed メッセージがあれば edit する', async () => {
      const existing = makeMessage({ embeds: [{ title: '🎭 キャラクター情報 - 旧' }] })
      const channel = makeChannel({
        messages: { fetch: jest.fn().mockResolvedValue(new Collection([['m1', existing]])) }
      })
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.updateCharacterEmbed('channel-1', buildCharacter())

      expect(existing.edit).toHaveBeenCalledTimes(1)
      const arg = existing.edit.mock.calls[0][0]
      expect(arg.embeds[0].toJSON().title).toBe('🎭 キャラクター情報 - テスト太郎')
      expect(channel.send).not.toHaveBeenCalled()
    })

    it('既存 Embed が無ければ新規 send する', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.updateCharacterEmbed('channel-1', buildCharacter())

      expect(channel.send).toHaveBeenCalledTimes(1)
      const arg = channel.send.mock.calls[0][0]
      expect(arg.embeds[0].toJSON().title).toBe('🎭 キャラクター情報 - テスト太郎')
    })
  })

  describe('removeCharacterEmbeds', () => {
    it('ボットのキャラクター情報 Embed メッセージのみ削除する', async () => {
      const target = makeMessage({ id: 'm1', embeds: [{ title: '🎭 キャラクター情報 - X' }] })
      const other = makeMessage({ id: 'm2', author: { id: 'someone-else' }, embeds: [{ title: 'キャラクター情報' }] })
      const noEmbed = makeMessage({ id: 'm3', embeds: [] })
      const channel = makeChannel({
        messages: {
          fetch: jest.fn().mockResolvedValue(
            new Collection([
              ['m1', target],
              ['m2', other],
              ['m3', noEmbed]
            ])
          )
        }
      })
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.removeCharacterEmbeds('channel-1')

      expect(target.delete).toHaveBeenCalledTimes(1)
      expect(other.delete).not.toHaveBeenCalled()
      expect(noEmbed.delete).not.toHaveBeenCalled()
    })
  })

  describe('createOrUpdateCharacterEmbed', () => {
    const guildInfo = { id: '', name: 'TRPG Server', memberCount: 0, channels: [] }

    it('既存 Embed が無ければ新規 send し messageId を返す', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      const result = await service.createOrUpdateCharacterEmbed(buildCharacter(), 'channel-1', guildInfo)

      expect(channel.send).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ success: true, messageId: 'sent-message-id' })
    })

    it('既存 Embed があれば edit して messageId を返す', async () => {
      const existing = makeMessage({ embeds: [{ title: '🎭 キャラクター情報 - 旧' }] })
      const channel = makeChannel({
        messages: { fetch: jest.fn().mockResolvedValue(new Collection([['m1', existing]])) }
      })
      mockClient.channels.fetch.mockResolvedValue(channel)

      const result = await service.createOrUpdateCharacterEmbed(buildCharacter(), 'channel-1', guildInfo)

      expect(existing.edit).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ success: true, messageId: 'edited-message-id' })
    })
  })

  describe('createChannel', () => {
    it('GuildText チャンネルを作成し channelId を返す', async () => {
      const guild = {
        channels: { create: jest.fn().mockResolvedValue({ id: 'new-channel-id' }) }
      }
      mockClient.guilds.fetch.mockResolvedValue(guild)

      const result = await service.createChannel({
        guildId: 'guild-1',
        name: 'session',
        topic: 'topic',
        parentId: 'parent-1'
      } as any)

      expect(guild.channels.create).toHaveBeenCalledWith({
        name: 'session',
        type: ChannelType.GuildText,
        topic: 'topic',
        parent: 'parent-1'
      })
      expect(result).toEqual({ success: true, channelId: 'new-channel-id' })
    })
  })

  describe('sendCharacterEmbedWithSelectMenu', () => {
    it('embed 1件 + セクション選択メニュー行1件を送信する', async () => {
      const channel = makeChannel()
      mockClient.channels.fetch.mockResolvedValue(channel)

      await service.sendCharacterEmbedWithSelectMenu('channel-1', buildCharacter(), 'user-99')

      expect(channel.send).toHaveBeenCalledTimes(1)
      const arg = channel.send.mock.calls[0][0]
      expect(arg.embeds[0].toJSON().title).toBe('🎭 キャラクター情報 - テスト太郎')
      expect(arg.components).toHaveLength(1)
      const row = arg.components[0].toJSON()
      expect(row.components[0].custom_id).toBe('character-section-select-char-1234')
    })
  })

  describe('handleSectionSelectInteraction', () => {
    const makeInteraction = (overrides: Record<string, unknown> = {}) =>
      ({
        customId: 'character-section-select-char-1234',
        values: ['status'],
        message: { embeds: [{ title: 'existing' }] },
        replied: false,
        deferred: false,
        deferUpdate: jest.fn().mockResolvedValue(undefined),
        editReply: jest.fn().mockResolvedValue(undefined),
        reply: jest.fn().mockResolvedValue(undefined),
        ...overrides
      }) as any

    it('customId パターン不一致なら何もしない（defer/editReply されない）', async () => {
      const interaction = makeInteraction({ customId: 'unrelated-id' })
      await service.handleSectionSelectInteraction(interaction)
      expect(interaction.deferUpdate).not.toHaveBeenCalled()
      expect(interaction.editReply).not.toHaveBeenCalled()
    })

    it('セクション選択時: 元 Embed 維持 + フィールド行 + 戻り行を editReply する', async () => {
      const interaction = makeInteraction({ values: ['status'] })
      await service.handleSectionSelectInteraction(interaction)

      expect(interaction.deferUpdate).toHaveBeenCalledTimes(1)
      const arg = interaction.editReply.mock.calls[0][0]
      expect(arg.embeds).toBe(interaction.message.embeds)
      expect(arg.components).toHaveLength(2)
      // 1行目: フィールド編集メニュー, 2行目: 戻りメニュー
      expect(arg.components[0].toJSON().components[0].custom_id).toBe('character-field-edit-status-char-1234')
      expect(arg.components[1].toJSON().components[0].custom_id).toBe('character-section-select-char-1234')
    })

    it('back 選択時: メインのセクション選択メニュー1行を editReply する', async () => {
      const interaction = makeInteraction({ values: ['back'] })
      await service.handleSectionSelectInteraction(interaction)

      const arg = interaction.editReply.mock.calls[0][0]
      expect(arg.components).toHaveLength(1)
      const row = arg.components[0].toJSON()
      expect(row.components[0].custom_id).toBe('character-section-select-char-1234')
      expect(row.components[0].placeholder).toBe('編集するセクションを選択')
    })
  })
})
