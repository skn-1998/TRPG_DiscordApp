import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../core/events/typed-event.service'
import { EventPayload } from '../../../events/contracts'
import { CharacterRepository } from '../repositories/character.repository'
import { randomBytes } from 'crypto'

/**
 * キャラクター関連のイベントハンドラーサービス
 * TypedEventServiceを使用した新しいイベント駆動アーキテクチャ
 */
@Injectable()
export class CharacterEventHandlerService implements OnModuleInit {
  private readonly logger = new Logger(CharacterEventHandlerService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly characterRepository: CharacterRepository
  ) {}

  /**
   * サービス初期化 - イベントリスナーの登録
   */
  onModuleInit(): void {
    this.registerEventListeners()
    this.logger.log('Character Event Handler Service initialized and event listeners registered')
  }

  /**
   * イベントリスナーの登録
   *
   * 注意: File-based Event Handlersの導入により、以下のイベントリスナーは削除されました：
   * - character.update.requested → CharacterUpdateRequestedHandler
   * - character.findByChannelId.requested → CharacterFindByChannelIdRequestedHandler
   * - character.findById.requested → CharacterFindByIdRequestedHandler
   * - character.findByName.requested → CharacterFindByNameRequestedHandler
   *
   * このサービスはレガシーサービスとして、将来的に削除予定です。
   */
  private registerEventListeners(): void {
    // 🚨 すべてのイベントリスナーはFile-based Event Handlersに移行済み
    // 重複登録を避けるため、このメソッドでのリスナー登録は無効化

    this.logger.debug('Character event listeners registration skipped (migrated to File-based Event Handlers)')
  }

  /**
   * 短いキャラクターIDを生成（8文字）
   */
  private async generateUniqueShortCharacterId(): Promise<string> {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      let result = ''
      const bytes = randomBytes(8)

      for (let i = 0; i < 8; i++) {
        result += chars[bytes[i] % chars.length]
      }

      // ID衝突チェック
      const existingCharacter = await this.characterRepository.findById(result)
      if (!existingCharacter) {
        this.logger.debug(`Generated unique short character ID: ${result}`)
        return result
      }

      attempts++
      this.logger.debug(`Character ID collision detected: ${result}, retrying (${attempts}/${maxAttempts})`)
    }

    // 最大試行回数を超えた場合はエラーを投げる
    throw new Error(`Failed to generate unique short character ID after ${maxAttempts} attempts`)
  }

  /**
   * キャラクター作成完了イベントの処理
   * 注意: 現在はChannel Create Orchestratorで統一処理されるため使用されない
   */
  // private async handleCharacterCreated(payload: EventPayload<'character.created'>): Promise<void> {
  //   try {
  //     const { character } = payload
  //     this.logger.log(`Character created event received: ${character.characterId} (${character.characterName})`)

  //     // Discord Channelが設定されている場合、characterEdit Embedの作成を要求
  //     if (character.discordChannelId) {
  //       this.logger.log(`Requesting characterEdit embed creation for channel: ${character.discordChannelId}`)

  //       // Discord Character Display リクエストイベント発火
  //       await this.typedEventService.emit('discord.character.display.requested', {
  //         character,
  //         channelId: character.discordChannelId,
  //         guildId: 'default-guild', // 後でDiscordサービスから動的に取得可能
  //         requesterId: character.discordUserId || 'system',
  //         displayType: 'enhanced',
  //         source: 'character-created',
  //         timestamp: new Date()
  //       })

  //       this.logger.log(`CharacterEdit embed creation requested for character: ${character.characterId}`)
  //     } else {
  //       this.logger.debug(`No Discord channel ID found for character: ${character.characterId}, skipping embed creation`)
  //     }
  //   } catch (error) {
  //     this.logger.error(`Failed to handle character created event for character: ${payload.character?.characterId}`, error)
  //   }
  // }

  // 削除: Event Bridge移行完了により不要
  // handleCharacterCreationRequested メソッドは削除されました
  // 新しい処理は CharacterService.create() → CharacterEditCreationHandler で実行されます

  /**
   * キャラクター更新リクエストの処理
   */
  private async handleCharacterUpdateRequested(payload: EventPayload<'character.update.requested'>): Promise<void> {
    try {
      this.logger.log(`Character update requested for channel: ${payload.channelId}`)

      // チャンネルIDでキャラクターを更新
      const updatedCharacter = await this.characterRepository.updateByChannelId(payload.channelId, payload.updateData)

      if (updatedCharacter) {
        // 更新完了通知は character.update.requested -> completed 経由で自動処理される
        this.logger.log(`Character updated successfully: ${updatedCharacter.characterName}`)
      } else {
        throw new Error('Character not found or update failed')
      }
    } catch (error) {
      this.logger.error('Character update failed:', error)

      // 失敗イベントを発行
      await this.typedEventService.emit('character.update.failed', {
        channelId: payload.channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: payload.source,
        timestamp: new Date()
      })
    }
  }

  /**
   * キャラクター検索リクエストの処理
   */
  private async handleCharacterSearchRequested(
    payload: EventPayload<'character.findByChannelId.requested'>
  ): Promise<void> {
    try {
      this.logger.log(`Character search requested for channel: ${payload.channelId}`)

      // チャンネルIDでキャラクターを検索
      const character = await this.characterRepository.findByChannelId(payload.channelId)

      // 成功イベントを発行（キャラクターが見つからない場合もnullで成功とする）
      await this.typedEventService.emit('character.findByChannelId.completed', {
        channelId: payload.channelId,
        character: character as any,
        source: payload.source,
        timestamp: new Date()
      })

      this.logger.log(
        `Character search completed for channel: ${payload.channelId}, found: ${character ? 'yes' : 'no'}`
      )
    } catch (error) {
      this.logger.error('Character search failed:', error)

      // 失敗イベントを発行
      await this.typedEventService.emit('character.findByChannelId.failed', {
        channelId: payload.channelId,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: payload.source,
        timestamp: new Date()
      })
    }
  }

  /**
   * キャラクターID検索リクエストの処理
   */
  private async handleCharacterSearchByIdRequested(
    payload: EventPayload<'character.findById.requested'>
  ): Promise<void> {
    try {
      this.logger.log(`Character search by ID requested: ${payload.characterId}`)

      // キャラクターIDでキャラクターを検索
      const character = await this.characterRepository.findById(payload.characterId)

      if (character) {
        // 成功イベントを発行
        await this.typedEventService.emit('character.findById.completed', {
          characterId: payload.characterId,
          character: character as any,
          source: payload.source,
          timestamp: new Date()
        })
        this.logger.log(`Character found by ID: ${character.characterName}`)
      } else {
        // 見つからない場合は失敗イベント
        await this.typedEventService.emit('character.findById.failed', {
          characterId: payload.characterId,
          error: 'Character not found',
          source: payload.source,
          timestamp: new Date()
        })
        this.logger.warn(`Character not found for ID: ${payload.characterId}`)
      }
    } catch (error) {
      this.logger.error('Character search by ID failed:', error)

      // 失敗イベントを発行
      await this.typedEventService.emit('character.findById.failed', {
        characterId: payload.characterId,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: payload.source,
        timestamp: new Date()
      })
    }
  }

  /**
   * キャラクター名検索リクエストの処理
   */
  private async handleCharacterSearchByNameRequested(
    payload: EventPayload<'character.findByName.requested'>
  ): Promise<void> {
    try {
      this.logger.log(`Character search by name requested: ${payload.characterName}`)

      // キャラクター名でキャラクターを検索（この機能は未実装の場合はリポジトリに追加が必要）
      const character = (await this.characterRepository.findByName?.(payload.characterName)) || null

      if (character) {
        // 成功イベントを発行
        await this.typedEventService.emit('character.findByName.completed', {
          characterName: payload.characterName,
          character: character as any,
          source: payload.source,
          timestamp: new Date()
        })
        this.logger.log(`Character found by name: ${character.characterName}`)
      } else {
        // 見つからない場合は失敗イベント
        await this.typedEventService.emit('character.findByName.failed', {
          characterName: payload.characterName,
          error: 'Character not found',
          source: payload.source,
          timestamp: new Date()
        })
        this.logger.warn(`Character not found for name: ${payload.characterName}`)
      }
    } catch (error) {
      this.logger.error('Character search by name failed:', error)

      // 失敗イベントを発行
      await this.typedEventService.emit('character.findByName.failed', {
        characterName: payload.characterName,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: payload.source,
        timestamp: new Date()
      })
    }
  }
}
