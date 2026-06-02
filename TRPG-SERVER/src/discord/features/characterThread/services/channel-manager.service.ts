import { Injectable, Logger } from '@nestjs/common'
import { ChannelType, Guild, StringSelectMenuOptionBuilder, TextChannel, ThreadChannel } from 'discord.js'
import { AppConfigService } from '../../../../config/config.service'
import { Character } from '../../../../domains/character/models/character.model'
import _ from 'lodash'
import {
  buildFallbackOption,
  buildSelectOptions,
  ChannelSnapshot,
  isTextChannelInCategory,
  matchesCharacterCategory,
  selectChannelOptions
} from './channel-manager.util'

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
      const categoryNames = [this.appConfigService.get('discord.characterCategory')]

      // [副作用境界] カテゴリーチャンネルを cache から取得（判定ロジックは純関数へ委譲）
      const categoryChannel = guild.channels.cache.find((channel) => matchesCharacterCategory(channel, categoryNames))

      if (_.isNil(categoryChannel)) {
        this.logger.warn('Character category not found')
        return [buildFallbackOption('カテゴリが見つかりません', 'no-category')]
      }

      // [副作用境界] カテゴリ内テキストチャンネルを cache から抽出
      const textChannels = guild.channels.cache.filter((channel) =>
        isTextChannelInCategory(channel, categoryChannel.id)
      )

      if (textChannels.size === 0) {
        this.logger.warn('No text channels found in character category')
        return [buildFallbackOption('チャンネルが見つかりません', 'no-channels')]
      }

      // [純粋ロジック] スナップショットへ写し取り → 降順ソート＋25件制限＋整形
      const snapshots: ChannelSnapshot[] = Array.from(textChannels.values()).map((channel) => ({
        id: channel.id,
        name: channel.name,
        type: channel.type,
        parentId: channel.parentId,
        createdTimestamp: channel.createdTimestamp
      }))
      const options = buildSelectOptions(selectChannelOptions(snapshots))

      this.logger.debug(`Found ${options.length} character channels`)
      return options
    } catch (error) {
      this.logger.error(`Failed to get channel options: ${error}`)
      return [buildFallbackOption('エラーが発生しました', 'error')]
    }
  }

  /**
   * カテゴリチャンネルの存在確認
   */
  validateCharacterCategory(guild: Guild): { isValid: boolean; categoryChannel: any } {
    const categoryNames = [this.appConfigService.get('discord.characterCategory')]

    // [副作用境界] cache 取得。カテゴリ判定は純関数 matchesCharacterCategory へ委譲。
    const categoryChannel = guild.channels.cache.find((channel) => matchesCharacterCategory(channel, categoryNames))

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
