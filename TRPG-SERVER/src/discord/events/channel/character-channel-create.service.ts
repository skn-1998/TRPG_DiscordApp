import { Injectable, Logger } from '@nestjs/common'
import { AuditLogEvent, Client, TextChannel } from 'discord.js'
import { CharaInfoButtonService } from '../button/chara-info-button.service'
import { getChannelIdByName } from '../../utils/searchChannelID'
import { DiceRollService } from 'src/domains/dice-roll/dice-roll.service'
import { AppConfigService } from 'src/config/config.service'
import { PartialInputDiceRollChannelDto } from 'src/domains/dice-roll/dto/create-dice-roll-channel.dto'
import { CharacterService } from 'src/domains/character/character.service'
import { generateAppConfig } from 'src/config/configuration'

@Injectable()
export class ChannelCreateService {
  private readonly logger = new Logger(ChannelCreateService.name)
  private client: Client

  constructor(
    private readonly appConfigService: AppConfigService,
    private readonly characterService: CharacterService
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

    if (channel.parentId === categoryId) {
      // チャンネル作成者のIDを取得
      let creatorId = ''
      try {
        // Audit Logsを取得（CHANNEL_CREATEアクションのみ、より多くのエントリを取得）
        const fetchedLogs = await channel.guild.fetchAuditLogs({
          limit: 10, // より多くのログを取得
          type: AuditLogEvent.ChannelCreate
        })

        // 該当チャンネルに関するログエントリを検索
        const logEntry = fetchedLogs.entries.find((entry) => entry.target.id === channel.id)

        // 該当するログが見つかった場合
        if (logEntry) {
          creatorId = logEntry.executor.id
          this.logger.log(`チャンネル作成者ID: ${creatorId}`)
        } else {
          this.logger.warn(`チャンネル ${channel.name} の作成者を特定できませんでした`)
        }
      } catch (error) {
        this.logger.error('Audit logs取得エラー:', error)
      }

      // 空文字列でキャラクターを作成 (モデルでデフォルト値が設定されているため可能)
      await this.characterService
        .create({
          TRPGId: '',
          characterName: channel.name,
          discordChannelId: channel.id,
          discordUserId: creatorId // チャンネル作成者のIDを設定
        })
        .then((character) => {
          this.logger.log(`キャラクター「${character.characterName}」が作成されました。ID: ${character.characterId}`)
          if (!creatorId) {
            this.logger.warn('注意: discordUserIdは取得できませんでした。後で設定してください。')
            const clientUrl = generateAppConfig().app.frontendUrl
            // const url = clientUrl + '/'
          }
        })
        .catch((error) => {
          this.logger.error('キャラクター作成エラー:', error)
        })
    }
  }
}
