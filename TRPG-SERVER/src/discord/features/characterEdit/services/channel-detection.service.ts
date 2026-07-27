import { Injectable, Logger } from '@nestjs/common'
import { AuditLogEvent, TextChannel } from 'discord.js'
import { getChannelIdByName } from '../../../utils/searchChannelID'
import { AppConfigService } from 'src/config/config.service'

// Lifecycle: 60 秒は audit log fetch 等、リスナー内 REST 往復の処理遅延を吸収する安全余裕。
// 状態はプロセス内 Map のためマルチレプリカでは成立せず、照合は非消費型、再マークで TTL を延長する。
const BOT_MANAGED_CHANNEL_SUPPRESSION_TTL_MS = 60_000

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ChannelCreationContext {
  channel: TextChannel
  categoryId: string
  creatorId: string | null
}

export interface ChannelCreationResult {
  success: boolean
  shouldCreateCharacter: boolean
  context?: ChannelCreationContext
  error?: string
}

// ============================================================================
// Channel Detection Service
// ============================================================================

@Injectable()
export class ChannelDetectionService {
  private readonly logger = new Logger(ChannelDetectionService.name)
  private readonly botManagedChannelCleanupTimers = new Map<string, NodeJS.Timeout>()

  constructor(private readonly appConfigService: AppConfigService) {}

  markBotManagedChannel(channelId: string): void {
    const previousCleanupTimer = this.botManagedChannelCleanupTimers.get(channelId)
    if (previousCleanupTimer) {
      clearTimeout(previousCleanupTimer)
    }

    const cleanupTimer = setTimeout(() => {
      this.botManagedChannelCleanupTimers.delete(channelId)
    }, BOT_MANAGED_CHANNEL_SUPPRESSION_TTL_MS)
    cleanupTimer.unref()

    this.botManagedChannelCleanupTimers.set(channelId, cleanupTimer)
  }

  isBotManagedChannel(channelId: string): boolean {
    return this.botManagedChannelCleanupTimers.has(channelId)
  }

  /**
   * チャンネルがキャラクター作成対象かどうかを判定
   */
  async detectCharacterChannel(channel: TextChannel): Promise<ChannelCreationResult> {
    try {
      const characterCategory = this.appConfigService.get('discord.characterCategory')
      const categoryId = getChannelIdByName(channel.guild, characterCategory)

      this.logger.log(
        `チャンネル検出: ${channel.name}, Parent ID: ${channel.parentId}, Target category ID: ${categoryId}`
      )

      if (channel.parentId !== categoryId) {
        return {
          success: true,
          shouldCreateCharacter: false
        }
      }

      const creatorId = await this.extractCreatorId(channel)

      return {
        success: true,
        shouldCreateCharacter: true,
        context: {
          channel,
          categoryId,
          creatorId
        }
      }
    } catch (error) {
      this.logger.error('チャンネル検出エラー:', error)
      return {
        success: false,
        shouldCreateCharacter: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * チャンネル作成者のIDを抽出
   */
  private async extractCreatorId(channel: TextChannel): Promise<string | null> {
    try {
      const fetchedLogs = await channel.guild.fetchAuditLogs({
        limit: 10,
        type: AuditLogEvent.ChannelCreate
      })

      const logEntry = fetchedLogs.entries.find((entry) => entry.target.id === channel.id)

      if (logEntry?.executor) {
        this.logger.log(`チャンネル作成者ID: ${logEntry.executor.id}`)
        return logEntry.executor.id
      } else {
        this.logger.warn(`チャンネル ${channel.name} の作成者を特定できませんでした`)
        return null
      }
    } catch (error) {
      this.logger.error('Audit logs取得エラー:', error)
      return null
    }
  }
}
