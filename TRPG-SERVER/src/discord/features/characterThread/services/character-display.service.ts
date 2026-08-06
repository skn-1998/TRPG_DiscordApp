/**
 * Character Display Service
 *
 * キャラクター情報表示の統合サービス
 * character-tab-buttons.serviceの機能とDiscordEmbedHandlerServiceを統合
 * features/内でのEmbed生成・更新ロジック一元化
 */

import { Injectable, Logger } from '@nestjs/common'
import { EmbedBuilder } from 'discord.js'
import { CharacterEntity } from '../../../../domains/character/models/character.entity'
import { CharacterService } from '../../../../domains/character/character.service'
import { ErrorHandler, ErrorContext } from '../../../../core/http/error-handler'

/**
 * タブ表示タイプ
 */
export type TabType = 'basic' | 'status' | 'skills' | 'items' | 'desc'

/**
 * キャラクター表示サービス
 *
 * 各種タブでのキャラクター情報表示とEmbed更新を統合管理
 * DiscordEmbedHandlerServiceの機能を統合
 *
 * E-6c: キャラクター表示リクエストイベント（旧 display.requested 契約）のゴースト購読
 * （E-3d で効果ゼロ化済み）を契約ごと撤去。本サービスは DI 直呼びの Embed 構築サービスとなり、
 * イベントバスへ依存しない。
 */
@Injectable()
export class CharacterDisplayService {
  private readonly logger = new Logger(CharacterDisplayService.name)

  constructor(private readonly characterService: CharacterService) {}

  /**
   * チャンネルIDからキャラクターを検索し、指定タブのEmbedを作成
   */
  async createCharacterEmbed(channelId: string, tabType: TabType = 'basic'): Promise<EmbedBuilder | null> {
    try {
      this.logger.log(`Creating character embed: channelId=${channelId}, tabType=${tabType}`)

      // 同一プロセス内クエリのため CharacterService を直接呼び出す（E-2a: イベント RPC 廃止）
      const character = await this.characterService.findByChannelId(channelId)

      if (character) {
        return this.buildCharacterEmbed(character, tabType)
      }

      this.logger.warn(`Character not found for channelId: ${channelId}`)
      return null
    } catch (error) {
      this.logger.error(`Character embed creation failed for channelId: ${channelId}`, error)

      const context: ErrorContext = {
        channelId,
        action: 'character-display'
      }

      ErrorHandler.handleServiceError(error, context, 'CharacterDisplayService')
      return null
    }
  }

  /**
   * キャラクター情報からEmbedを構築
   */
  private buildCharacterEmbed(character: CharacterEntity, tabType: TabType): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`${character.characterName} - ${this.getTabTitle(tabType)}`)
      .setColor(0x00ae86)
      .setTimestamp()

    // 基本情報は常に表示
    if (character.gameSystemId) {
      embed.addFields({
        name: 'ゲームシステム',
        value: character.gameSystemId,
        inline: true
      })
    }

    embed.addFields({
      name: 'キャラクターID',
      value: character.characterId,
      inline: true
    })

    // タブ別の情報を追加
    switch (tabType) {
      case 'basic':
        // 基本情報は既に設定済み
        break

      case 'status':
        this.addCharacterData(embed, character.parameter, 'ステータス')
        break

      case 'skills':
        this.addCharacterData(embed, character.skill, 'スキル')
        break

      case 'items':
        this.addCharacterData(embed, character.item, 'アイテム')
        break

      case 'desc':
        this.addDescription(embed, character.description)
        break

      default:
        // デフォルトは基本情報
        break
    }

    return embed
  }

  /**
   * キャラクターデータをEmbedに追加
   */
  private addCharacterData(embed: EmbedBuilder, data: Record<string, any> | undefined, title: string): void {
    if (!data || Object.keys(data).length === 0) {
      embed.addFields({ name: title, value: '情報なし', inline: false })
      return
    }

    const fields = Object.entries(data)
      .map(([key, value]) => {
        if (value && typeof value === 'object' && 'name' in value && 'value' in value) {
          return { name: value.name, value: String(value.value), inline: true }
        }
        return { name: key, value: String(value), inline: true }
      })
      .filter((field) => field.value && field.value !== 'undefined')
      .slice(0, 10) // Discord Embed field制限を考慮

    if (fields.length > 0) {
      embed.addFields(...fields)
    } else {
      embed.addFields({ name: title, value: '情報なし', inline: false })
    }
  }

  /**
   * 詳細説明をEmbedに追加
   */
  private addDescription(embed: EmbedBuilder, description: Record<string, unknown> | undefined): void {
    if (!description || typeof description !== 'object') {
      embed.setDescription('詳細情報はありません。')
      return
    }

    const descText = Object.values(description)
      .map((d: any) => {
        if (d && typeof d === 'object' && 'value' in d) {
          return d.value
        }
        return String(d)
      })
      .filter((text) => text && text !== 'undefined')
      .join('\\n')

    if (descText && descText.length > 0) {
      // Discord description limit (2000文字)
      embed.setDescription(descText.substring(0, 2000))
    } else {
      embed.setDescription('詳細情報はありません。')
    }
  }

  /**
   * タブタイトルを取得
   */
  private getTabTitle(tabType: TabType): string {
    const titles: Record<TabType, string> = {
      basic: '基本情報',
      status: 'ステータス',
      skills: 'スキル',
      items: 'アイテム',
      desc: '詳細'
    }

    return titles[tabType] || '基本情報'
  }

  /**
   * タブタイプの妥当性をチェック
   */
  isValidTabType(tabType: string): tabType is TabType {
    return ['basic', 'status', 'skills', 'items', 'desc'].includes(tabType)
  }
}
