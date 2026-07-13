import type { CharacterEntity } from '../../../../domains/character/models/character.entity'
import type { CharacterSheetOperationService } from '../../../../features/character-sheet/services/character-sheet-operation.service'
import type { HubDiscordGateway } from '../adapters/hub-discord.gateway'
import type { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import type { HubProjectionService } from './hub-projection.service'
import { HubPublicationService } from './hub-publication.service'
import type { HubRefreshWorker } from './hub-refresh.worker'

function character(status: 'none' | 'publishing' | 'active' | 'error', revision = 4): CharacterEntity {
  return {
    characterId: 'char-1',
    gameSystemId: 'coc',
    status: {},
    skill: {},
    parameter: {},
    item: {},
    description: {},
    characterName: 'Alice',
    discordUserId: 'owner-1',
    discordChannelId: '123456789012345678',
    sheet: { templateId: 'tpl', templateVersion: '1', revision, values: {} },
    hub: { status, ...(status === 'publishing' ? { opId: 'op' } : {}) },
    palette: []
  } as CharacterEntity
}

describe('HubPublicationService', () => {
  let operations: { getHubCharacter: jest.Mock; setHubState: jest.Mock }
  let projection: { create: jest.Mock }
  let builder: { buildHubMessage: jest.Mock }
  let gateway: { send: jest.Mock }
  let worker: { wake: jest.Mock }
  let service: HubPublicationService

  beforeEach(() => {
    operations = { getHubCharacter: jest.fn(), setHubState: jest.fn() }
    projection = { create: jest.fn().mockReturnValue({ hub: {}, warnings: [] }) }
    builder = { buildHubMessage: jest.fn().mockReturnValue({ embeds: [] }) }
    gateway = { send: jest.fn() }
    worker = { wake: jest.fn() }
    service = new HubPublicationService(
      operations as unknown as CharacterSheetOperationService,
      projection as unknown as HubProjectionService,
      builder as unknown as HubDiscordViewBuilder,
      gateway as unknown as HubDiscordGateway
    )
    service.connectRefreshWorker(worker as unknown as HubRefreshWorker)
  })

  it('T-21: none→publishing CAS競合ではDiscord投稿を行わない', async () => {
    operations.getHubCharacter.mockResolvedValue(character('none'))
    operations.setHubState.mockResolvedValue(null)

    await service.postHub('char-1', 'thread-1')

    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('T-21: 同時実行の2つのpostHubが両方noneを読んでも、送信は勝者の1回だけ', async () => {
    operations.getHubCharacter.mockResolvedValue(character('none'))
    let casArrivals = 0
    let releaseCas!: () => void
    const casBarrier = new Promise<void>((resolve) => (releaseCas = resolve))
    operations.setHubState.mockImplementation(async (_id: string, from: { status: string }) => {
      if (from.status === 'none') {
        casArrivals += 1
        const winner = casArrivals === 1
        await casBarrier
        return winner ? character('publishing') : null
      }
      return character('active')
    })
    gateway.send.mockResolvedValue({ id: 'message-1' })

    const first = service.postHub('char-1', 'thread-1')
    const second = service.postHub('char-1', 'thread-1')
    for (let attempt = 0; attempt < 20 && casArrivals < 2; attempt += 1) {
      await new Promise((resolve) => setImmediate(resolve))
    }
    expect(casArrivals).toBe(2)
    releaseCas()
    await Promise.all([first, second])

    expect(gateway.send).toHaveBeenCalledTimes(1)
    expect(operations.setHubState).toHaveBeenLastCalledWith(
      'char-1',
      expect.objectContaining({ status: 'publishing' }),
      expect.objectContaining({ status: 'active', messageId: 'message-1' })
    )
  })

  it('T-7: 不確定失敗はerrorへ遷移し自動再投稿しない', async () => {
    const none = character('none')
    const publishing = character('publishing')
    operations.getHubCharacter.mockResolvedValueOnce(none).mockResolvedValueOnce(character('error'))
    operations.setHubState.mockResolvedValueOnce(publishing).mockResolvedValueOnce(character('error'))
    gateway.send.mockRejectedValue(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))

    await service.postHub('char-1', 'thread-1')
    await service.postHub('char-1', 'thread-1')

    expect(operations.setHubState).toHaveBeenLastCalledWith(
      'char-1',
      expect.objectContaining({ status: 'publishing' }),
      { status: 'error', errorCode: 'POSTED_BUT_UNTRACKED' }
    )
    expect(gateway.send).toHaveBeenCalledTimes(1)
  })

  it('T-7: projection失敗は副作用開始前なのでnoneへ戻す', async () => {
    operations.getHubCharacter.mockResolvedValue(character('none'))
    operations.setHubState.mockResolvedValueOnce(character('publishing')).mockResolvedValueOnce(character('none'))
    projection.create.mockImplementation(() => {
      throw new Error('projection failed')
    })

    await service.postHub('char-1', 'thread-1')

    expect(operations.setHubState).toHaveBeenLastCalledWith(
      'char-1',
      expect.objectContaining({ status: 'publishing' }),
      { status: 'none' }
    )
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('T-7: Discordが非投稿を確定できる失敗はnoneへ戻す', async () => {
    operations.getHubCharacter.mockResolvedValue(character('none'))
    operations.setHubState.mockResolvedValueOnce(character('publishing')).mockResolvedValueOnce(character('none'))
    gateway.send.mockRejectedValue(Object.assign(new Error('Missing Access'), { code: 50_001 }))

    await service.postHub('char-1', 'thread-1')

    expect(operations.setHubState).toHaveBeenLastCalledWith(
      'char-1',
      expect.objectContaining({ status: 'publishing' }),
      { status: 'none' }
    )
  })

  it('T-24: CAS戻り値の投稿revisionをappliedにし、投稿中saveのpendingをworkerへ渡す', async () => {
    const publishing = character('publishing', 4)
    const active = { ...character('active', 5), hub: { status: 'active' as const, pendingRevision: 5 } }
    operations.getHubCharacter.mockResolvedValue(character('none', 3))
    operations.setHubState.mockResolvedValueOnce(publishing).mockResolvedValueOnce(active)
    gateway.send.mockResolvedValue({ id: 'message-1' })

    await service.postHub('char-1', 'thread-1')

    expect(projection.create).toHaveBeenCalledWith(publishing)
    expect(operations.setHubState).toHaveBeenLastCalledWith(
      'char-1',
      expect.objectContaining({ status: 'publishing' }),
      expect.objectContaining({ status: 'active', appliedRevision: 4, messageId: 'message-1' })
    )
    expect(worker.wake).toHaveBeenCalledWith('char-1')
  })
})
