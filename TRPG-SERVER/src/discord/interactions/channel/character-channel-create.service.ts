import { Injectable, Logger } from '@nestjs/common'
import { TextChannel } from 'discord.js'
import { ChannelCreateOrchestratorService } from '../../features/characterEdit/services/channel-create-orchestrator.service'

@Injectable()
export class CharacterChannelCreateService {
  private readonly logger = new Logger(CharacterChannelCreateService.name)

  constructor(private readonly channelCreateOrchestratorService: ChannelCreateOrchestratorService) {}

  /**
   * チャンネル作成時のイベントハンドラー
   * @param channel 作成されたチャンネル
   * @param categoryId カテゴリID
   */
  async execute(channel: TextChannel, _categoryId: string): Promise<void> {
    this.logger.log(`キャラクターチャンネル作成処理開始: ${channel.name}`)

    try {
      await this.channelCreateOrchestratorService.execute(channel)
    } catch (error) {
      this.logger.error('キャラクターチャンネル作成処理でエラーが発生:', error)
    }
  }
}
