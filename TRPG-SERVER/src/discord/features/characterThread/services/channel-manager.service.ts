import { Injectable, Logger } from '@nestjs/common'
import {
  ChannelType,
  CommandInteraction,
  Guild,
  StringSelectMenuOptionBuilder,
  TextChannel,
  ThreadChannel
} from 'discord.js'
import { AppConfigService } from '../../../../config/config.service'
import { Character } from '../../../../domains/character/models/character.model'
import _ from 'lodash'

/**
 * チャンネル・スレッド管理サービス
 *
 * 責務：
 * - Discord チャンネルの検索・取得
 * - スレッドの作成・管理
 * - カテゴリ管理
 */
@Injectable()
export class ChannelManagerService {
  private readonly logger = new Logger(ChannelManagerService.name)

  constructor(private readonly appConfigService: AppConfigService) {
    this.logger.debug('Channel manager service initialized')
  }

  /**
   * キャラクタースレッドを作成
   */
  async createCharacterThread(guild: Guild, channelId: string, character: Character): Promise<ThreadChannel> {
    try {
      // チャンネルを取得
      const targetChannel = await guild.channels.fetch(channelId)

      if (_.isNil(targetChannel) || !(targetChannel instanceof TextChannel)) {
        throw new Error('キャラクターのチャンネルが見つかりません')
      }

      // スレッドを作成
      const thread = await targetChannel.threads.create({
        name: `${character.characterName}`,
        type: ChannelType.PublicThread
      })

      this.logger.debug(`Thread created: ${thread.id} for character: ${character.characterName}`)
      return thread
    } catch (error) {
      this.logger.error(`Failed to create character thread: ${error}`)
      throw error
    }
  }

  /**
   * キャラクターカテゴリ内のチャンネル一覧を取得
   */
  getCharacterChannelOptions(guild: Guild): StringSelectMenuOptionBuilder[] {
    try {
      const characterCategory = this.appConfigService.get('discord.characterCategory')
      const categoryNameStr = [characterCategory]

      // カテゴリーチャンネルを取得
      const categoryChannel = guild.channels.cache.find(
        (channel) => channel.type === ChannelType.GuildCategory && categoryNameStr.includes(channel.name)
      )

      if (_.isNil(categoryChannel)) {
        this.logger.warn('Character category not found')
        return [new StringSelectMenuOptionBuilder().setLabel('カテゴリが見つかりません').setValue('no-category')]
      }

      // カテゴリーチャンネル内のテキストチャンネルを取得
      const textChannels = guild.channels.cache.filter(
        (channel) => channel.type === ChannelType.GuildText && channel.parentId === categoryChannel.id
      )

      if (textChannels.size === 0) {
        this.logger.warn('No text channels found in character category')
        return [new StringSelectMenuOptionBuilder().setLabel('チャンネルが見つかりません').setValue('no-channels')]
      }

      // Discord制限：SelectMenuは最大25個のオプションまで
      let channelsArray = Array.from(textChannels.values())

      // 作成日時順に並べ替え（新しいものが先頭）
      channelsArray = channelsArray.sort((a, b) => (b.createdTimestamp ?? 0) - (a.createdTimestamp ?? 0))

      // 最大25個に制限
      channelsArray = channelsArray.slice(0, 25)

      const options = channelsArray.map((channel) =>
        new StringSelectMenuOptionBuilder().setLabel(channel.name).setValue(String(channel.id))
      )

      this.logger.debug(`Found ${options.length} character channels`)
      return options
    } catch (error) {
      this.logger.error(`Failed to get channel options: ${error}`)
      return [new StringSelectMenuOptionBuilder().setLabel('エラーが発生しました').setValue('error')]
    }
  }

  /**
   * カテゴリチャンネルの存在確認
   */
  validateCharacterCategory(guild: Guild): { isValid: boolean; categoryChannel: any } {
    const characterCategory = this.appConfigService.get('discord.characterCategory')
    const categoryNameStr = [characterCategory]

    const categoryChannel = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && categoryNameStr.includes(channel.name)
    )

    return {
      isValid: !_.isNil(categoryChannel),
      categoryChannel
    }
  }

  /**
   * テキストチャンネルの検証
   */
  async validateTextChannel(guild: Guild, channelId: string): Promise<TextChannel | null> {
    try {
      const channel = await guild.channels.fetch(channelId)

      if (_.isNil(channel) || !(channel instanceof TextChannel)) {
        return null
      }

      return channel
    } catch (error) {
      this.logger.error(`Failed to validate text channel: ${channelId}`, error)
      return null
    }
  }

  /**
   * スレッドの存在確認
   */
  async validateThread(guild: Guild, threadId: string): Promise<ThreadChannel | null> {
    try {
      const thread = await guild.channels.fetch(threadId)

      if (_.isNil(thread) || !(thread instanceof ThreadChannel)) {
        return null
      }

      return thread
    } catch (error) {
      this.logger.error(`Failed to validate thread: ${threadId}`, error)
      return null
    }
  }

  /**
   * チャンネル情報をログ出力
   */
  logChannelInfo(channel: TextChannel | ThreadChannel): void {
    this.logger.debug(`Channel info: ${channel.name} (${channel.id})`)
    this.logger.debug(`Type: ${channel.type}, Parent: ${channel.parentId}`)
  }
}
