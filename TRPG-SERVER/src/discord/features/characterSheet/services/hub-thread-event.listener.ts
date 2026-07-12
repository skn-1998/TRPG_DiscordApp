import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { TypedEventService } from '../../../../core/events/typed-event.service'
import { EVENT_NAMES, type EventPayload } from '../../../../events/contracts'
import { CharacterSheetOperationService } from '../../../../features/character-sheet/services/character-sheet-operation.service'
import { HubPublicationService } from './hub-publication.service'

const POLL_ATTEMPTS = 120
const POLL_DELAY_MS = 250

@Injectable()
export class HubThreadEventListener implements OnModuleInit {
  private readonly logger = new Logger(HubThreadEventListener.name)

  constructor(
    private readonly events: TypedEventService,
    private readonly operations: CharacterSheetOperationService,
    private readonly publisher: HubPublicationService
  ) {}

  onModuleInit(): void {
    this.events.on(EVENT_NAMES.DISCORD_THREAD_CREATE_REQUESTED, (event) => {
      // 既存の thread 作成イベント完了を hub の bounded poll で最大30秒ブロックしない。
      // handleSafely が内部で全例外を処理し、投稿結果は永続 hub 状態で観測する。
      void this.handleSafely(event)
    })
  }

  private async handleSafely(event: EventPayload<'discord.thread.create.requested'>): Promise<void> {
    try {
      if (event.character.sheet === undefined) return
      const baselineThreadId = event.character.discordThreadId
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
        const character = await this.operations.getHubCharacter(event.character.characterId)
        if (character === null) return
        if (character.discordThreadId && character.discordThreadId !== baselineThreadId) {
          await this.publisher.postHub(character.characterId, character.discordThreadId)
          return
        }
        await this.delay(POLL_DELAY_MS)
      }
      this.logger.error(
        `Hub remains none because a new persisted threadId did not appear: ${event.character.characterId}`
      )
    } catch (error) {
      // 同じ emitAsync 上で動く既存 ThreadOrchestrator の完了を hub の補助処理で壊さない。
      this.logger.error(`Hub post event handling failed: ${event.character.characterId}`, error)
    }
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds))
  }
}
