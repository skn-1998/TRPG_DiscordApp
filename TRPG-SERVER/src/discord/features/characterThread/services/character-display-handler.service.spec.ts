import { Test } from '@nestjs/testing'
import { CharacterDisplayHandlerService } from './character-display-handler.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { DiscordClientService } from '../../../services/discord-client.service'
import { CharacterDisplayService } from './character-display.service'

/**
 * CharacterDisplayHandlerService は constructor で discord.character.display.requested を購読し、
 * displayType に応じて Discord チャンネルを取得→ embed 更新イベントを発火、成否イベントを emit する。
 * typedEventService / discordClientService を mock し、on で登録されたハンドラを捕捉して直接駆動する。
 * channels.fetch + isTextBased を mock 固定し、正常系・非テキストチャンネル異常系・displayType スキップを検証する。
 */
describe('CharacterDisplayHandlerService', () => {
  let eventService: jest.Mocked<Pick<TypedEventService, 'on' | 'emit'>>
  let discordClientService: { getClient: jest.Mock }
  let channelsFetch: jest.Mock
  let registeredHandler: (payload: unknown) => Promise<void>

  const buildPayload = (overrides: Record<string, unknown> = {}) => ({
    character: { characterId: 'char-1' },
    channelId: 'channel-1',
    displayType: 'basic',
    requesterId: 'user-1',
    source: 'test',
    ...overrides
  })

  beforeEach(async () => {
    channelsFetch = jest.fn()
    discordClientService = {
      getClient: jest.fn().mockReturnValue({ channels: { fetch: channelsFetch } })
    }
    eventService = {
      on: jest.fn(),
      emit: jest.fn().mockResolvedValue(undefined)
    }

    await Test.createTestingModule({
      providers: [
        CharacterDisplayHandlerService,
        { provide: TypedEventService, useValue: eventService },
        { provide: DiscordClientService, useValue: discordClientService },
        { provide: CharacterDisplayService, useValue: {} }
      ]
    }).compile()

    // constructor で登録された discord.character.display.requested ハンドラを捕捉
    const call = eventService.on.mock.calls.find((c) => c[0] === 'discord.character.display.requested')
    registeredHandler = call![1] as never
  })

  it('constructor で discord.character.display.requested を購読する', () => {
    // Assert
    expect(eventService.on).toHaveBeenCalledWith('discord.character.display.requested', expect.any(Function))
  })

  describe('handleCharacterDisplayRequested', () => {
    it('basic 表示ではチャンネル取得後 embed 更新と completed イベントを emit する', async () => {
      // Arrange: テキストベースのチャンネルを返す
      channelsFetch.mockResolvedValue({ id: 'channel-1', isTextBased: () => true })

      // Act
      await registeredHandler(buildPayload({ displayType: 'basic' }))

      // Assert: embed 更新リクエストと成功イベント
      expect(eventService.emit).toHaveBeenCalledWith(
        'discord.embed.character.update.requested',
        expect.objectContaining({ channelId: 'channel-1', displayType: 'basic' })
      )
      expect(eventService.emit).toHaveBeenCalledWith(
        'discord.character.display.completed',
        expect.objectContaining({ characterId: 'char-1', success: true })
      )
    })

    it('displayType が未指定でも basic 経路として処理する', async () => {
      // Arrange
      channelsFetch.mockResolvedValue({ id: 'channel-1', isTextBased: () => true })

      // Act
      await registeredHandler(buildPayload({ displayType: undefined }))

      // Assert
      expect(eventService.emit).toHaveBeenCalledWith(
        'discord.character.display.completed',
        expect.objectContaining({ success: true })
      )
    })

    it('basic/compact 以外の displayType は何もせずスキップする', async () => {
      // Act
      await registeredHandler(buildPayload({ displayType: 'enhanced' }))

      // Assert: チャンネル取得もイベント発火もしない
      expect(channelsFetch).not.toHaveBeenCalled()
      expect(eventService.emit).not.toHaveBeenCalled()
    })

    it('チャンネルが取得できない場合は failed イベントを emit する', async () => {
      // Arrange
      channelsFetch.mockResolvedValue(null)

      // Act
      await registeredHandler(buildPayload({ displayType: 'basic' }))

      // Assert
      expect(eventService.emit).toHaveBeenCalledWith(
        'discord.character.display.failed',
        expect.objectContaining({ characterId: 'char-1' })
      )
    })

    it('チャンネルがテキストベースでない場合は failed イベントを emit する', async () => {
      // Arrange
      channelsFetch.mockResolvedValue({ id: 'channel-1', isTextBased: () => false })

      // Act
      await registeredHandler(buildPayload({ displayType: 'compact' }))

      // Assert
      expect(eventService.emit).toHaveBeenCalledWith(
        'discord.character.display.failed',
        expect.objectContaining({ channelId: 'channel-1' })
      )
    })

    it('fetch が例外を投げた場合も failed イベントを emit する', async () => {
      // Arrange
      channelsFetch.mockRejectedValue(new Error('fetch error'))

      // Act
      await registeredHandler(buildPayload({ displayType: 'basic' }))

      // Assert
      expect(eventService.emit).toHaveBeenCalledWith(
        'discord.character.display.failed',
        expect.objectContaining({ error: 'fetch error' })
      )
    })
  })
})
