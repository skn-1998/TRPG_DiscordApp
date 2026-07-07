import { Logger } from '@nestjs/common'
import { DiscordMonitorService } from './discord-monitor.service'

/**
 * DiscordMonitorService は discord.js 非依存。API 呼び出しメトリクスの集計・
 * しきい値アラート・ヘルス判定・統計リセットを担う。
 * C-3b′（2026-07-07）: dead emit（discord.memory.status / discord.performance.alert）と
 * EventEmitter2 注入の撤去に伴い、emit ベースの検証はアラート状態（getStats().alerts）と
 * ログ出力ベースへ置き換えた。
 *
 * 経過時間・lastCall は Date.now()/setTimeout 依存のため jest.useFakeTimers() で決定化する。
 * private(endApiCall/checkThresholds 等)は覗かず、公開 API(startApiCall().end・getStats 等)の
 * 振る舞いで検証する。
 */
describe('DiscordMonitorService', () => {
  let service: DiscordMonitorService

  const FIXED_NOW = 1_700_000_000_000

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(FIXED_NOW)

    service = new DiscordMonitorService()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  describe('startApiCall / API 呼び出しメトリクス集計', () => {
    it('成功した呼び出しの count/avgResponseTime/errorRate を集計する', () => {
      // Arrange
      const call = service.startApiCall('/channels', 'GET')

      // Act: 100ms 経過して成功終了
      jest.setSystemTime(FIXED_NOW + 100)
      call.end(true)

      // Assert
      const stats = service.getStats()
      expect(stats.global.totalCalls).toBe(1)
      expect(stats.global.totalErrors).toBe(0)
      expect(stats.global.avgResponseTime).toBe(100)
      expect(stats.global.errorRate).toBe(0)

      const endpoint = stats.endpoints.find((e) => e.endpoint === 'GET:/channels')
      expect(endpoint).toBeDefined()
      expect(endpoint!.count).toBe(1)
      expect(endpoint!.avgResponseTime).toBe(100)
      expect(endpoint!.lastCall).toBe(FIXED_NOW + 100)
    })

    it('method 省略時は GET をキーに使う', () => {
      // Act
      const call = service.startApiCall('/users')
      call.end(true)

      // Assert
      const stats = service.getStats()
      expect(stats.endpoints[0].endpoint).toBe('GET:/users')
    })

    it('失敗した呼び出しは errors と errorRate に反映される', () => {
      // Act: 同一エンドポイントを2回(成功1・失敗1)
      service.startApiCall('/m', 'POST').end(true)
      service.startApiCall('/m', 'POST').end(false)

      // Assert
      const stats = service.getStats()
      expect(stats.global.totalCalls).toBe(2)
      expect(stats.global.totalErrors).toBe(1)
      expect(stats.global.errorRate).toBe(0.5)
      const endpoint = stats.endpoints.find((e) => e.endpoint === 'POST:/m')
      expect(endpoint!.errorRate).toBe(0.5)
    })

    it('endpoints は呼び出し回数の降順で返す', () => {
      // Arrange: A を2回、B を1回
      service.startApiCall('/a', 'GET').end(true)
      service.startApiCall('/a', 'GET').end(true)
      service.startApiCall('/b', 'GET').end(true)

      // Act
      const stats = service.getStats()

      // Assert
      expect(stats.endpoints.map((e) => e.endpoint)).toEqual(['GET:/a', 'GET:/b'])
    })
  })

  describe('checkThresholds (しきい値アラート)', () => {
    it('応答時間がしきい値(1000ms)を超えると performance アラート状態を記録する', () => {
      // Act: 1500ms かかる呼び出し
      const call = service.startApiCall('/slow', 'GET')
      jest.setSystemTime(FIXED_NOW + 1500)
      call.end(true)

      // Assert
      expect(service.getStats().alerts).toContain('GET:/slow-performance')
    })

    it('同一エンドポイントの応答時間アラートはクールダウン中は重複発火しない', () => {
      // Arrange: 1回目で slow-response アラート（エラーログ）
      const errorSpy = jest.spyOn(Logger.prototype, 'error')
      const first = service.startApiCall('/slow', 'GET')
      jest.setSystemTime(FIXED_NOW + 1500)
      first.end(true)
      const firstCount = errorSpy.mock.calls.filter((c) => String(c[0]).startsWith('Performance alert:')).length

      // Act: 2回目も遅いがクールダウン未経過
      const second = service.startApiCall('/slow', 'GET')
      jest.setSystemTime(FIXED_NOW + 1500 + 1500)
      second.end(true)

      // Assert: slow-response アラート（エラーログ）は増えず、アラート状態も1件のまま
      const afterCount = errorSpy.mock.calls.filter((c) => String(c[0]).startsWith('Performance alert:')).length
      expect(afterCount).toBe(firstCount)
      expect(service.getStats().alerts).toEqual(['GET:/slow-performance'])
    })

    it('statusCode 429 の場合は rate limit ログを出力する', () => {
      // Arrange
      const errorSpy = jest.spyOn(Logger.prototype, 'error')

      // Act
      const call = service.startApiCall('/limited', 'GET')
      call.end(false, 429)

      // Assert
      expect(errorSpy).toHaveBeenCalledWith('Rate limit hit: GET:/limited')
    })

    it('しきい値内の高速・成功呼び出しではアラート状態を記録しない', () => {
      // Act
      const call = service.startApiCall('/fast', 'GET')
      jest.setSystemTime(FIXED_NOW + 50)
      call.end(true)

      // Assert
      expect(service.getStats().alerts).toEqual([])
    })
  })

  // C-3b: recordRateLimit は孤児化により実装ごと撤去（describe も削除）

  describe('recordMemoryUsage', () => {
    // C-3b′（2026-07-07）: 'discord.memory.status' の emit は dead emit のため撤去。
    // 残る観測可能な挙動は高メモリ時の警告ログのみ（MB への丸めはログ文言で固定）。
    it('ヒープ使用量が 500MB を超えると丸めた MB 値で警告ログを出す', () => {
      // Arrange
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 700 * 1024 * 1024,
        heapTotal: 650 * 1024 * 1024,
        heapUsed: Math.round(600.4 * 1024 * 1024),
        external: 5 * 1024 * 1024,
        arrayBuffers: 0
      } as NodeJS.MemoryUsage)

      // Act
      service.recordMemoryUsage()

      // Assert
      expect(warnSpy).toHaveBeenCalledWith('High memory usage: 600MB heap used')
    })

    it('ヒープ使用量がしきい値以下なら警告ログを出さない', () => {
      // Arrange
      const warnSpy = jest.spyOn(Logger.prototype, 'warn')
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 100 * 1024 * 1024,
        heapTotal: 80 * 1024 * 1024,
        heapUsed: 40 * 1024 * 1024,
        external: 5 * 1024 * 1024,
        arrayBuffers: 0
      } as NodeJS.MemoryUsage)

      // Act
      service.recordMemoryUsage()

      // Assert
      expect(warnSpy).not.toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('呼び出しが無い場合は uptime と 0 初期値を返す', () => {
      // Act: 構築から 5000ms 経過
      jest.setSystemTime(FIXED_NOW + 5000)
      const stats = service.getStats()

      // Assert
      expect(stats.global.uptime).toBe(5000)
      expect(stats.global.totalCalls).toBe(0)
      expect(stats.global.avgResponseTime).toBe(0)
      expect(stats.global.errorRate).toBe(0)
      expect(stats.endpoints).toEqual([])
      expect(stats.alerts).toEqual([])
    })
  })

  describe('getHealthStatus', () => {
    it('問題が無ければ healthy を返す', () => {
      // Act
      const health = service.getHealthStatus()

      // Assert
      expect(health.status).toBe('healthy')
      expect(health.issues).toEqual([])
      expect(health.metrics.activeAlerts).toBe(0)
    })

    it('平均応答時間がしきい値を超えると warning となり issue が積まれる', () => {
      // Arrange: 1500ms の遅い成功呼び出し
      const call = service.startApiCall('/slow', 'GET')
      jest.setSystemTime(FIXED_NOW + 1500)
      call.end(true)

      // Act
      const health = service.getHealthStatus()

      // Assert
      expect(health.status).toBe('warning')
      expect(health.issues.some((i) => i.includes('Average response time is high'))).toBe(true)
    })

    it('エラー率がしきい値を超えると issue に高エラー率が積まれる', () => {
      // Arrange: 高速だが失敗する呼び出し(errorRate=1.0 > 0.05)
      const call = service.startApiCall('/err', 'GET')
      jest.setSystemTime(FIXED_NOW + 10)
      call.end(false)

      // Act
      const health = service.getHealthStatus()

      // Assert
      expect(health.issues.some((i) => i.includes('Error rate is high'))).toBe(true)
    })
  })

  describe('reset', () => {
    it('集計・アラート・startTime をクリアする', () => {
      // Arrange: 遅い失敗呼び出しでメトリクスとアラートを発生させる
      const call = service.startApiCall('/x', 'GET')
      jest.setSystemTime(FIXED_NOW + 1500)
      call.end(false)
      expect(service.getStats().global.totalCalls).toBe(1)

      // Act: 時刻を進めてリセット
      jest.setSystemTime(FIXED_NOW + 9000)
      service.reset()

      // Assert
      const stats = service.getStats()
      expect(stats.global.totalCalls).toBe(0)
      expect(stats.global.totalErrors).toBe(0)
      expect(stats.endpoints).toEqual([])
      expect(stats.alerts).toEqual([])
      expect(stats.global.uptime).toBe(0) // startTime が現在時刻に更新される
    })
  })

  describe('performMaintenance', () => {
    it('1時間以上前の古いメトリクスを削除する', () => {
      // Arrange: 古い呼び出しを1件記録
      service.startApiCall('/old', 'GET').end(true)
      expect(service.getStats().endpoints).toHaveLength(1)

      // process.memoryUsage は performMaintenance 内で呼ばれるためモックしておく
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0
      } as NodeJS.MemoryUsage)

      // Act: 1時間と1ms 進めてメンテナンス実行
      jest.setSystemTime(FIXED_NOW + 3600000 + 1)
      service.performMaintenance()

      // Assert: 古いエンドポイントが削除される
      expect(service.getStats().endpoints).toEqual([])
    })

    it('新しいメトリクスは保持する', () => {
      // Arrange
      service.startApiCall('/recent', 'GET').end(true)
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 0,
        heapTotal: 0,
        heapUsed: 0,
        external: 0,
        arrayBuffers: 0
      } as NodeJS.MemoryUsage)

      // Act
      service.performMaintenance()

      // Assert: メトリクスは残る
      expect(service.getStats().endpoints).toHaveLength(1)
    })
  })
})
