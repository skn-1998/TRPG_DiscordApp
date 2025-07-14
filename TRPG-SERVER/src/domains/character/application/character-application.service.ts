import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { CharacterRepository } from '../repositories/character.repository'
import { UserRepository } from '../../user/repositories/user.repository'
import { EventBusService } from '../../../shared/application/event-bus.service'
import { EventHandler } from '../../../shared/domain/events/base.event'
import {
  CharacterUpdateRequested,
  CharacterCreationRequested,
  CharacterDeletionRequested,
  CharacterSearchRequested,
  CharacterUpdated,
  CharacterCreated,
  CharacterDeleted,
  CharacterFound,
  CharacterListRetrieved,
  CharacterNotFound,
  CharacterValidationFailed,
  CharacterUpdateFailed,
  CharacterCreationFailed,
  CharacterDeletionFailed,
  CharacterAccessDenied,
  CharacterLimitExceeded,
  CharacterAuditEvent
} from '../events/character.events'
import { Character } from '../models/character.model'
import { CreateCharacterDto } from '../dto/create-character.dto'
import { UpdateCharacterDto } from '../dto/update-character.dto'

/**
 * Character ドメインのアプリケーションサービス
 * Character 関連のドメインイベントを処理し、ビジネスロジックを実行
 */
@Injectable()
export class CharacterApplicationService implements OnModuleInit {
  private readonly logger = new Logger(CharacterApplicationService.name)

  // 設定可能な制限値
  private readonly CHARACTER_LIMIT_PER_USER = 50
  private readonly MAX_CHARACTER_NAME_LENGTH = 100

  constructor(
    private readonly characterRepository: CharacterRepository,
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBusService
  ) {}

  /**
   * モジュール初期化時にイベントハンドラーを登録
   */
  async onModuleInit(): Promise<void> {
    this.registerEventHandlers()
    this.logger.log('Character Application Service initialized and event handlers registered')
  }

  /**
   * イベントハンドラーを登録
   */
  private registerEventHandlers(): void {
    this.eventBus.subscribeMany([
      {
        eventName: 'character.update.requested',
        handler: { handle: this.handleCharacterUpdateRequest.bind(this) } as EventHandler<CharacterUpdateRequested>
      },
      {
        eventName: 'character.creation.requested',
        handler: { handle: this.handleCharacterCreationRequest.bind(this) } as EventHandler<CharacterCreationRequested>
      },
      {
        eventName: 'character.deletion.requested',
        handler: { handle: this.handleCharacterDeletionRequest.bind(this) } as EventHandler<CharacterDeletionRequested>
      },
      {
        eventName: 'character.search.requested',
        handler: { handle: this.handleCharacterSearchRequest.bind(this) } as EventHandler<CharacterSearchRequested>
      }
    ])
  }

  /**
   * キャラクター更新リクエストを処理
   */
  async handleCharacterUpdateRequest(event: CharacterUpdateRequested): Promise<void> {
    this.logger.log(`Handling character update request: ${event.channelId}`)

    try {
      // キャラクター取得
      const character = await this.characterRepository.findByChannelId(event.channelId)

      if (!character) {
        await this.eventBus.publish(new CharacterNotFound({ channelId: event.channelId }, event.source))
        return
      }

      // 権限チェック（必要に応じて）
      if (event.userId && !this.canUserModifyCharacter(character, event.userId)) {
        await this.eventBus.publish(
          new CharacterAccessDenied(character.characterId, event.userId, event.source, 'update')
        )
        return
      }

      // データ検証
      const validationErrors = this.validateUpdateData(event.updateData)
      if (validationErrors.length > 0) {
        await this.eventBus.publish(new CharacterValidationFailed(event.updateData, validationErrors, event.source))
        return
      }

      // 更新実行
      const previousData = { ...character }
      const updatedCharacter = await this.characterRepository.updateByChannelId(event.channelId, event.updateData)

      if (!updatedCharacter) {
        throw new Error('Character update failed: no character returned')
      }

      // 変更されたフィールドを特定
      const changedFields = this.getChangedFields(previousData, updatedCharacter)

      // 成功イベント発行
      await this.eventBus.publish(new CharacterUpdated(updatedCharacter, previousData, changedFields))

      // 監査ログ
      await this.eventBus.publish(
        new CharacterAuditEvent(updatedCharacter.characterId, 'update', event.userId, {
          source: event.source,
          changedFields
        })
      )

      this.logger.log(`Character updated successfully: ${updatedCharacter.characterId}`)
    } catch (error) {
      this.logger.error(`Error handling character update request:`, error)
      await this.eventBus.publish(
        new CharacterUpdateFailed(
          event.channelId,
          event.updateData,
          error instanceof Error ? error : new Error(String(error))
        )
      )
    }
  }

  /**
   * キャラクター作成リクエストを処理
   */
  async handleCharacterCreationRequest(event: CharacterCreationRequested): Promise<void> {
    this.logger.log(`Handling character creation request for user: ${event.userId}`)

    try {
      // ユーザー存在確認
      const user = await this.userRepository.findById(event.userId)
      if (!user) {
        await this.eventBus.publish(new CharacterNotFound({ userId: event.userId }, event.source))
        return
      }

      // キャラクター数制限チェック
      const userCharacters = await this.characterRepository.findByUserId(event.userId)
      if (userCharacters.length >= this.CHARACTER_LIMIT_PER_USER) {
        await this.eventBus.publish(
          new CharacterLimitExceeded(event.userId, userCharacters.length, this.CHARACTER_LIMIT_PER_USER, event.source)
        )
        return
      }

      // データ検証
      const validationErrors = this.validateCreationData(event.createData)
      if (validationErrors.length > 0) {
        await this.eventBus.publish(new CharacterValidationFailed(event.createData, validationErrors, event.source))
        return
      }

      // キャラクター作成
      const character = await this.characterRepository.create(event.createData)

      // 成功イベント発行
      await this.eventBus.publish(new CharacterCreated(character))

      // 監査ログ
      await this.eventBus.publish(
        new CharacterAuditEvent(character.characterId, 'create', event.userId, { source: event.source })
      )

      this.logger.log(`Character created successfully: ${character.characterId}`)
    } catch (error) {
      this.logger.error(`Error handling character creation request:`, error)
      await this.eventBus.publish(
        new CharacterCreationFailed(event.createData, error instanceof Error ? error : new Error(String(error)))
      )
    }
  }

  /**
   * キャラクター削除リクエストを処理
   */
  async handleCharacterDeletionRequest(event: CharacterDeletionRequested): Promise<void> {
    this.logger.log(`Handling character deletion request: ${event.characterId}`)

    try {
      // キャラクター取得
      const character = await this.characterRepository.findById(event.characterId)

      if (!character) {
        await this.eventBus.publish(new CharacterNotFound({ characterId: event.characterId }, event.source))
        return
      }

      // 権限チェック
      if (!this.canUserModifyCharacter(character, event.userId)) {
        await this.eventBus.publish(
          new CharacterAccessDenied(character.characterId, event.userId, event.source, 'delete')
        )
        return
      }

      // 削除実行
      await this.characterRepository.remove(event.characterId)

      // 成功イベント発行
      await this.eventBus.publish(new CharacterDeleted(event.characterId, event.userId, character))

      // 監査ログ
      await this.eventBus.publish(
        new CharacterAuditEvent(event.characterId, 'delete', event.userId, {
          source: event.source,
          reason: event.reason
        })
      )

      this.logger.log(`Character deleted successfully: ${event.characterId}`)
    } catch (error) {
      this.logger.error(`Error handling character deletion request:`, error)
      await this.eventBus.publish(
        new CharacterDeletionFailed(event.characterId, error instanceof Error ? error : new Error(String(error)))
      )
    }
  }

  /**
   * キャラクター検索リクエストを処理
   */
  async handleCharacterSearchRequest(event: CharacterSearchRequested): Promise<void> {
    this.logger.log(`Handling character search request: ${JSON.stringify(event.searchCriteria)}`)

    try {
      let character: Character | null = null

      // 検索条件に応じて検索
      if (event.searchCriteria.characterId) {
        character = await this.characterRepository.findById(event.searchCriteria.characterId)
      } else if (event.searchCriteria.channelId) {
        character = await this.characterRepository.findByChannelId(event.searchCriteria.channelId)
      } else if (event.searchCriteria.characterName) {
        character = await this.characterRepository.findByName(event.searchCriteria.characterName)
      } else if (event.searchCriteria.userId) {
        // ユーザーのキャラクター一覧を取得
        const characters = await this.characterRepository.findByUserId(event.searchCriteria.userId)
        await this.eventBus.publish(new CharacterListRetrieved(characters, event.searchCriteria.userId))
        return
      }

      if (character) {
        await this.eventBus.publish(new CharacterFound(character, event.searchCriteria))
      } else {
        await this.eventBus.publish(new CharacterNotFound(event.searchCriteria, event.source))
      }
    } catch (error) {
      this.logger.error(`Error handling character search request:`, error)
      await this.eventBus.publish(new CharacterNotFound(event.searchCriteria, event.source))
    }
  }

  /**
   * ユーザーがキャラクターを変更する権限があるかチェック
   */
  private canUserModifyCharacter(character: Character, userId: string): boolean {
    // ビジネスルール：キャラクターの所有者のみが変更可能
    return character.discordUserId === userId
  }

  /**
   * 更新データの検証
   */
  private validateUpdateData(updateData: UpdateCharacterDto): string[] {
    const errors: string[] = []

    // キャラクター名の検証
    if (updateData.characterName !== undefined) {
      if (typeof updateData.characterName !== 'string') {
        errors.push('Character name must be a string')
      } else if (updateData.characterName.length === 0) {
        errors.push('Character name cannot be empty')
      } else if (updateData.characterName.length > this.MAX_CHARACTER_NAME_LENGTH) {
        errors.push(`Character name must be ${this.MAX_CHARACTER_NAME_LENGTH} characters or less`)
      }
    }

    // ステータスの検証
    if (updateData.status !== undefined) {
      if (typeof updateData.status !== 'object' || updateData.status === null) {
        errors.push('Character status must be an object')
      }
    }

    // ゲームシステムIDの検証
    if (updateData.gameSystemId !== undefined) {
      if (typeof updateData.gameSystemId !== 'string') {
        errors.push('Game system ID must be a string')
      }
    }

    return errors
  }

  /**
   * 作成データの検証
   */
  private validateCreationData(createData: CreateCharacterDto): string[] {
    const errors: string[] = []

    // 必須フィールド検証
    if (!createData.characterName || createData.characterName.trim() === '') {
      errors.push('Character name is required')
    } else if (createData.characterName.length > this.MAX_CHARACTER_NAME_LENGTH) {
      errors.push(`Character name must be ${this.MAX_CHARACTER_NAME_LENGTH} characters or less`)
    }

    if (!createData.gameSystemId) {
      errors.push('Game system ID is required')
    }

    if (!createData.discordUserId) {
      errors.push('Discord user ID is required')
    }

    // その他のビジネスルール検証
    // 例：不適切な文字列の検証、ゲームシステム固有のルール等

    return errors
  }

  /**
   * 変更されたフィールドを特定
   */
  private getChangedFields(previous: Character, current: Character): string[] {
    const changed: string[] = []

    // 主要フィールドの比較
    const fieldsToCheck = [
      'characterName',
      'gameSystemId',
      'discordChannelId',
      'status',
      'skill',
      'parameter',
      'item',
      'description'
    ]

    fieldsToCheck.forEach((field) => {
      const prevValue = previous[field as keyof Character]
      const currValue = current[field as keyof Character]

      if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
        changed.push(field)
      }
    })

    return changed
  }
}
