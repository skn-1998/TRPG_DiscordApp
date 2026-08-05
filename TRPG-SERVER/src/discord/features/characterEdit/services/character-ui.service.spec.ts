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
 */
describe('CharacterUIService (characterization)', () => {
  let service: CharacterUIService
  let module: TestingModule
  let mockClient: any

  const BOT_ID = 'bot-user-id'

  const makeMessage = (overrides: Record<string, unknown> = {}) => ({
    id: 'sent-message-id',
    author: { id: BOT_ID },
    embeds: [],
    edit: jest.fn().mockResolvedValue({ id: 'edited-message-id' }),
    ...overrides
  })

  /** GuildText チャンネルモック */
  const makeChannel = (overrides: Record<string, unknown> = {}) => ({
    type: ChannelType.GuildText,
    isTextBased: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue(makeMessage()),
    messages: {
      fetch: jest.fn().mockResolvedValue(new Collection())
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
})
