import { Injectable, Logger } from '@nestjs/common'
import { Client, AuditLogEvent, TextChannel } from 'discord.js'
import { getChannelIdByName } from '../../utils/searchChannelID'
import { AppConfigService } from 'src/config/config.service'
import { DiceRollChannelInputDto } from 'src/domains/dice-roll/dto/create-dice-roll-channel.dto'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'

@Injectable()
export class DiceRollChannelCreateService {
  private readonly logger = new Logger(DiceRollChannelCreateService.name)
  private client: Client

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly diceRollService: DiceRollService
  ) {}

  /**
   * doEventsから呼び出される実行メソッド
   */
  async execute(channel: TextChannel): Promise<void> {
    const diceRollCategory = this.appConfigService.get('discord.diceRollCategory')
    const categoryId = getChannelIdByName(channel.guild, diceRollCategory)
    this.logger.log(
      `チャンネル作成: ${channel.name}, Parent ID: ${channel.parentId}, Target category ID: ${categoryId}`
    )
    if (channel.parentId !== categoryId) return
    this.logger.log(`ダイスロールチャンネルを作成: ${channel.name}`)
    const createDiceRollChannelDto: DiceRollChannelInputDto = {
      discordChannelId: channel.id,
      characterIds: [],
      textIds: []
    }

    await this.diceRollService.createOrGetChannel(createDiceRollChannelDto)
  }
}
