import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../shared/application/typed-event.service'
import { EventPayload } from '../../../shared/domain/events/event-contracts'
import { CharacterRepository } from '../repositories/character.repository'
import { UserService } from '../../user/user.service'
import { CreateCharacterDto } from '../dto/create-character.dto'
import { Character } from '../models/character.model'
import { v4 as uuidv4 } from 'uuid'

/**
 * キャラクター関連のイベントハンドラーサービス
 * TypedEventServiceを使用した新しいイベント駆動アーキテクチャ
 */
@Injectable()
export class CharacterEventHandlerService implements OnModuleInit {
  private readonly logger = new Logger(CharacterEventHandlerService.name)

  constructor(
    private readonly typedEventService: TypedEventService,
    private readonly characterRepository: CharacterRepository,
    private readonly userService: UserService
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
   */
  private registerEventListeners(): void {
    // キャラクター作成リクエストイベント
    this.typedEventService.on('character.creation.requested', async (payload) => {
      await this.handleCharacterCreationRequested(payload)
    })

    // キャラクター更新リクエストイベント
    this.typedEventService.on('character.update.requested', async (payload) => {
      await this.handleCharacterUpdateRequested(payload)
    })

    // キャラクター検索リクエストイベント
    this.typedEventService.on('character.findByChannelId.requested', async (payload) => {
      await this.handleCharacterSearchRequested(payload)
    })

    this.typedEventService.on('character.findById.requested', async (payload) => {
      await this.handleCharacterSearchByIdRequested(payload)
    })

    this.typedEventService.on('character.findByName.requested', async (payload) => {
      await this.handleCharacterSearchByNameRequested(payload)
    })

    this.logger.debug('Character event listeners registered')
  }

  /**
   * キャラクター作成リクエストの処理
   */
  private async handleCharacterCreationRequested(payload: EventPayload<'character.creation.requested'>): Promise<void> {
    try {
      this.logger.log(`Character creation requested: ${payload.createData.characterName}`)

      // キャラクターIDがない場合は生成
      const characterId = payload.createData.characterId || uuidv4()

      // CreateCharacterDtoからCharacterオブジェクトに変換
      const character: Partial<Character> = {
        characterId,
        gameSystemId: payload.createData.gameSystemId,
        characterName: payload.createData.characterName,
        discordUserId: payload.createData.discordUserId,
        discordChannelId: payload.createData.discordChannelId,
        status: (payload.createData.status as any) || {},
        skill: (payload.createData.skill as any) || {},
        parameter: (payload.createData.parameter as any) || {}
      }

      // キャラクターを作成
      const createdCharacter = await this.characterRepository.create(character)

      // ユーザーにキャラクターIDを追加
      if (payload.createData.discordUserId) {
        await this.userService.addCharacterId(payload.createData.discordUserId, characterId)
      }

      // 成功イベントを発行
      await this.typedEventService.emit('character.creation.completed', {
        character: createdCharacter,
        source: payload.source,
        timestamp: new Date()
      })

      await this.typedEventService.emit('character.update.completed', {
        channelId: payload.createData.discordChannelId || '',
        character: createdCharacter,
        source: payload.source,
        timestamp: new Date()
      })

      this.logger.log(
        `Character created successfully: ${createdCharacter.characterName} (ID: ${createdCharacter.characterId})`
      )
    } catch (error) {
      this.logger.error('Character creation failed:', error)

      // 失敗イベントを発行
      await this.typedEventService.emit('character.creation.failed', {
        createData: payload.createData,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: payload.source,
        timestamp: new Date()
      })
    }
  }

  /**
   * キャラクター更新リクエストの処理
   */
  private async handleCharacterUpdateRequested(payload: EventPayload<'character.update.requested'>): Promise<void> {
    try {
      this.logger.log(`Character update requested for channel: ${payload.channelId}`)

      // チャンネルIDでキャラクターを更新
      const updatedCharacter = await this.characterRepository.updateByChannelId(
        payload.channelId,
        payload.updateData as any
      )

      if (updatedCharacter) {
        // 成功イベントを発行
        await this.typedEventService.emit('character.update.completed', {
          channelId: payload.channelId,
          character: updatedCharacter,
          source: payload.source,
          timestamp: new Date()
        })

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
        character: character,
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
          character: character,
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
          character: character,
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
