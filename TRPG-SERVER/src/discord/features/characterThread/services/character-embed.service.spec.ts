// 本サービスは EmbedBuilder を実 new し、displayType ごとに Embed を組み立てるため、
// グローバル jest-setup の discord.js モックを無効化し実挙動を使う。
jest.unmock('discord.js')
jest.mock('discord.js', () => jest.requireActual('discord.js'))

import { Test } from '@nestjs/testing'
import { Collection, ThreadChannel } from 'discord.js'
import { CharacterEmbedService } from './character-embed.service'
import { DiscordClientService } from '../../../services/discord-client.service'

/**
 * CharacterEmbedService はキャラクター情報を Embed 化してスレッドへ送信するサービス。
 * 注意: constructor で discordClientService.getClient() を呼ぶため getClient を返す mock が必須。
 * thread は send / messages.fetch を持つ mock で固定し、postCharacterDisplay の displayType 分岐・
 * updateCharacterDisplay の早期 return / フォールバックを検証する。Embed 構造は実 discord.js で確認。
 */
describe('CharacterEmbedService', () => {
  let service: CharacterEmbedService
  let mockClient: { user: { id: string }; channels: { fetch: jest.Mock } }

  const buildCharacter = (overrides: Record<string, unknown> = {}) =>
    ({
      characterId: 'char-1',
      characterName: 'テスト探索者',
      gameSystemId: 'coc7',
      discordChannelId: 'channel-1',
      status: {},
      ...overrides
    }) as never

  // send をスパイできる thread モックを生成
  const createThread = (overrides: Record<string, unknown> = {}): ThreadChannel & { send: jest.Mock } =>
    ({
      id: 'thread-1',
      guildId: 'guild-1',
      send: jest.fn().mockResolvedValue({ id: 'msg-1' }),
      ...overrides
    }) as unknown as ThreadChannel & { send: jest.Mock }

  beforeEach(async () => {
    mockClient = {
      user: { id: 'bot-id' },
      channels: { fetch: jest.fn() }
    }

    const moduleRef = await Test.createTestingModule({
      providers: [CharacterEmbedService, { provide: DiscordClientService, useValue: { getClient: () => mockClient } }]
    }).compile()

    service = moduleRef.get(CharacterEmbedService)
  })

  describe('postCharacterDisplay', () => {
    it('enhanced 表示ではステータス等を含む Embed を thread.send する', async () => {
      // Arrange
      const thread = createThread()
      const character = buildCharacter({ status: { HP: 12 } })

      // Act
      await service.postCharacterDisplay(thread, character, 'enhanced')

      // Assert
      expect(thread.send).toHaveBeenCalledTimes(1)
      const embedJson = thread.send.mock.calls[0][0].embeds[0].toJSON()
      expect(embedJson.title).toBe('🎭 テスト探索者')
      expect(embedJson.fields).toEqual(expect.arrayContaining([expect.objectContaining({ name: '📊 ステータス' })]))
    })

    it('compact 表示では主要ステータスのみを含む Embed を送信する', async () => {
      // Arrange
      const thread = createThread()
      const character = buildCharacter({ status: { HP: 12 } })

      // Act
      await service.postCharacterDisplay(thread, character, 'compact')

      // Assert
      const embedJson = thread.send.mock.calls[0][0].embeds[0].toJSON()
      expect(embedJson.fields).toEqual(expect.arrayContaining([expect.objectContaining({ name: '📊 主要ステータス' })]))
    })

    it('basic 表示（デフォルト）でも Embed を送信する', async () => {
      // Arrange
      const thread = createThread()

      // Act
      await service.postCharacterDisplay(thread, buildCharacter())

      // Assert
      expect(thread.send).toHaveBeenCalledTimes(1)
      const embedJson = thread.send.mock.calls[0][0].embeds[0].toJSON()
      expect(embedJson.title).toBe('🎭 テスト探索者')
    })

    it('discordChannelId がある場合は編集チャンネルリンクを description に含む', async () => {
      // Arrange
      const thread = createThread()
      const character = buildCharacter({ discordChannelId: 'edit-ch' })

      // Act
      await service.postCharacterDisplay(thread, character, 'basic')

      // Assert
      const embedJson = thread.send.mock.calls[0][0].embeds[0].toJSON()
      expect(embedJson.description).toContain('https://discord.com/channels/guild-1/edit-ch')
    })

    it('thread.send が失敗した場合は例外を再スローする', async () => {
      // Arrange
      const thread = createThread({ send: jest.fn().mockRejectedValue(new Error('send failed')) })

      // Act & Assert
      await expect(service.postCharacterDisplay(thread, buildCharacter(), 'basic')).rejects.toThrow('send failed')
    })
  })

  describe('postCharacterInfo（互換メソッド）', () => {
    it('enhanced 表示として thread.send に委譲する', async () => {
      // Arrange
      const thread = createThread()

      // Act
      await service.postCharacterInfo(thread, buildCharacter(), 'someUser')

      // Assert
      expect(thread.send).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateCharacterDisplay', () => {
    it('discordThreadId が無い場合は早期 return し fetch しない', async () => {
      // Arrange
      const character = buildCharacter({ discordThreadId: undefined })

      // Act
      await service.updateCharacterDisplay(character)

      // Assert
      expect(mockClient.channels.fetch).not.toHaveBeenCalled()
    })

    it('取得チャンネルがスレッドでない場合は何もしない', async () => {
      // Arrange
      mockClient.channels.fetch.mockResolvedValue({ isThread: () => false })
      const character = buildCharacter({ discordThreadId: 'thread-1' })

      // Act & Assert: 例外なく完了
      await expect(service.updateCharacterDisplay(character)).resolves.toBeUndefined()
    })

    it('既存 Embed が見つからない場合は新規メッセージを投稿する', async () => {
      // Arrange: スレッドだが該当 Embed 無し
      const thread = createThread({
        isThread: () => true,
        messages: { fetch: jest.fn().mockResolvedValue(new Collection()) }
      })
      mockClient.channels.fetch.mockResolvedValue(thread)
      const character = buildCharacter({ discordThreadId: 'thread-1' })

      // Act
      await service.updateCharacterDisplay(character)

      // Assert: フォールバックで send が呼ばれる
      expect(thread.send).toHaveBeenCalled()
    })

    it('既存 Embed が見つかった場合はそのメッセージを edit する', async () => {
      // Arrange: bot が送信した該当キャラクターの Embed メッセージ
      const existingMessage = {
        author: { id: 'bot-id' },
        embeds: [{ title: '🎭 テスト探索者' }],
        edit: jest.fn().mockResolvedValue(undefined)
      }
      const thread = createThread({
        isThread: () => true,
        messages: { fetch: jest.fn().mockResolvedValue(new Collection([['m1', existingMessage]])) }
      })
      mockClient.channels.fetch.mockResolvedValue(thread)
      const character = buildCharacter({ discordThreadId: 'thread-1' })

      // Act
      await service.updateCharacterDisplay(character)

      // Assert: 既存メッセージを編集し、新規 send はしない
      expect(existingMessage.edit).toHaveBeenCalledTimes(1)
      expect(thread.send).not.toHaveBeenCalled()
    })
  })
})
