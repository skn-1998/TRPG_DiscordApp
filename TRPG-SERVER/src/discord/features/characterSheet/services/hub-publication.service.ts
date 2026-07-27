import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import type { CharacterEntity } from '../../../../domains/character/models/character.entity'
import {
  CharacterSheetOperationService,
  HubProjectionPreparationError,
  resolveHubPreparationErrorCode
} from '../../../../features/character-sheet/services/character-sheet-operation.service'
import { HubDiscordGateway } from '../adapters/hub-discord.gateway'
import { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import { HubProjectionService } from './hub-projection.service'
import type { HubRefreshWorker } from './hub-refresh.worker'

const POSTED_BUT_UNTRACKED = 'POSTED_BUT_UNTRACKED'

@Injectable()
export class HubPublicationService {
  private readonly logger = new Logger(HubPublicationService.name)
  private refreshWorker?: HubRefreshWorker

  constructor(
    private readonly operations: CharacterSheetOperationService,
    private readonly projection: HubProjectionService,
    private readonly viewBuilder: HubDiscordViewBuilder,
    private readonly gateway: HubDiscordGateway
  ) {}

  /** Worker との循環 DI を避け、module 初期化時に wake port だけを接続する。 */
  connectRefreshWorker(worker: HubRefreshWorker): void {
    this.refreshWorker = worker
  }

  async postHub(characterId: string, threadId: string): Promise<void> {
    const character = await this.operations.getHubCharacter(characterId)
    if (character === null || character.sheet === undefined || character.hub?.status !== 'none') return
    // 未紐付けsentinelは空文字列とし、非空の不正snowflakeは拒否せずprojection warningで可視化する。
    if (!character.discordChannelId) {
      this.logger.warn(`Hub post skipped because discordChannelId is not linked: ${characterId}`)
      return
    }

    const opId = randomUUID()
    let publishing: Awaited<ReturnType<CharacterSheetOperationService['setHubState']>>
    try {
      publishing = await this.operations.setHubState(
        characterId,
        { status: 'none' },
        { status: 'publishing', opId, threadId }
      )
    } catch (error) {
      await this.settlePreparationFailure(characterId, opId, error)
      return
    }
    if (publishing === null || publishing.sheet === undefined) return

    // CAS 前の保存と競合しても、CAS 戻り値の最新 snapshot/revision を投稿する。
    // pendingRevision は materialized save 専有のため、ここでは上書きしない。
    const revision = publishing.sheet.revision

    let payload: ReturnType<HubDiscordViewBuilder['buildHubMessage']>
    try {
      const projection = this.projection.create(publishing)
      if (projection.warnings.length > 0) {
        // code@path（path 無しは code）を重複排除キーとし、先頭10件と残ユニーク数を表示する。
        const uniqueWarningKeys: string[] = []
        const seenWarningKeys = new Set<string>()
        for (const warning of projection.warnings) {
          const warningKey = warning.path === undefined ? warning.code : `${warning.code}@${warning.path}`
          if (seenWarningKeys.has(warningKey)) continue
          seenWarningKeys.add(warningKey)
          uniqueWarningKeys.push(warningKey)
        }
        const rendered = uniqueWarningKeys.slice(0, 10).join(' | ')
        const remaining = Math.max(0, uniqueWarningKeys.length - 10)
        const suffix = remaining > 0 ? ` (+${remaining} more unique keys)` : ''
        this.logger.warn(
          `Hub projection warnings for ${characterId} (${projection.warnings.length} warnings / ${uniqueWarningKeys.length} unique keys): ${rendered}${suffix}`
        )
      }
      payload = this.viewBuilder.buildHubMessage(projection)
    } catch (error) {
      await this.settlePreparationFailure(characterId, opId, new HubProjectionPreparationError(error))
      return
    }

    let messageId: string
    try {
      messageId = (await this.gateway.send(threadId, payload)).id
    } catch (error) {
      if (this.isCertainNoSideEffect(error)) {
        await this.operations.setHubState(characterId, { status: 'publishing', opId }, { status: 'none' })
      } else {
        await this.markPostedButUntracked(characterId, opId, error)
      }
      return
    }

    let active: CharacterEntity | null
    try {
      active = await this.operations.setHubState(
        characterId,
        { status: 'publishing', opId },
        { status: 'active', messageId, threadId, appliedRevision: revision }
      )
    } catch (error) {
      await this.markPostedButUntracked(characterId, opId, error)
      return
    }
    if (active === null) {
      await this.markPostedButUntracked(characterId, opId, new Error('publishing to active CAS failed'))
      return
    }

    if ((active.hub?.pendingRevision ?? revision) > revision) this.refreshWorker?.wake(characterId)
  }

  private async settlePreparationFailure(characterId: string, opId: string, error: unknown): Promise<void> {
    const errorCode = resolveHubPreparationErrorCode(error)
    this.logger.error(
      `Hub preparation failed before Discord send: ${characterId}${errorCode ? ` (${errorCode})` : ''}`,
      error
    )
    try {
      if (errorCode) {
        await this.operations.setHubState(characterId, { status: 'publishing', opId }, { status: 'error', errorCode })
        return
      }
      await this.operations.setHubState(characterId, { status: 'publishing', opId }, { status: 'none' })
    } catch (casError) {
      this.logger.error(`Failed to persist hub preparation failure state: ${characterId}`, casError)
    }
  }

  private async markPostedButUntracked(characterId: string, opId: string, error: unknown): Promise<void> {
    this.logger.error(`Hub post side effect is uncertain for ${characterId}; automatic repost is disabled`, error)
    try {
      await this.operations.setHubState(
        characterId,
        { status: 'publishing', opId },
        { status: 'error', errorCode: POSTED_BUT_UNTRACKED }
      )
    } catch (casError) {
      this.logger.error(`Failed to persist posted-but-untracked state: ${characterId}`, casError)
    }
  }

  private isCertainNoSideEffect(error: unknown): boolean {
    const value = error as { status?: unknown; code?: unknown; sideEffectOccurred?: unknown }
    if (value.sideEffectOccurred === false) return true
    if (value.status === 429) return true
    const code = typeof value.code === 'number' ? value.code : Number(value.code)
    return [10_003, 50_001, 50_013, 50_035].includes(code)
  }
}
