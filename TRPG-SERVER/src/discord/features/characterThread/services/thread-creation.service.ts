/**
 * Thread Creation Service
 *
 * characterEditパターンに基づくシンプルなスレッド作成サービス。
 *
 * 責務（H3 分割後）：Discord I/O のオーケストレーションに専念する。
 * - guild / channel の取得（fetch）
 * - スレッド作成（threads.create）
 * - 表示メッセージの送信（thread.send）
 * - キャラクターの DB 更新（characterService.update）
 *
 * スレッド名 / Embed / ボタン / セレクトメニュー等の「純粋な構築ロジック」は
 * thread-creation.util.ts（discord.js Builder 依存・副作用なし）へ抽出済み。
 */

import { Injectable, Logger } from '@nestjs/common'
import {
  Client,
  Guild,
  TextChannel,
  ThreadChannel,
  ChannelType,
  ThreadAutoArchiveDuration,
  ActionRowBuilder,
  StringSelectMenuBuilder
} from 'discord.js'
import { Character } from '../../../../domains/character/models/character.model'
import { ErrorHandler, ErrorContext } from '../../../../core/http/error-handler'
import { DiscordClientService } from '../../../services/discord-client.service'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { CharacterService } from '../../../../domains/character/character.service'
import {
  buildThreadName,
  buildThreadUrl,
  createBasicCharacterEmbed,
  createDetailedCharacterEmbed,
  createDiceRollActionRow,
  createParameterSelectMenu,
  createPresetButtons,
  createSkillRollActionRows,
  chunkButtonsIntoRows
} from './thread-creation.util'

/**
 * スレッド作成リクエスト
 */
export interface CreateThreadRequest {
  characterId: string
  characterName: string
  channelId: string
  creatorId: string
  guildId: string
  displayType?: 'basic' | 'enhanced' | 'compact' // 表示タイプ
}

/**
 * スレッド作成結果
 */
export interface CreateThreadResult {
  success: boolean
  threadId?: string
  threadUrl?: string
  error?: string
}

/**
 * スレッド作成サービス
 *
 * Discord APIを直接使用してスレッドを作成し、
 * キャラクター情報を投稿する実用的なサービス
 */
@Injectable()
export class ThreadCreationService {
  private readonly logger = new Logger(ThreadCreationService.name)
  private readonly discordClient: Client

  constructor(
    private readonly discordClientService: DiscordClientService,
    private readonly typedEventService: TypedEventService,
    private readonly characterService: CharacterService
  ) {
    this.discordClient = this.discordClientService.getClient()
    // イベントハンドラー登録は削除 - File-based handlers（EventRegistryService）で一元管理
    this.logger.debug('Thread creation service initialized')
  }

  /**
   * キャラクタースレッドを作成
   */
  async createCharacterThread(request: CreateThreadRequest, character: Character): Promise<CreateThreadResult> {
    this.logger.log(`Creating thread for character: ${request.characterName}`)

    try {
      // ギルドを取得
      const guild = await this.getGuild(request.guildId)
      if (!guild) {
        return {
          success: false,
          error: `Guild not found: ${request.guildId}`
        }
      }

      // チャンネルを取得
      const channel = await this.getTextChannel(guild, request.channelId)
      if (!channel) {
        return {
          success: false,
          error: `Channel not found: ${request.channelId}`
        }
      }

      // スレッドを作成
      const thread = await this.createDiscordThread(channel, request.characterName)

      // character-editチャンネルIDを保存してから、discordChannelIdをスレッドIDに更新
      await this.updateCharacterChannelIds(character.characterId, thread.id, character.discordChannelId)

      // threadIdも保存
      await this.updateCharacterThreadId(character.characterId, thread.id)

      // キャラクター情報を投稿（表示タイプに応じて処理）
      await this.postCharacterDisplay(thread, character, request.displayType || 'basic')

      const threadUrl = buildThreadUrl(request.guildId, request.channelId, thread.id)

      this.logger.log(`Thread created successfully: ${thread.id}`)

      return {
        success: true,
        threadId: thread.id,
        threadUrl
      }
    } catch (error) {
      const context: ErrorContext = {
        characterId: request.characterId,
        channelId: request.channelId,
        action: 'thread-creation'
      }

      ErrorHandler.handleServiceError(error, context, 'ThreadCreationService')

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Discordスレッドを作成
   */
  private async createDiscordThread(channel: TextChannel, characterName: string): Promise<ThreadChannel> {
    const threadName = buildThreadName(characterName)

    return await channel.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PublicThread,
      reason: `Character thread for ${characterName}`
    })
  }

  /**
   * 表示タイプに応じてキャラクター表示を処理
   */
  private async postCharacterDisplay(
    thread: ThreadChannel,
    character: Character,
    displayType: 'basic' | 'enhanced' | 'compact'
  ): Promise<void> {
    try {
      if (displayType === 'enhanced') {
        await this.postEnhancedCharacterInfo(thread, character)
      } else if (displayType === 'compact') {
        await this.postCompactCharacterInfo(thread, character)
      } else {
        await this.postCharacterInfo(thread, character)
      }

      // 全表示タイプ共通：ダイス系UI を投稿
      await this.postActionButtons(thread)
      await this.postSkillRollButtons(thread, character)
      await this.postFlexibleDiceMenu(thread, character)
      await this.postPresetDiceButtons(thread, character)
    } catch (error) {
      this.logger.error(`Failed to post character display (${displayType}), falling back to basic`, error)

      // フォールバック: 基本表示
      await this.postCharacterInfo(thread, character)
      await this.postActionButtons(thread)
      await this.postSkillRollButtons(thread, character)
      await this.postFlexibleDiceMenu(thread, character)
    }
  }

  /**
   * Enhanced Character表示（character-thread用：詳細情報）
   */
  private async postEnhancedCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      this.logger.log(`Posting enhanced character info for: ${character.characterId}`)

      const embed = createDetailedCharacterEmbed(character, thread.guild?.id || '')
      await thread.send({ embeds: [embed] })

      this.logger.log(`Enhanced character display completed for: ${character.characterId}`)
    } catch (error) {
      this.logger.error('Failed to post enhanced character info', error)
      throw error // Re-throw to trigger fallback in postCharacterDisplay
    }
  }

  /**
   * コンパクト表示（将来の拡張用）
   */
  private async postCompactCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    // 簡単な1行表示など、将来実装
    await this.postCharacterInfo(thread, character)
  }

  /**
   * キャラクター情報Embedを投稿（基本版 + 編集URL）
   */
  private async postCharacterInfo(thread: ThreadChannel, character: Character): Promise<void> {
    const embed = createBasicCharacterEmbed(character, thread.guild?.id || '')
    await thread.send({ embeds: [embed] })
  }

  /**
   * 操作ボタンを投稿（ダイスロールボタンのみ - character-editと共有）
   */
  private async postActionButtons(thread: ThreadChannel): Promise<void> {
    const diceRow = createDiceRollActionRow()

    await thread.send({
      content: '🎲 ダイスロール',
      components: [diceRow]
    })
  }

  /**
   * 柔軟ダイス計算用のパラメータ選択メニューを投稿
   */
  private async postFlexibleDiceMenu(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const parameterSelectMenu = createParameterSelectMenu(character)

      if (parameterSelectMenu) {
        const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(parameterSelectMenu)

        await thread.send({
          content: '🎯 柔軟ダイス計算：パラメータを選択してください',
          components: [selectRow]
        })
      }
    } catch (error) {
      this.logger.error('Failed to post flexible dice menu', error)
    }
  }

  /**
   * よく使用されるパラメータのプリセットボタンを投稿
   */
  private async postPresetDiceButtons(thread: ThreadChannel, character: Character): Promise<void> {
    try {
      const presetButtons = createPresetButtons(character)

      if (presetButtons.length > 0) {
        const actionRows = chunkButtonsIntoRows(presetButtons)

        await thread.send({
          content: '⚡ クイックダイス：よく使用されるパラメータ',
          components: actionRows
        })
      }
    } catch (error) {
      this.logger.error('Failed to post preset dice buttons', error)
    }
  }

  /**
   * キャラクターのスキルロールボタンを投稿（character-editと共有）
   */
  private async postSkillRollButtons(thread: ThreadChannel, character: Character): Promise<void> {
    const actionRows = createSkillRollActionRows(character)

    if (actionRows.length > 0) {
      await thread.send({
        content: '🎯 スキルロール',
        components: actionRows
      })
    }
  }

  /**
   * キャラクターのスレッドチャンネルIDを更新（元のdiscordChannelIdはそのまま保持）
   */
  private async updateCharacterChannelIds(
    characterId: string,
    threadId: string,
    _editChannelId?: string
  ): Promise<void> {
    try {
      // discordChannelIdは変更せず、discordThreadIdのみを設定
      const updateData: any = {
        discordThreadId: threadId
      }

      await this.characterService.update(characterId, updateData)
      this.logger.log(`Character thread channel ID updated: ${characterId} -> thread: ${threadId}`)
    } catch (error) {
      this.logger.error(`Failed to update character thread channel ID: ${characterId}`, error)
      // エラーが発生してもスレッド作成処理は継続
    }
  }

  /**
   * キャラクターのthreadIdを更新
   */
  private async updateCharacterThreadId(characterId: string, threadId: string): Promise<void> {
    try {
      await this.characterService.update(characterId, { threadId })
      this.logger.log(`Character threadId updated: ${characterId} -> ${threadId}`)
    } catch (error) {
      this.logger.error(`Failed to update character threadId: ${characterId}`, error)
      // エラーが発生してもスレッド作成処理は継続
    }
  }

  /**
   * ギルドを取得
   */
  private async getGuild(guildId: string): Promise<Guild | null> {
    try {
      return await this.discordClient.guilds.fetch(guildId)
    } catch (error) {
      this.logger.error(`Failed to fetch guild ${guildId}:`, error instanceof Error ? error.message : String(error))
      return null
    }
  }

  /**
   * テキストチャンネルを取得
   */
  private async getTextChannel(guild: Guild, channelId: string): Promise<TextChannel | null> {
    try {
      const channel = await guild.channels.fetch(channelId)

      if (!channel || !(channel instanceof TextChannel)) {
        return null
      }

      return channel
    } catch (error) {
      this.logger.error(`Failed to fetch channel ${channelId}:`, error instanceof Error ? error.message : String(error))
      return null
    }
  }
}
