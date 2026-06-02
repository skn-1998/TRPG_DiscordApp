// ChannelNameSyncService はキャラクター名を Discord チャンネル名へ同期する。
// 公開 API は syncChannelNameToCharacter。private な sanitize/update はこの公開経路で検証する。
// 副作用境界は channel.setName / TypedEventService（emit・waitForEvent）/ ErrorHandler。
// waitForEvent は Promise.race で待つため、解決値で update 成否分岐を制御する。
jest.mock('src/utils/error-handler')

import { Test } from '@nestjs/testing'
import { TypedEventService } from 'src/core/events/typed-event.service'
import { ErrorHandler } from 'src/utils/error-handler'
import { ChannelNameSyncService } from './channel-name-sync.service'

const mockedErrorHandler = ErrorHandler as jest.Mocked<typeof ErrorHandler>

describe('ChannelNameSyncService', () => {
  let service: ChannelNameSyncService
  let typedEventService: jest.Mocked<Pick<TypedEventService, 'emit' | 'waitForEvent'>>

  interface MockChannel {
    id: string
    name: string
    setName: jest.Mock
  }

  function buildChannel(name: string, overrides: Record<string, unknown> = {}): MockChannel {
    return {
      id: 'ch-1',
      name,
      setName: jest.fn().mockResolvedValue(undefined),
      ...overrides
    } as MockChannel
  }

  function buildCharacter(overrides: Record<string, unknown> = {}) {
    return {
      characterId: 'char-1',
      characterName: 'アリス',
      discordUserId: 'user-1',
      discordChannelId: undefined,
      ...overrides
    } as never
  }

  beforeEach(async () => {
    typedEventService = {
      emit: jest.fn().mockResolvedValue(undefined),
      // 既定では update.completed（character フィールドあり）を返す
      waitForEvent: jest.fn().mockResolvedValue({ character: { characterId: 'char-1' } })
    }

    const moduleRef = await Test.createTestingModule({
      providers: [ChannelNameSyncService, { provide: TypedEventService, useValue: typedEventService }]
    }).compile()

    service = moduleRef.get(ChannelNameSyncService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('syncChannelNameToCharacter', () => {
    it('チャンネル名が既にサニタイズ後の名前と一致するなら setName せず true を返す', async () => {
      // Arrange: 'アリス' はサニタイズしても 'アリス'（日本語は許可）
      const channel = buildChannel('アリス')
      const character = buildCharacter()

      // Act
      const result = await service.syncChannelNameToCharacter(channel as never, character)

      // Assert
      expect(result).toBe(true)
      expect(channel.setName).not.toHaveBeenCalled()
      expect(typedEventService.emit).not.toHaveBeenCalled()
    })

    it('名前が異なる場合は setName を呼び、サニタイズ済みの名前を渡す', async () => {
      // Arrange: スペースはハイフンに、大文字は小文字へ
      const channel = buildChannel('old-name')
      const character = buildCharacter({ characterName: 'Hero Name' })

      // Act
      const result = await service.syncChannelNameToCharacter(channel as never, character)

      // Assert
      expect(result).toBe(true)
      expect(channel.setName).toHaveBeenCalledWith('hero-name', expect.stringContaining('Hero Name'))
    })

    it('2文字未満の名前は character- 接頭辞で補完される', async () => {
      // Arrange: 'A' → 小文字 'a' → 1文字 → 'character-a'
      const channel = buildChannel('old')
      const character = buildCharacter({ characterName: 'A' })

      // Act
      await service.syncChannelNameToCharacter(channel as never, character)

      // Assert
      expect(channel.setName).toHaveBeenCalledWith('character-a', expect.any(String))
    })

    it('無効文字（記号）はサニタイズで除去される', async () => {
      // Arrange: '!!ab@@' → 無効文字除去 → 'ab'
      const channel = buildChannel('old')
      const character = buildCharacter({ characterName: '!!ab@@' })

      // Act
      await service.syncChannelNameToCharacter(channel as never, character)

      // Assert
      expect(channel.setName).toHaveBeenCalledWith('ab', expect.any(String))
    })

    it('discordChannelId が既に一致する場合は更新イベントを emit しない', async () => {
      // Arrange
      const channel = buildChannel('old')
      const character = buildCharacter({ characterName: 'Hero Name', discordChannelId: 'ch-1' })

      // Act
      const result = await service.syncChannelNameToCharacter(channel as never, character)

      // Assert: setName は実行されるが、DB 更新イベントは発火しない
      expect(channel.setName).toHaveBeenCalled()
      expect(typedEventService.emit).not.toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('discordChannelId が未設定なら character.update.requested を emit し完了を待つ', async () => {
      // Arrange
      const channel = buildChannel('old')
      const character = buildCharacter({ characterName: 'Hero Name' })

      // Act
      await service.syncChannelNameToCharacter(channel as never, character)

      // Assert
      expect(typedEventService.emit).toHaveBeenCalledWith(
        'character.update.requested',
        expect.objectContaining({
          updateData: { discordChannelId: 'ch-1' },
          source: 'channel-name-sync'
        })
      )
      expect(typedEventService.waitForEvent).toHaveBeenCalled()
    })

    it('setName が例外を投げたら ErrorHandler.handleServiceError に委譲し false を返す', async () => {
      // Arrange
      const channel = buildChannel('old', { setName: jest.fn().mockRejectedValue(new Error('rename failed')) })
      const character = buildCharacter({ characterName: 'Hero Name' })

      // Act
      const result = await service.syncChannelNameToCharacter(channel as never, character)

      // Assert
      expect(result).toBe(false)
      expect(mockedErrorHandler.handleServiceError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ channelId: 'ch-1', characterId: 'char-1' }),
        'ChannelNameSyncService.syncChannelNameToCharacter'
      )
    })

    it('更新結果に character が無い（update.failed）場合でも true を返す（現挙動）', async () => {
      // Arrange: waitForEvent が character を含まない（=失敗イベント）を返す
      typedEventService.waitForEvent.mockResolvedValue({ error: 'update failed' } as never)
      const channel = buildChannel('old')
      const character = buildCharacter({ characterName: 'Hero Name' })

      // Act: updateCharacterChannelInfo は false を返すが syncChannelName 本体は true を返す
      const result = await service.syncChannelNameToCharacter(channel as never, character)

      // Assert
      expect(result).toBe(true)
    })
  })
})
