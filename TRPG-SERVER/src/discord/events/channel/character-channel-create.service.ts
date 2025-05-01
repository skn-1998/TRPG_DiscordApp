import { Injectable, Logger } from '@nestjs/common'
import { Client, TextChannel } from 'discord.js'
import { CharaInfoButtonService } from '../button/chara-info-button.service'
import { getChannelIdByName } from '../../utils/searchChannelID'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { AppConfigService } from 'src/config/config.service'
import { PartialInputDiceRollChannelDto } from 'src/domains/dice-roll/dto/create-dice-roll-channel.dto'

@Injectable()
export class ChannelCreateService {
  private readonly logger = new Logger(ChannelCreateService.name)
  private client: Client

  constructor(
    private readonly diceRollService: DiceRollService,
    private readonly appConfigService: AppConfigService
  ) {}
  data: TextChannel

  /**
   * doEventsから呼び出される実行メソッド
   */
  async execute(channel: TextChannel): Promise<void> {
    const characterCategory = this.appConfigService.get('discord.characterCategory')
    const categoryId = getChannelIdByName(channel.guild, characterCategory)
    this.logger.log(
      `チャンネル作成: ${channel.name}, Parent ID: ${channel.parentId}, Target category ID: ${categoryId}`
    )
    if (channel.parentId !== categoryId) return
    this.logger.log(`ダイスロールチャンネルを作成: ${channel.name}`)
    const createDiceRollChannelDto: PartialInputDiceRollChannelDto = {
      discordChannelId: channel.id,
      characterIds: [],
      textIds: []
    }

    await this.diceRollService.createOrGetChannel(createDiceRollChannelDto)
  }
}
