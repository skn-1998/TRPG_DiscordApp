import { Test } from '@nestjs/testing'
import { ChannelCacheService, CHANNEL_CACHE_AUTO_START_CLEANUP } from './channel-cache.service'
import { AppConfigService } from '../../../config/config.service'
import { ErrorHandler } from '../../../core/http/error-handler'

/**
 * characterization（特性化）テスト
 *
 * テスタビリティ改善リファクタの「手順0」。現挙動を固定し、構造変更後も同じテストが
 * 緑であることで挙動不変を証明する安全網。
 *
 * 注意: 現行実装はコンストラクタで setInterval を起動するため、テストでは fake timers を
 * 使ってタイマーを制御する（リファクタ後はこの依存自体が seam 化されて不要になる想定）。
 */
describe('ChannelCacheService (characterization)', () => {
  const CACHE_TTL = 300_000 // 5分
  const MESSAGE_CACHE_LIMIT = 3
  const MAX_CHANNEL_CACHE = 2

  let service: ChannelCacheService

  const buildConfig = () => ({
    get: jest.fn((key: string) => {
      switch (key) {
        case 'discord.cacheTtl':
          return CACHE_TTL
        case 'discord.messageCacheLimit':
          return MESSAGE_CACHE_LIMIT
        case 'discord.channelCacheLimit':
          return MAX_CHANNEL_CACHE
        default:
          return undefined
      }
    })
  })

  const makeTextChannel = (id: string) =>
    ({
      id,
      isTextBased: () => true
    }) as never

  const makeClient = (channel: unknown) =>
    ({
      channels: {
        fetch: jest.fn().mockResolvedValue(channel)
      }
    }) as never

  beforeEach(async () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2025-01-01T00:00:00.000Z'))

    // 既定では常駐タイマーを起動しない（unit test の安定化）。
    // タイマー駆動の検証だけ別途 autoStart=true の module を作る。
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChannelCacheService,
        { provide: AppConfigService, useValue: buildConfig() },
        { provide: CHANNEL_CACHE_AUTO_START_CLEANUP, useValue: false }
      ]
    }).compile()

    service = moduleRef.get(ChannelCacheService)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('getChannel', () => {
    it('TTL 内のキャッシュヒット時は fetch せずキャッシュを返し lastAccess を更新する', async () => {
      // Arrange: 1 回目の fetch でキャッシュに乗せる
      const channel = makeTextChannel('ch1')
      const client = makeClient(channel)
      await service.getChannel(client, 'ch1')
      const fetchMock = (client as { channels: { fetch: jest.Mock } }).channels.fetch
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // Act: TTL 内に再取得
      jest.advanceTimersByTime(1000)
      const result = await service.getChannel(client, 'ch1')

      // Assert: fetch されず、キャッシュから返る
      expect(result).toBe(channel)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('未キャッシュ時は fetch し、text-based なら格納して返す', async () => {
      // Arrange
      const channel = makeTextChannel('ch2')
      const client = makeClient(channel)

      // Act
      const result = await service.getChannel(client, 'ch2')

      // Assert
      expect(result).toBe(channel)
      expect(service.getCacheStats().channelCacheSize).toBe(1)
    })

    it('text-based でないチャンネルは null を返しキャッシュしない', async () => {
      // Arrange
      const nonText = { id: 'ch3', isTextBased: () => false } as never
      const client = makeClient(nonText)

      // Act
      const result = await service.getChannel(client, 'ch3')

      // Assert
      expect(result).toBeNull()
      expect(service.getCacheStats().channelCacheSize).toBe(0)
    })

    it('null チャンネル（fetch 結果が null）は null を返す', async () => {
      // Arrange
      const client = makeClient(null)

      // Act
      const result = await service.getChannel(client, 'missing')

      // Assert
      expect(result).toBeNull()
    })

    it('TTL 超過時は再 fetch する', async () => {
      // Arrange
      const channel = makeTextChannel('ch4')
      const client = makeClient(channel)
      await service.getChannel(client, 'ch4')
      const fetchMock = (client as { channels: { fetch: jest.Mock } }).channels.fetch

      // Act: TTL を超えて経過
      jest.advanceTimersByTime(CACHE_TTL + 1)
      await service.getChannel(client, 'ch4')

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('fetch が例外を投げた場合は ErrorHandler 経由で握り、現状はスローされる', async () => {
      // Arrange: ErrorHandler.handleServiceError は HttpException を再スローする実装
      const client = {
        channels: { fetch: jest.fn().mockRejectedValue(new Error('boom')) }
      } as never
      const spy = jest.spyOn(ErrorHandler, 'handleServiceError')

      // Act & Assert: 現挙動として例外が伝播する
      await expect(service.getChannel(client, 'errch')).rejects.toBeDefined()
      expect(spy).toHaveBeenCalledTimes(1)
      spy.mockRestore()
    })
  })

  describe('LRU eviction (MAX_CHANNEL_CACHE 超過)', () => {
    it('上限超過時は最古エントリを evict してから追加する', async () => {
      // Arrange: MAX_CHANNEL_CACHE=2。3 件投入し最古が消えることを確認
      const mkClient = (id: string) => makeClient(makeTextChannel(id))

      // Act
      await service.getChannel(mkClient('a'), 'a')
      jest.advanceTimersByTime(10)
      await service.getChannel(mkClient('b'), 'b')
      jest.advanceTimersByTime(10)
      await service.getChannel(mkClient('c'), 'c')

      // Assert: 最古の 'a' が消え、サイズは上限のまま
      expect(service.getCacheStats().channelCacheSize).toBe(2)
      expect(await service.getMessageFromCache('a', 'x')).toBeNull()
    })
  })

  describe('message cache', () => {
    it('addMessageToCache / getMessageFromCache / removeMessageFromCache の往復', async () => {
      // Arrange
      await service.getChannel(makeClient(makeTextChannel('mc')), 'mc')
      const message = { id: 'm1' } as never

      // Act
      service.addMessageToCache('mc', message)

      // Assert
      expect(await service.getMessageFromCache('mc', 'm1')).toBe(message)

      // Act: 削除
      service.removeMessageFromCache('mc', 'm1')
      expect(await service.getMessageFromCache('mc', 'm1')).toBeNull()
    })

    it('未キャッシュチャンネルへの addMessageToCache は無視される', () => {
      // Act & Assert
      service.addMessageToCache('nochan', { id: 'm' } as never)
      expect(service.getCacheStats().totalMessagesCached).toBe(0)
    })

    it('MESSAGE_CACHE_LIMIT 超過時は最古メッセージを削除する', async () => {
      // Arrange
      await service.getChannel(makeClient(makeTextChannel('lim')), 'lim')

      // Act: limit=3 を超えて 4 件追加
      service.addMessageToCache('lim', { id: 'm1' } as never)
      service.addMessageToCache('lim', { id: 'm2' } as never)
      service.addMessageToCache('lim', { id: 'm3' } as never)
      service.addMessageToCache('lim', { id: 'm4' } as never)

      // Assert: 最古 m1 が消え、size は limit
      expect(service.getCacheStats().totalMessagesCached).toBe(3)
      expect(await service.getMessageFromCache('lim', 'm1')).toBeNull()
      expect(await service.getMessageFromCache('lim', 'm4')).not.toBeNull()
    })
  })

  describe('getCacheStats', () => {
    it('空キャッシュの集計値', () => {
      // Act
      const stats = service.getCacheStats()

      // Assert
      expect(stats).toEqual({
        channelCacheSize: 0,
        totalMessagesCached: 0,
        oldestCacheEntry: null,
        newestCacheEntry: null,
        memoryUsageEstimate: 0
      })
    })

    it('エントリありの集計値（memoryUsageEstimate = channels*2 + messages*1）', async () => {
      // Arrange: 2 チャンネル、合計 1 メッセージ
      await service.getChannel(makeClient(makeTextChannel('s1')), 's1')
      jest.advanceTimersByTime(100)
      await service.getChannel(makeClient(makeTextChannel('s2')), 's2')
      service.addMessageToCache('s2', { id: 'mm' } as never)

      // Act
      const stats = service.getCacheStats()

      // Assert
      expect(stats.channelCacheSize).toBe(2)
      expect(stats.totalMessagesCached).toBe(1)
      expect(stats.memoryUsageEstimate).toBe(2 * 2 + 1 * 1)
      expect(stats.oldestCacheEntry).not.toBeNull()
      expect(stats.newestCacheEntry).not.toBeNull()
      expect(stats.oldestCacheEntry! <= stats.newestCacheEntry!).toBe(true)
    })
  })

  describe('performMaintenance / clearCache / evictChannelCache', () => {
    it('performMaintenance は期限切れエントリを削除する', async () => {
      // Arrange
      await service.getChannel(makeClient(makeTextChannel('old')), 'old')

      // Act: TTL を超過させてメンテナンス
      jest.advanceTimersByTime(CACHE_TTL + 1)
      await service.performMaintenance()

      // Assert
      expect(service.getCacheStats().channelCacheSize).toBe(0)
    })

    it('clearCache は全エントリを削除する', async () => {
      // Arrange
      await service.getChannel(makeClient(makeTextChannel('x')), 'x')

      // Act
      service.clearCache()

      // Assert
      expect(service.getCacheStats().channelCacheSize).toBe(0)
    })

    it('evictChannelCache は指定チャンネルのみ削除する', async () => {
      // Arrange
      await service.getChannel(makeClient(makeTextChannel('keep')), 'keep')
      await service.getChannel(makeClient(makeTextChannel('drop')), 'drop')

      // Act
      service.evictChannelCache('drop')

      // Assert
      expect(service.getCacheStats().channelCacheSize).toBe(1)
      expect(await service.getMessageFromCache('keep', 'z')).toBeNull() // 存在はする
      expect(await service.getMessageFromCache('drop', 'z')).toBeNull()
    })
  })

  describe('extractTimestampFromSnowflake', () => {
    it('既知の snowflake から Discord epoch 起点のミリ秒を算出する', () => {
      // Arrange: (snowflake >> 22) + 1420070400000
      // snowflake = 175928847299117063 → 1462015105796
      // Act
      const ts = service.extractTimestampFromSnowflake('175928847299117063')

      // Assert
      expect(ts).toBe(1462015105796)
    })

    it('snowflake = 0 は Discord epoch(1420070400000) を返す', () => {
      // Act & Assert
      expect(service.extractTimestampFromSnowflake('0')).toBe(1420070400000)
    })

    it('不正な snowflake は now（Date.now）にフォールバックする', () => {
      // Arrange: fake timer の現在時刻
      const now = Date.now()

      // Act
      const ts = service.extractTimestampFromSnowflake('not-a-number')

      // Assert
      expect(ts).toBe(now)
    })
  })

  describe('cleanupExpiredCache via timer (本番タイマー挙動)', () => {
    it('onModuleInit で起動した setInterval によりクリーンアップが定期実行され、期限切れのみ削除される', async () => {
      // Arrange: 本番同等に autoStart=true（既定）。onModuleInit を発火し setInterval を起動。
      const moduleRef = await Test.createTestingModule({
        providers: [ChannelCacheService, { provide: AppConfigService, useValue: buildConfig() }]
      }).compile()
      const timerService = moduleRef.get(ChannelCacheService)
      timerService.onModuleInit() // 本番のライフサイクルフック経路でタイマー起動

      await timerService.getChannel(makeClient(makeTextChannel('t1')), 't1')

      // Act: TTL 超過後、タイマー間隔（min(TTL/2,60000)=60000）を進める
      jest.advanceTimersByTime(CACHE_TTL + 1)
      jest.advanceTimersByTime(60_000)

      // Assert: タイマー駆動のクリーンアップで削除される
      expect(timerService.getCacheStats().channelCacheSize).toBe(0)

      // Cleanup: onModuleDestroy でタイマー停止
      timerService.onModuleDestroy()
    })
  })
})
