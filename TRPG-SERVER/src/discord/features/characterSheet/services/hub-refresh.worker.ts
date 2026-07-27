import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common'
import { CHARACTER_HUB_ERROR_CODES, type CharacterEntity } from '../../../../domains/character/models/character.entity'
import {
  CharacterSheetOperationService,
  resolveHubPreparationErrorCode
} from '../../../../features/character-sheet/services/character-sheet-operation.service'
import { HubDiscordGateway } from '../adapters/hub-discord.gateway'
import { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import { HubProjectionService } from './hub-projection.service'

const SWEEP_INTERVAL_MS = 30_000
const MAX_RATE_LIMIT_ATTEMPTS = 5
const MAX_RATE_LIMIT_BACKOFF_MS = 60_000

/**
 * OP-6 worker。Phase 2 は単一 NestJS プロセス運用を前提とする。
 * スケールアウト時は in-memory 排他を分散 lease に置換する必要がある。
 */
@Injectable()
export class HubRefreshWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(HubRefreshWorker.name)
  private readonly inFlight = new Map<string, Promise<void>>()
  private readonly wakeRequested = new Set<string>()
  private readonly rateLimitRetryAttempts = new Map<string, number>()
  private readonly retryTimers = new Map<string, NodeJS.Timeout>()
  private readonly quarantinedCharacterIds = new Set<string>()
  private sweepTimer?: NodeJS.Timeout
  private sweeping = false

  constructor(
    private readonly operations: CharacterSheetOperationService,
    private readonly projection: HubProjectionService,
    private readonly viewBuilder: HubDiscordViewBuilder,
    private readonly gateway: HubDiscordGateway
  ) {}

  onApplicationBootstrap(): void {
    this.sweepTimer = setInterval(() => void this.sweepSafely(), SWEEP_INTERVAL_MS)
    void this.sweepSafely()
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    for (const timer of this.retryTimers.values()) clearTimeout(timer)
    this.retryTimers.clear()
  }

  wake(characterId: string): void {
    if (this.quarantinedCharacterIds.has(characterId)) {
      this.wakeRequested.delete(characterId)
      return
    }
    if (!this.gateway.isReady()) {
      this.wakeRequested.add(characterId)
      return
    }
    if (this.inFlight.has(characterId)) {
      this.wakeRequested.add(characterId)
      return
    }
    const work = this.processLatest(characterId)
      .catch((error) => this.logger.error(`Hub refresh failed unexpectedly: ${characterId}`, error))
      .finally(() => {
        this.inFlight.delete(characterId)
        if (this.wakeRequested.delete(characterId)) this.wake(characterId)
      })
    this.inFlight.set(characterId, work)
  }

  private async sweepSafely(): Promise<void> {
    if (this.sweeping) return
    this.sweeping = true
    try {
      const candidates = await this.operations.findHubRefreshCandidates()
      if (!this.gateway.isReady()) {
        for (const character of candidates) {
          if (!this.quarantinedCharacterIds.has(character.characterId)) {
            this.wakeRequested.add(character.characterId)
          }
        }
        return
      }

      const characterIds = new Set(
        [...this.wakeRequested, ...candidates.map((character) => character.characterId)].filter(
          (characterId) => !this.quarantinedCharacterIds.has(characterId)
        )
      )
      this.wakeRequested.clear()
      for (const characterId of characterIds) this.wake(characterId)
    } catch (error) {
      this.logger.error('Hub refresh sweep failed', error)
    } finally {
      this.sweeping = false
    }
  }

  private async processLatest(characterId: string): Promise<void> {
    if (!this.gateway.isReady()) return
    while (true) {
      let character: Awaited<ReturnType<CharacterSheetOperationService['getHubCharacter']>>
      try {
        character = await this.operations.getHubCharacter(characterId)
      } catch (error) {
        const errorCode = resolveHubPreparationErrorCode(error) ?? CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED
        await this.markErrorByCharacterId(characterId, errorCode, error)
        return
      }
      if (!this.isEligible(character)) return
      const hub = character.hub
      const revision = character.sheet.revision
      let payload: ReturnType<HubDiscordViewBuilder['buildHubMessage']>
      try {
        payload = this.viewBuilder.buildHubMessage(this.projection.create(character))
      } catch (error) {
        await this.markError(character, CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED, error)
        return
      }
      try {
        await this.gateway.edit(hub.threadId, hub.messageId, payload)
      } catch (error) {
        await this.handleDiscordFailure(character, revision, payload, error)
        return
      }

      let updated: CharacterEntity | null
      try {
        updated = await this.operations.setHubState(
          characterId,
          { status: 'active', messageId: hub.messageId, appliedRevision: hub.appliedRevision },
          { status: 'active', appliedRevision: revision, retryAt: new Date(0) }
        )
      } catch (error) {
        this.logger.error(`Hub refresh edit succeeded but appliedRevision persistence failed: ${characterId}`, error)
        return
      }
      if (updated === null) {
        this.logger.error(`Hub refresh edit succeeded but appliedRevision CAS did not match: ${characterId}`)
        return
      }
      this.rateLimitRetryAttempts.delete(characterId)
    }
  }

  private isEligible(character: CharacterEntity | null): character is CharacterEntity & {
    sheet: NonNullable<CharacterEntity['sheet']>
    hub: NonNullable<CharacterEntity['hub']> & { status: 'active'; messageId: string; threadId: string }
  } {
    if (character?.sheet === undefined || character.hub?.status !== 'active') return false
    if (!character.hub.messageId || !character.hub.threadId) return false
    if (character.hub.retryAt && character.hub.retryAt.getTime() > Date.now()) return false
    return (character.hub.pendingRevision ?? 0) > (character.hub.appliedRevision ?? 0)
  }

  private async handleDiscordFailure(
    character: CharacterEntity & { sheet: NonNullable<CharacterEntity['sheet']> },
    revision: number,
    payload: ReturnType<HubDiscordViewBuilder['buildHubMessage']>,
    error: unknown
  ): Promise<void> {
    const code = this.errorCode(error)
    if (code === 10_008) {
      await this.repostUnknownMessage(character, revision, payload)
      return
    }
    if (code === 10_003 || code === 50_001 || code === 50_013) {
      await this.markError(character, 'MISSING_ACCESS', error)
      return
    }
    if (code === 429 || (error as { status?: unknown }).status === 429) {
      await this.backoffRateLimit(character)
      return
    }
    await this.markError(character, 'REFRESH_FAILED', error)
  }

  private async repostUnknownMessage(
    character: CharacterEntity,
    revision: number,
    payload: ReturnType<HubDiscordViewBuilder['buildHubMessage']>
  ): Promise<void> {
    const hub = character.hub!
    try {
      const message = await this.gateway.send(hub.threadId!, payload)
      const updated = await this.operations.setHubState(
        character.characterId,
        { status: 'active', messageId: hub.messageId },
        { status: 'active', messageId: message.id, appliedRevision: revision, retryAt: new Date(0) }
      )
      if (updated === null) {
        await this.markError(
          character,
          'UNKNOWN_MESSAGE_REPOST_UNTRACKED',
          new Error('Unknown Message repost succeeded but messageId CAS failed')
        )
        return
      }
      this.rateLimitRetryAttempts.delete(character.characterId)
    } catch (error) {
      await this.markError(character, 'UNKNOWN_MESSAGE_REPOST_FAILED', error)
    }
  }

  private async backoffRateLimit(character: CharacterEntity): Promise<void> {
    const attempts = (this.rateLimitRetryAttempts.get(character.characterId) ?? 0) + 1
    if (attempts > MAX_RATE_LIMIT_ATTEMPTS) {
      // error 遷移で今回のサイクルは終わり。手動復旧後の 429 に再試行予算を残す。
      this.rateLimitRetryAttempts.delete(character.characterId)
      this.clearRetryTimer(character.characterId)
      await this.markError(character, 'RATE_LIMIT_EXHAUSTED', new Error('Discord 429 retry budget exhausted'))
      return
    }
    this.rateLimitRetryAttempts.set(character.characterId, attempts)
    const delay = Math.min(1_000 * 2 ** (attempts - 1), MAX_RATE_LIMIT_BACKOFF_MS)
    const retryAt = new Date(Date.now() + delay)
    const updated = await this.operations.setHubState(
      character.characterId,
      { status: 'active', messageId: character.hub?.messageId },
      { status: 'active', retryAt }
    )
    if (updated === null) return
    this.scheduleRetryWake(character.characterId, delay)
  }

  private scheduleRetryWake(characterId: string, delay: number): void {
    this.clearRetryTimer(characterId)
    this.retryTimers.set(
      characterId,
      setTimeout(() => {
        this.retryTimers.delete(characterId)
        this.wake(characterId)
      }, delay)
    )
  }

  private clearRetryTimer(characterId: string): void {
    const timer = this.retryTimers.get(characterId)
    if (timer) clearTimeout(timer)
    this.retryTimers.delete(characterId)
  }

  private async markError(character: CharacterEntity, errorCode: string, error: unknown): Promise<void> {
    this.logger.error(`Hub refresh entered error state: ${character.characterId} (${errorCode})`, error)
    let updated: CharacterEntity | null
    try {
      updated = await this.operations.setHubState(
        character.characterId,
        { status: 'active', messageId: character.hub?.messageId },
        { status: 'error', errorCode }
      )
    } catch (writeError) {
      this.quarantine(character.characterId, `terminal state write rejected: ${errorCode}`, writeError)
      return
    }
    if (updated === null) {
      this.quarantine(character.characterId, `terminal state CAS did not match: ${errorCode}`)
    }
  }

  private async markErrorByCharacterId(characterId: string, errorCode: string, error: unknown): Promise<void> {
    this.logger.error(`Hub refresh entered error state: ${characterId} (${errorCode})`, error)
    let updated: CharacterEntity | null
    try {
      updated = await this.operations.markHubRefreshError(characterId, errorCode)
    } catch (writeError) {
      this.quarantine(characterId, `terminal state write rejected: ${errorCode}`, writeError)
      return
    }
    if (updated === null) {
      this.quarantine(characterId, `terminal state CAS did not match: ${errorCode}`)
    }
  }

  private quarantine(characterId: string, reason: string, error?: unknown): void {
    if (this.quarantinedCharacterIds.has(characterId)) return
    this.quarantinedCharacterIds.add(characterId)
    this.wakeRequested.delete(characterId)
    this.rateLimitRetryAttempts.delete(characterId)
    this.clearRetryTimer(characterId)
    this.logger.error(`Hub refresh quarantined: ${characterId} (${reason})`, error)
  }

  private errorCode(error: unknown): number | undefined {
    const value =
      (error as { code?: unknown; rawError?: { code?: unknown } }).code ??
      (error as { rawError?: { code?: unknown } }).rawError?.code
    const code = Number(value)
    return Number.isFinite(code) ? code : undefined
  }
}
