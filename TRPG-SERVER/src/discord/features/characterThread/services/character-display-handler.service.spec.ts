import { Test } from '@nestjs/testing'
import { CharacterDisplayHandlerService } from './character-display-handler.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { DiscordClientService } from '../../../services/discord-client.service'
import { CharacterDisplayService } from './character-display.service'

/**
 * CharacterDisplayHandlerService は constructor で discord.character.display.requested を購読し、
 * displayType に応じて Discord チャンネルを取得して表示処理へ進む。
 * E-3d: dead だった embed 更新リクエスト・成否イベントの emit は撤去済みで、
 * ハンドラは「聞くだけで何も emit しない」ゴースト（購読の解体は E-5/E-6 スコープ）。
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
    it('basic 表示ではチャンネルを取得するが dead イベントは一切 emit しない（E-3d）', async () => {
      // Arrange: テキストベースのチャンネルを返す
      channelsFetch.mockResolvedValue({ id: 'channel-1', isTextBased: () => true })

      // Act
      await registeredHandler(buildPayload({ displayType: 'basic' }))

      // Assert: チャンネル取得までは行うが、embed 更新リクエスト・成否イベントは emit しない
      expect(channelsFetch).toHaveBeenCalledWith('channel-1')
      expect(eventService.emit).not.toHaveBeenCalled()
    })

    it('displayType が未指定でも basic 経路として処理する（emit なし）', async () => {
      // Arrange
      channelsFetch.mockResolvedValue({ id: 'channel-1', isTextBased: () => true })

      // Act
      await registeredHandler(buildPayload({ displayType: undefined }))

      // Assert: basic 経路（チャンネル取得）へ進むが emit はしない
      expect(channelsFetch).toHaveBeenCalledWith('channel-1')
      expect(eventService.emit).not.toHaveBeenCalled()
    })

    it('basic/compact 以外の displayType は何もせずスキップする', async () => {
      // Act
      await registeredHandler(buildPayload({ displayType: 'enhanced' }))

      // Assert: チャンネル取得もイベント発火もしない
      expect(channelsFetch).not.toHaveBeenCalled()
      expect(eventService.emit).not.toHaveBeenCalled()
    })

    it('チャンネルが取得できない場合もエラーを握りつぶし failed イベントは emit しない（E-3d）', async () => {
      // Arrange
      channelsFetch.mockResolvedValue(null)

      // Act & Assert: 例外は外へ伝播せず、dead な failed イベントも emit しない
      await expect(registeredHandler(buildPayload({ displayType: 'basic' }))).resolves.toBeUndefined()
      expect(eventService.emit).not.toHaveBeenCalled()
    })

    it('チャンネルがテキストベースでない場合もエラーを握りつぶし emit しない（E-3d）', async () => {
      // Arrange
      channelsFetch.mockResolvedValue({ id: 'channel-1', isTextBased: () => false })

      // Act & Assert
      await expect(registeredHandler(buildPayload({ displayType: 'compact' }))).resolves.toBeUndefined()
      expect(eventService.emit).not.toHaveBeenCalled()
    })

    it('fetch が例外を投げた場合もエラーを握りつぶし emit しない（E-3d）', async () => {
      // Arrange
      channelsFetch.mockRejectedValue(new Error('fetch error'))

      // Act & Assert
      await expect(registeredHandler(buildPayload({ displayType: 'basic' }))).resolves.toBeUndefined()
      expect(eventService.emit).not.toHaveBeenCalled()
    })
  })
})
