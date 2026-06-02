import { Controller, Get, Post, Query, UseGuards, Logger, HttpException, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../domains/auth/guards/jwt-auth.guard'
import { PerformanceOrchestratorService } from '../services/monitoring/performance-orchestrator.service'
import { AppConfigService } from '../../config/config.service'

/**
 * パフォーマンスダッシュボードコントローラー
 * システム監視とメトリクスダッシュボード用のAPIを提供
 */
@Controller('discord/performance')
@ApiTags('Performance Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PerformanceDashboardController {
  private readonly logger = new Logger(PerformanceDashboardController.name)

  constructor(
    private readonly performanceOrchestrator: PerformanceOrchestratorService,
    private readonly appConfigService: AppConfigService
  ) {}

  /**
   * 総合パフォーマンス統計を取得
   */
  @Get('stats')
  @ApiOperation({ summary: '総合パフォーマンス統計を取得' })
  @ApiResponse({ status: 200, description: 'パフォーマンス統計取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async getPerformanceStats(): Promise<{
    system: {
      discord: any
      http: any
      database: any
    }
    discord: {
      global: {
        uptime: number
        totalCalls: number
        totalErrors: number
        avgResponseTime: number
        errorRate: number
      }
      endpoints: Array<{
        endpoint: string
        count: number
        avgResponseTime: number
        errorRate: number
        lastCall: number
      }>
      alerts: string[]
    }
    trends: {
      hourly: Array<[string, any]>
      daily: Array<[string, any]>
    }
    health: {
      status: 'healthy' | 'warning' | 'critical'
      issues: string[]
      metrics: {
        avgResponseTime: number
        errorRate: number
        activeAlerts: number
      }
    }
    memory: NodeJS.MemoryUsage
    uptime: number
  }> {
    try {
      this.logger.log('パフォーマンス統計取得要求')
      const stats = this.performanceOrchestrator.getPerformanceSummary()
      this.logger.log('パフォーマンス統計取得完了')
      return stats
    } catch (error) {
      this.logger.error('パフォーマンス統計取得エラー:', error)
      throw new HttpException('パフォーマンス統計の取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * ヘルス状態を取得
   */
  @Get('health')
  @ApiOperation({ summary: 'システムヘルス状態を取得' })
  @ApiResponse({ status: 200, description: 'ヘルス状態取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    metrics: {
      avgResponseTime: number
      errorRate: number
      activeAlerts: number
    }
    timestamp: number
    services: {
      discord: {
        status: string
        issues: string[]
      }
    }
  }> {
    try {
      this.logger.log('ヘルス状態取得要求')

      const discordHealth = this.performanceOrchestrator.getSystemHealth()
      const timestamp = Date.now()

      // 全体のヘルス状態を判定
      let overallStatus: 'healthy' | 'warning' | 'critical' = discordHealth.status
      const allIssues = [...discordHealth.issues]

      // メモリ使用量チェック
      const memUsage = process.memoryUsage()
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024)

      if (heapUsedMB > 800) {
        allIssues.push(`High memory usage: ${heapUsedMB}MB`)
        overallStatus = overallStatus === 'healthy' ? 'warning' : overallStatus
      }

      if (heapUsedMB > 1200) {
        overallStatus = 'critical'
      }

      const result = {
        status: overallStatus,
        issues: allIssues,
        metrics: {
          avgResponseTime: discordHealth.metrics.discord.avgResponseTime || 0,
          errorRate: discordHealth.metrics.discord.errorRate || 0,
          activeAlerts: discordHealth.metrics.alerts.active || 0
        },
        timestamp,
        services: {
          discord: {
            status: discordHealth.status,
            issues: discordHealth.issues
          }
        }
      }

      this.logger.log(`ヘルス状態取得完了: ${overallStatus}`)
      return result
    } catch (error) {
      this.logger.error('ヘルス状態取得エラー:', error)
      throw new HttpException('ヘルス状態の取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * Discord特有の統計を取得
   */
  @Get('discord')
  @ApiOperation({ summary: 'Discord固有のパフォーマンス統計を取得' })
  @ApiResponse({ status: 200, description: 'Discord統計取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async getDiscordStats(): Promise<{
    global: {
      uptime: number
      totalCalls: number
      totalErrors: number
      avgResponseTime: number
      errorRate: number
    }
    endpoints: Array<{
      endpoint: string
      count: number
      avgResponseTime: number
      errorRate: number
      lastCall: number
    }>
    alerts: string[]
    rateLimit: any
  }> {
    try {
      this.logger.log('Discord統計取得要求')
      const stats = this.performanceOrchestrator.getPerformanceSummary().discord

      const result = {
        ...stats,
        rateLimit: {
          // レート制限情報は別途実装が必要
          status: 'normal',
          remaining: null,
          resetTime: null
        }
      }

      this.logger.log('Discord統計取得完了')
      return result
    } catch (error) {
      this.logger.error('Discord統計取得エラー:', error)
      throw new HttpException('Discord統計の取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * 時系列メトリクス取得
   */
  @Get('metrics/timeseries')
  @ApiOperation({ summary: '時系列パフォーマンスメトリクスを取得' })
  @ApiQuery({ name: 'period', enum: ['1h', '6h', '24h', '7d'], description: '取得期間', required: false })
  @ApiQuery({
    name: 'metric',
    enum: ['response_time', 'error_rate', 'throughput'],
    description: 'メトリクス種別',
    required: false
  })
  @ApiResponse({ status: 200, description: '時系列メトリクス取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async getTimeSeriesMetrics(
    @Query('period') period: '1h' | '6h' | '24h' | '7d' = '24h',
    @Query('metric') metric: 'response_time' | 'error_rate' | 'throughput' = 'response_time'
  ): Promise<{
    period: string
    metric: string
    data: Array<{
      timestamp: number
      value: number
      label: string
    }>
    summary: {
      min: number
      max: number
      avg: number
      total?: number
    }
  }> {
    try {
      this.logger.log(`時系列メトリクス取得要求: period=${period}, metric=${metric}`)

      const stats = this.performanceOrchestrator.getPerformanceSummary()
      const data: Array<{ timestamp: number; value: number; label: string }> = []

      // 期間に応じてデータソースを選択
      const sourceData = period === '7d' ? stats.trends.daily : stats.trends.hourly
      const periodCount = period === '1h' ? 1 : period === '6h' ? 6 : period === '24h' ? 24 : 7

      // 最新のN期間分のデータを取得
      const recentData = sourceData.slice(-periodCount)

      // メトリクス種別に応じてデータを変換
      let min = Number.MAX_VALUE
      let max = Number.MIN_VALUE
      let sum = 0
      let count = 0

      for (const [timeLabel, periodData] of recentData) {
        let value = 0

        switch (metric) {
          case 'response_time':
            value =
              periodData.discord?.totalResponseTime && periodData.discord?.commandsExecuted > 0
                ? periodData.discord.totalResponseTime / periodData.discord.commandsExecuted
                : 0
            break
          case 'error_rate': {
            const totalOps =
              (periodData.discord?.commandsExecuted || 0) +
              (periodData.http?.requests || 0) +
              (periodData.database?.queries || 0)
            const totalErrors =
              (periodData.discord?.errors || 0) + (periodData.http?.errors || 0) + (periodData.database?.errors || 0)
            value = totalOps > 0 ? (totalErrors / totalOps) * 100 : 0
            break
          }
          case 'throughput':
            value =
              (periodData.discord?.commandsExecuted || 0) +
              (periodData.http?.requests || 0) +
              (periodData.database?.queries || 0)
            break
        }

        data.push({
          timestamp: periodData.timestamp,
          value: Math.round(value * 100) / 100,
          label: timeLabel
        })

        min = Math.min(min, value)
        max = Math.max(max, value)
        sum += value
        count++
      }

      const result = {
        period,
        metric,
        data,
        summary: {
          min: count > 0 ? Math.round(min * 100) / 100 : 0,
          max: count > 0 ? Math.round(max * 100) / 100 : 0,
          avg: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
          ...(metric === 'throughput' && { total: Math.round(sum) })
        }
      }

      this.logger.log(`時系列メトリクス取得完了: ${data.length}件`)
      return result
    } catch (error) {
      this.logger.error('時系列メトリクス取得エラー:', error)
      throw new HttpException('時系列メトリクスの取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * アラート一覧を取得
   */
  @Get('alerts')
  @ApiOperation({ summary: 'アクティブなアラート一覧を取得' })
  @ApiResponse({ status: 200, description: 'アラート一覧取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async getActiveAlerts(): Promise<{
    activeAlerts: string[]
    alertCount: number
    criticalCount: number
    warningCount: number
    lastUpdate: number
  }> {
    try {
      this.logger.log('アクティブアラート取得要求')

      const discordStats = this.performanceOrchestrator.getPerformanceSummary().discord
      const healthStatus = this.performanceOrchestrator.getSystemHealth()

      // アラートの重要度分類（簡易実装）
      const criticalAlerts = discordStats.alerts.filter(
        (alert: string) =>
          alert.includes('critical') || alert.includes('rate-limited') || alert.includes('consecutive-errors')
      )
      const warningAlerts = discordStats.alerts.filter((alert: string) => !criticalAlerts.includes(alert))

      const result = {
        activeAlerts: discordStats.alerts,
        alertCount: discordStats.alerts.length,
        criticalCount: criticalAlerts.length,
        warningCount: warningAlerts.length,
        lastUpdate: Date.now()
      }

      this.logger.log(`アクティブアラート取得完了: ${result.alertCount}件`)
      return result
    } catch (error) {
      this.logger.error('アクティブアラート取得エラー:', error)
      throw new HttpException('アクティブアラートの取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * メトリクスリセット
   */
  @Post('reset')
  @ApiOperation({ summary: 'パフォーマンスメトリクスをリセット' })
  @ApiResponse({ status: 200, description: 'メトリクスリセット成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async resetMetrics(): Promise<{ success: boolean; message: string; timestamp: number }> {
    try {
      this.logger.log('メトリクスリセット要求')

      this.performanceOrchestrator.resetMonitoring()

      const result = {
        success: true,
        message: 'All performance metrics have been reset successfully',
        timestamp: Date.now()
      }

      this.logger.log('メトリクスリセット完了')
      return result
    } catch (error) {
      this.logger.error('メトリクスリセットエラー:', error)
      throw new HttpException('メトリクスリセット中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  /**
   * システム情報取得
   */
  @Get('system-info')
  @ApiOperation({ summary: 'システム情報を取得' })
  @ApiResponse({ status: 200, description: 'システム情報取得成功' })
  @ApiResponse({ status: 401, description: '認証エラー' })
  async getSystemInfo(): Promise<{
    node: {
      version: string
      platform: string
      arch: string
      uptime: number
    }
    process: {
      pid: number
      uptime: number
      memory: NodeJS.MemoryUsage
      cpu: NodeJS.CpuUsage
    }
    environment: {
      nodeEnv: string
      timezone: string
      locale: string
    }
  }> {
    try {
      this.logger.log('システム情報取得要求')

      const result = {
        node: {
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: Math.round(process.uptime())
        },
        process: {
          pid: process.pid,
          uptime: Math.round(process.uptime()),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        },
        environment: {
          nodeEnv: this.appConfigService.get('app.environment'),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: Intl.DateTimeFormat().resolvedOptions().locale
        }
      }

      this.logger.log('システム情報取得完了')
      return result
    } catch (error) {
      this.logger.error('システム情報取得エラー:', error)
      throw new HttpException('システム情報の取得中にエラーが発生しました', HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }
}
