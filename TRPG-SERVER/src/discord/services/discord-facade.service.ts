import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Character } from '../../domains/character/models/character.model'
import { UpdateCharacterDto } from '../../domains/character/dto/update-character.dto'

/**
 * 【PHASE3】 Discord関連のイベント発行専用サービス
 * CharacterServiceへの直接依存を排除し、イベント駆動パターンを使用
 *
 * @deprecated このサービスは段階的に廃止予定
 * 新しい機能はDiscordIntegrationServiceを使用してください
 */
@Injectable()
export class DiscordFacadeService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * 【PHASE3】 チャンネルIDでキャラクターを取得
   * @deprecated イベント駆動パターンを使用してください
   */
  async getCharacterByChannelId(channelId: string): Promise<Character | null> {
    console.warn('[PHASE3] DiscordFacadeService.getCharacterByChannelId is deprecated. Use event-driven pattern.')

    // イベント駆動パターンでリクエスト
    this.eventEmitter.emit('character.findByChannelId.requested', {
      channelId,
      source: 'discord-facade',
      timestamp: new Date()
    })

    // 一時的にnullを返す（Phase 3完了後に削除）
    return null
  }

  /**
   * 【PHASE3】 キャラクターIDでキャラクターを取得
   * @deprecated イベント駆動パターンを使用してください
   */
  async getCharacterById(characterId: string): Promise<Character | null> {
    console.warn('[PHASE3] DiscordFacadeService.getCharacterById is deprecated. Use event-driven pattern.')

    // イベント駆動パターンでリクエスト
    this.eventEmitter.emit('character.findById.requested', {
      characterId,
      source: 'discord-facade',
      timestamp: new Date()
    })

    // 一時的にnullを返す（Phase 3完了後に削除）
    return null
  }

  /**
   * 【PHASE3】 キャラクター名でキャラクターを取得
   * @deprecated イベント駆動パターンを使用してください
   */
  async getCharacterByName(name: string): Promise<Character | null> {
    console.warn('[PHASE3] DiscordFacadeService.getCharacterByName is deprecated. Use event-driven pattern.')

    // イベント駆動パターンでリクエスト
    this.eventEmitter.emit('character.findByName.requested', {
      characterName: name,
      source: 'discord-facade',
      timestamp: new Date()
    })

    // 一時的にnullを返す（Phase 3完了後に削除）
    return null
  }

  /**
   * 【PHASE3】 チャンネルIDでキャラクターを更新
   * @deprecated DiscordIntegrationService.requestCharacterUpdateを使用してください
   */
  async updateCharacterByChannelId(channelId: string, updateData: UpdateCharacterDto): Promise<Character | null> {
    console.warn(
      '[PHASE3] DiscordFacadeService.updateCharacterByChannelId is deprecated. Use DiscordIntegrationService.'
    )

    // イベント駆動パターンで更新リクエスト
    this.eventEmitter.emit('character.updateByChannelId.requested', {
      channelId,
      updateData,
      source: 'discord-facade',
      timestamp: new Date()
    })

    // 一時的にnullを返す（Phase 3完了後に削除）
    return null
  }

  /**
   * 【PHASE3】 キャラクターを更新
   * @deprecated DiscordIntegrationService.requestCharacterUpdateを使用してください
   */
  async updateCharacter(characterId: string, updateData: UpdateCharacterDto): Promise<Character | null> {
    console.warn('[PHASE3] DiscordFacadeService.updateCharacter is deprecated. Use DiscordIntegrationService.')

    // イベント駆動パターンで更新リクエスト
    this.eventEmitter.emit('character.update.requested', {
      characterId,
      updateData,
      source: 'discord-facade',
      timestamp: new Date()
    })

    // 一時的にnullを返す（Phase 3完了後に削除）
    return null
  }

  /**
   * Discord関連のキャラクター操作イベントを発行
   * この機能は維持される
   */
  emitCharacterEvent(eventName: string, data: Record<string, unknown>): void {
    this.eventEmitter.emit(eventName, {
      ...data,
      source: 'discord-facade',
      timestamp: new Date()
    })
  }
}
