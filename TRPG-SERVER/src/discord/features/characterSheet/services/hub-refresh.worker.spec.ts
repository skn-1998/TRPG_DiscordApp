import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { CHARACTER_HUB_ERROR_CODES } from '../../../../domains/character/models/character.entity'
import {
  HubProjectionPreparationError,
  type CharacterSheetOperationService,
  type HubProjectionCharacter
} from '../../../../features/character-sheet/services/character-sheet-operation.service'
import type { HubDiscordGateway } from '../adapters/hub-discord.gateway'
import type { HubDiscordViewBuilder } from '../adapters/hub-discord-view.builder'
import type { HubProjectionService } from './hub-projection.service'
import { HubRefreshWorker } from './hub-refresh.worker'

function activeCharacter(revision: number, pending: number, applied: number): HubProjectionCharacter {
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
    hub: {
      status: 'active',
      opId: 'op-1',
      threadId: 'thread-1',
      messageId: 'message-1',
      pendingRevision: pending,
      appliedRevision: applied
    },
    palette: [],
    resolvedResourceValues: { 'uid-hp': 10 }
  }
}

describe('HubRefreshWorker', () => {
  let operations: {
    getHubCharacter: jest.Mock
    setHubState: jest.Mock
    findHubRefreshCandidates: jest.Mock
    markHubRefreshError: jest.Mock
  }
  let gateway: { isReady: jest.Mock; edit: jest.Mock; send: jest.Mock }
  let projection: { create: jest.Mock }
  let worker: HubRefreshWorker

  beforeEach(() => {
    operations = {
      getHubCharacter: jest.fn(),
      setHubState: jest.fn(),
      findHubRefreshCandidates: jest.fn().mockResolvedValue([]),
      markHubRefreshError: jest.fn()
    }
    gateway = { isReady: jest.fn().mockReturnValue(true), edit: jest.fn(), send: jest.fn() }
    projection = { create: jest.fn().mockReturnValue({ hub: {}, warnings: [] }) }
    worker = new HubRefreshWorker(
      operations as unknown as CharacterSheetOperationService,
      projection as unknown as HubProjectionService,
      { buildHubMessage: jest.fn().mockReturnValue({ embeds: [] }) } as unknown as HubDiscordViewBuilder,
      gateway as unknown as HubDiscordGateway
    )
  })

  afterEach(() => worker.onModuleDestroy())

  it.each([
    ['ConflictException', new ConflictException('sheet template must be published at the requested version')],
    ['NotFoundException', new NotFoundException('sheet template not found')],
    ['ForbiddenException', new ForbiddenException('sheet template is not accessible')]
  ])('%sは初回でTEMPLATE_UNRESOLVABLEへ終端する', async (_name, resolutionError) => {
    operations.getHubCharacter.mockRejectedValue(resolutionError)
    operations.markHubRefreshError.mockResolvedValue({
      ...activeCharacter(2, 2, 1),
      hub: {
        status: 'error',
        errorCode: CHARACTER_HUB_ERROR_CODES.TEMPLATE_UNRESOLVABLE
      }
    })

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(operations.getHubCharacter).toHaveBeenCalledTimes(1)
    expect(operations.markHubRefreshError).toHaveBeenCalledWith(
      'char-1',
      CHARACTER_HUB_ERROR_CODES.TEMPLATE_UNRESOLVABLE
    )
    expect(gateway.edit).not.toHaveBeenCalled()
    expect((worker as unknown as { retryTimers: Map<string, unknown> }).retryTimers.size).toBe(0)
    expect((worker as unknown as { rateLimitRetryAttempts: Map<string, number> }).rateLimitRetryAttempts.size).toBe(0)
  })

  it('投影準備中のUnprocessableEntityExceptionはPROJECTION_FAILEDへ遷移する', async () => {
    const projectionError = new HubProjectionPreparationError(
      new UnprocessableEntityException('resource evaluation failed')
    )
    operations.getHubCharacter.mockRejectedValue(projectionError)
    operations.markHubRefreshError.mockResolvedValue({
      ...activeCharacter(2, 2, 1),
      hub: {
        status: 'error',
        errorCode: CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED
      }
    })

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(operations.markHubRefreshError).toHaveBeenCalledWith('char-1', CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED)
    expect(operations.getHubCharacter).toHaveBeenCalledTimes(1)
    expect(gateway.edit).not.toHaveBeenCalled()
    expect((worker as unknown as { retryTimers: Map<string, unknown> }).retryTimers.size).toBe(0)
    expect((worker as unknown as { rateLimitRetryAttempts: Map<string, number> }).rateLimitRetryAttempts.size).toBe(0)
  })

  it('分類外のread Errorは初回でPROJECTION_FAILEDへ終端する', async () => {
    operations.getHubCharacter.mockRejectedValue(new Error('mongo unavailable'))
    operations.markHubRefreshError.mockResolvedValue({
      ...activeCharacter(2, 2, 1),
      hub: {
        status: 'error',
        errorCode: CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED
      }
    })

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(operations.getHubCharacter).toHaveBeenCalledTimes(1)
    expect(operations.markHubRefreshError).toHaveBeenCalledWith('char-1', CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED)
    expect(gateway.edit).not.toHaveBeenCalled()
    expect((worker as unknown as { retryTimers: Map<string, unknown> }).retryTimers.size).toBe(0)
    expect((worker as unknown as { rateLimitRetryAttempts: Map<string, number> }).rateLimitRetryAttempts.size).toBe(0)
  })

  it('read-pathの終端書き込みreject後は同じcharacterを次sweepで再実行しない', async () => {
    operations.findHubRefreshCandidates.mockResolvedValue([activeCharacter(2, 2, 1)])
    operations.getHubCharacter.mockRejectedValue(new Error('read failed'))
    operations.markHubRefreshError.mockRejectedValue(new Error('terminal write rejected'))
    const logger = (worker as unknown as { logger: { error: jest.Mock } }).logger
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)

    await (worker as unknown as { sweepSafely(): Promise<void> }).sweepSafely()
    await waitForIdle(worker)
    worker.wake('char-1')
    await waitForIdle(worker)
    const wakeSpy = jest.spyOn(worker, 'wake')
    await (worker as unknown as { sweepSafely(): Promise<void> }).sweepSafely()
    await waitForIdle(worker)

    expect(operations.findHubRefreshCandidates).toHaveBeenCalledTimes(2)
    expect(wakeSpy).not.toHaveBeenCalled()
    expect(operations.getHubCharacter).toHaveBeenCalledTimes(1)
    expect(operations.markHubRefreshError).toHaveBeenCalledTimes(1)
    expect(projection.create).not.toHaveBeenCalled()
    expect(gateway.edit).not.toHaveBeenCalled()
    expect((worker as unknown as { quarantinedCharacterIds: Set<string> }).quarantinedCharacterIds).toContain('char-1')
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Hub refresh quarantined: char-1 (terminal state write rejected'),
      expect.any(Error)
    )
  })

  it('markErrorのCAS null後は同じcharacterを次sweepで再実行しない', async () => {
    operations.findHubRefreshCandidates.mockResolvedValue([activeCharacter(2, 2, 1)])
    operations.getHubCharacter.mockResolvedValue(activeCharacter(2, 2, 1))
    projection.create.mockImplementation(() => {
      throw new Error('projection failed')
    })
    operations.setHubState.mockResolvedValue(null)
    const logger = (worker as unknown as { logger: { error: jest.Mock } }).logger
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)

    await (worker as unknown as { sweepSafely(): Promise<void> }).sweepSafely()
    await waitForIdle(worker)
    await (worker as unknown as { sweepSafely(): Promise<void> }).sweepSafely()
    await waitForIdle(worker)

    expect(operations.findHubRefreshCandidates).toHaveBeenCalledTimes(2)
    expect(operations.getHubCharacter).toHaveBeenCalledTimes(1)
    expect(projection.create).toHaveBeenCalledTimes(1)
    expect(gateway.edit).not.toHaveBeenCalled()
    expect((worker as unknown as { quarantinedCharacterIds: Set<string> }).quarantinedCharacterIds).toContain('char-1')
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Hub refresh quarantined: char-1 (terminal state CAS did not match'),
      undefined
    )
  })

  it('終端書き込み成功時はquarantineしない', async () => {
    operations.getHubCharacter.mockRejectedValue(new Error('read failed'))
    operations.markHubRefreshError.mockResolvedValue({
      ...activeCharacter(2, 2, 1),
      hub: { status: 'error', errorCode: CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED }
    })

    worker.wake('char-1')
    await waitForIdle(worker)

    expect((worker as unknown as { quarantinedCharacterIds: Set<string> }).quarantinedCharacterIds).not.toContain(
      'char-1'
    )
  })

  it('1周目成功後のeligibility確認fetch失敗もPROJECTION_FAILEDへ終端する', async () => {
    operations.getHubCharacter
      .mockResolvedValueOnce(activeCharacter(2, 2, 1))
      .mockRejectedValueOnce(new Error('temporary fetch failure'))
    operations.setHubState.mockResolvedValue(activeCharacter(2, 2, 2))
    operations.markHubRefreshError.mockResolvedValue({
      ...activeCharacter(2, 2, 1),
      hub: {
        status: 'error',
        errorCode: CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED
      }
    })
    gateway.edit.mockResolvedValue(undefined)

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(gateway.edit).toHaveBeenCalledTimes(1)
    expect(operations.getHubCharacter).toHaveBeenCalledTimes(2)
    expect(operations.markHubRefreshError).toHaveBeenCalledWith('char-1', CHARACTER_HUB_ERROR_CODES.PROJECTION_FAILED)
  })

  it('T-8: deferred edit中の2回wakeをcoalesceし、同時1・最後は最新revisionへ収束する', async () => {
    let resolveFirst!: () => void
    const firstEdit = new Promise<void>((resolve) => (resolveFirst = resolve))
    let concurrent = 0
    let maxConcurrent = 0
    gateway.edit.mockImplementationOnce(async () => {
      concurrent += 1
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      await firstEdit
      concurrent -= 1
    })
    gateway.edit.mockImplementationOnce(async () => {
      concurrent += 1
      maxConcurrent = Math.max(maxConcurrent, concurrent)
      concurrent -= 1
    })
    operations.getHubCharacter
      .mockResolvedValueOnce(activeCharacter(2, 2, 1))
      .mockResolvedValueOnce(activeCharacter(3, 3, 2))
      .mockResolvedValueOnce(activeCharacter(3, 3, 3))
      .mockResolvedValue(activeCharacter(3, 3, 3))
    operations.setHubState
      .mockResolvedValueOnce(activeCharacter(3, 3, 2))
      .mockResolvedValueOnce(activeCharacter(3, 3, 3))

    worker.wake('char-1')
    await thisTurn()
    worker.wake('char-1')
    worker.wake('char-1')
    resolveFirst()
    await waitForIdle(worker)

    expect(maxConcurrent).toBe(1)
    expect(gateway.edit).toHaveBeenCalledTimes(2)
    expect(operations.setHubState).toHaveBeenLastCalledWith(
      'char-1',
      expect.objectContaining({ status: 'active' }),
      expect.objectContaining({ appliedRevision: 3 })
    )
  })

  it('T-9a: Unknown Messageは同じVMを再投稿してmessageIdを更新する', async () => {
    operations.getHubCharacter.mockResolvedValue(activeCharacter(2, 2, 1))
    gateway.edit.mockRejectedValue(Object.assign(new Error('Unknown Message'), { code: 10_008 }))
    gateway.send.mockResolvedValue({ id: 'message-2' })
    operations.setHubState.mockResolvedValue(activeCharacter(2, 2, 2))

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(gateway.send).toHaveBeenCalledTimes(1)
    expect(operations.setHubState).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ messageId: 'message-1' }),
      expect.objectContaining({ messageId: 'message-2', appliedRevision: 2 })
    )
  })

  it.each([10_003, 50_001, 50_013])('T-9b: Missing Access/channel消失(%s)は非retryのerrorへ遷移する', async (code) => {
    operations.getHubCharacter.mockResolvedValue(activeCharacter(2, 2, 1))
    gateway.edit.mockRejectedValue(Object.assign(new Error('Missing Access'), { code }))
    operations.setHubState.mockResolvedValue({ ...activeCharacter(2, 2, 1), hub: { status: 'error' } })

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(operations.setHubState).toHaveBeenCalledWith('char-1', expect.objectContaining({ status: 'active' }), {
      status: 'error',
      errorCode: 'MISSING_ACCESS'
    })
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('T-9c: 429はretryAtをCAS保存してbackoffする', async () => {
    operations.getHubCharacter.mockResolvedValue(activeCharacter(2, 2, 1))
    gateway.edit.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }))
    operations.setHubState.mockResolvedValue(activeCharacter(2, 2, 1))

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(operations.setHubState).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ status: 'active' }),
      expect.objectContaining({ status: 'active', retryAt: expect.any(Date) })
    )
  })

  it('T-9c: backoff timer発火で再試行し、成功で完了する', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
    try {
      // 再取得された doc は backoff CAS 済みの実状態形状（retryAt あり）。timer 発火時刻＝retryAt 境界で gate が開くことも固定する。
      const retryReady = activeCharacter(2, 2, 1)
      retryReady.hub = { ...retryReady.hub!, retryAt: new Date(Date.now() + 1_000) }
      operations.getHubCharacter
        .mockResolvedValueOnce(activeCharacter(2, 2, 1))
        .mockResolvedValueOnce(retryReady)
        .mockResolvedValue(activeCharacter(2, 2, 2))
      gateway.edit
        .mockRejectedValueOnce(Object.assign(new Error('rate limited'), { status: 429 }))
        .mockResolvedValueOnce(undefined)
      operations.setHubState.mockResolvedValue(activeCharacter(2, 2, 2))

      worker.wake('char-1')
      await waitForIdle(worker)
      expect(gateway.edit).toHaveBeenCalledTimes(1)

      jest.advanceTimersByTime(1_000)
      await waitForIdle(worker)

      expect(gateway.edit).toHaveBeenCalledTimes(2)
      expect(operations.setHubState).toHaveBeenLastCalledWith(
        'char-1',
        expect.objectContaining({ status: 'active' }),
        expect.objectContaining({ status: 'active', appliedRevision: 2 })
      )
      expect((worker as unknown as { rateLimitRetryAttempts: Map<string, number> }).rateLimitRetryAttempts.size).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })

  it('T-9c: 429が上限(5回)を超えるとRATE_LIMIT_EXHAUSTEDのerrorへ遷移しtimerも残らない', async () => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] })
    try {
      operations.getHubCharacter.mockResolvedValue(activeCharacter(2, 2, 1))
      gateway.edit.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }))
      operations.setHubState.mockResolvedValue(activeCharacter(2, 2, 1))

      worker.wake('char-1')
      await waitForIdle(worker)
      for (let round = 0; round < 5; round += 1) {
        jest.advanceTimersByTime(60_000)
        await waitForIdle(worker)
      }

      expect(gateway.edit).toHaveBeenCalledTimes(6)
      expect(operations.setHubState).toHaveBeenLastCalledWith('char-1', expect.objectContaining({ status: 'active' }), {
        status: 'error',
        errorCode: 'RATE_LIMIT_EXHAUSTED'
      })
      expect((worker as unknown as { retryTimers: Map<string, unknown> }).retryTimers.size).toBe(0)
      expect((worker as unknown as { rateLimitRetryAttempts: Map<string, number> }).rateLimitRetryAttempts.size).toBe(0)
    } finally {
      jest.useRealTimers()
    }
  })

  it('Discord edit成功後のappliedRevision永続化失敗はerror遷移せず次sweepへ残す', async () => {
    operations.getHubCharacter.mockResolvedValue(activeCharacter(2, 2, 1))
    gateway.edit.mockResolvedValue(undefined)
    operations.setHubState.mockRejectedValue(new Error('mongo unavailable'))
    const logger = (worker as unknown as { logger: { error: jest.Mock } }).logger
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(gateway.edit).toHaveBeenCalledTimes(1)
    expect(operations.setHubState).toHaveBeenCalledTimes(1)
    expect(operations.setHubState).toHaveBeenCalledWith(
      'char-1',
      expect.objectContaining({ status: 'active', appliedRevision: 1 }),
      expect.objectContaining({ status: 'active', appliedRevision: 2 })
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('edit succeeded but appliedRevision persistence failed'),
      expect.any(Error)
    )
    expect(gateway.send).not.toHaveBeenCalled()
  })

  it('Discord edit成功後のappliedRevision CAS不一致もerror遷移しない', async () => {
    operations.getHubCharacter.mockResolvedValue(activeCharacter(2, 2, 1))
    gateway.edit.mockResolvedValue(undefined)
    operations.setHubState.mockResolvedValue(null)
    const logger = (worker as unknown as { logger: { error: jest.Mock } }).logger
    const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined)

    worker.wake('char-1')
    await waitForIdle(worker)

    expect(operations.setHubState).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('appliedRevision CAS did not match'))
    expect(gateway.send).not.toHaveBeenCalled()
  })
})

function thisTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

async function waitForIdle(worker: HubRefreshWorker): Promise<void> {
  const state = worker as unknown as { inFlight: Map<string, Promise<void>> }
  for (let attempt = 0; attempt < 20 && state.inFlight.size > 0; attempt += 1) await thisTurn()
}
