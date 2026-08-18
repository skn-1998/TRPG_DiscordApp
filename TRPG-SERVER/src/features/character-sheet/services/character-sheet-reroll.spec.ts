/**
 * 作成時ロールの振り直し（CharacterSheetOperationService.rerollCreationRoll）を検証する。
 *
 * 併せて次の不変条件を機械で固定する。どれも壊しても他の spec は緑のまま通るため、
 * ここで明示的に表明する。
 * - 対象条件は「作成時ロールの記法を宣言しているか」であり、入力可能な型かどうかではない
 * - 出目はサーバだけが決める（操作の入力に値を混ぜても保存されるのはサーバ実行の結果）
 * - roll 型はクライアント提出（saveSheet）の入力項目にならないまま
 * - 内訳を持てる項目の振り直しは行き先キーだけを差し替え、他の内訳（± が積む parts.other）を残す
 * - 保存形は作成時（CharacterInstantiationService.applyRollOnCreate）と一致する
 * - 拒否経路は保存自体を試みない（値も revision も動かないのは fixture 上その帰結。
 *   保存が走る唯一の失敗系である CAS 敗北の原子性は本 spec の対象外）
 *
 * T-R1〜T-R5 の正本: document/character-sheet-proposals/roll-lane-framing.md の One-condition Tests 表。
 *
 * 必要な前提: repository / templateService / materializer / diceExecutionService はすべてモック。
 * ダイスの実出目には依存せず、DiceExecutionService が返した値がそのまま保存されることだけを見る。
 */
import { ConflictException, HttpException, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import type { CharacterEntity, SaveSheetMaterializedPayload } from '../../../domains/character/models/character.entity'
import type { CharacterRepository } from '../../../domains/character/repositories/character.repository'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import type { CharacterSheetTemplateService } from '../../../domains/character-sheet-template/character-sheet-template.service'
import type { DiceExecutionService } from '../../../domains/dice-roll/services/dice-execution.service'
import { CharacterSheetOperationService, type RerollCreationRollInput } from './character-sheet-operation.service'
import type { SheetMaterializerService } from './sheet-materializer.service'

describe('CharacterSheetOperationService 作成時ロールの振り直し', () => {
  const ROLLED_TOTAL = 55
  const ROLLED_DETAILS = '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55'

  const template: CharacterSheetTemplateEntity = {
    templateId: 'template-1',
    status: 'published',
    version: '1.0.0',
    schemaVersion: 3,
    name: 'Template',
    gameSystemId: 'DiceBot',
    tags: [],
    visibility: 'public',
    authorDiscordUserId: 'owner-1',
    sections: [
      {
        id: 'status',
        label: 'Status',
        fields: [
          {
            id: 'hp',
            uid: 'uid-hp',
            label: 'HP',
            type: 'track',
            min: 0,
            max: 100,
            style: 'gauge',
            rollOnCreate: { notation: '3d6*5' }
          },
          {
            id: 'dex',
            uid: 'uid-dex',
            label: 'DEX',
            type: 'roll',
            notation: '1d100'
          },
          {
            id: 'score',
            uid: 'uid-score',
            label: 'Score',
            type: 'scalar',
            valueType: 'number'
          }
        ]
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  const projection = { status: {}, parameter: {}, skill: {}, item: {}, description: {} }

  const initialValues: Record<string, unknown> = { 'uid-hp': 40, 'uid-dex': 30, 'uid-score': 5 }

  const makeCharacter = (): CharacterEntity => ({
    characterId: 'character-1',
    characterName: 'Alice',
    gameSystemId: 'DiceBot',
    discordUserId: 'owner-1',
    discordChannelId: 'channel-1',
    status: {},
    parameter: {},
    skill: {},
    item: {},
    description: {},
    sheet: {
      templateId: 'template-1',
      templateVersion: '1.0.0',
      revision: 1,
      visibility: 'private',
      values: { ...initialValues }
    },
    computedCache: {},
    palette: [],
    hub: { status: 'none' },
    appliedInteractionIds: []
  })

  let current: CharacterEntity
  let repository: { findById: jest.Mock; saveSheetMaterialized: jest.Mock }
  let templateService: { resolvePinnedRevision: jest.Mock }
  let materializer: { materialize: jest.Mock }
  let diceExecutionService: { executeDiceRoll: jest.Mock; executeEvaluatedDiceRoll: jest.Mock }
  let service: CharacterSheetOperationService

  const rerollInput = (overrides: Partial<RerollCreationRollInput> = {}): RerollCreationRollInput => ({
    characterId: 'character-1',
    requesterDiscordUserId: 'owner-1',
    fieldUid: 'uid-hp',
    baseRevision: 1,
    ...overrides
  })

  const rejectionOf = async (operation: Promise<unknown>, status: number): Promise<HttpException> => {
    const error = await operation.then(
      () => undefined,
      (caught: unknown) => caught
    )
    expect(error).toBeInstanceOf(HttpException)
    expect((error as HttpException).getStatus()).toBe(status)
    return error as HttpException
  }

  /**
   * 拒否経路が保存自体を試みていないことを表明する。
   * fixture 上 current の値と revision を動かすのは saveSheetMaterialized モックだけなので、
   * 続く 2 つの表明は 1 つ目が成り立てば必ず成り立つ（保存後に値が戻る種の原子性は測っていない）。
   */
  const expectNoSaveAttempted = (): void => {
    expect(repository.saveSheetMaterialized).not.toHaveBeenCalled()
    expect(current.sheet?.values).toEqual(initialValues)
    expect(current.sheet?.revision).toBe(1)
  }

  beforeEach(() => {
    current = makeCharacter()
    repository = {
      findById: jest.fn().mockImplementation(async () => current),
      saveSheetMaterialized: jest
        .fn()
        .mockImplementation(
          async (_characterId: string, payload: SaveSheetMaterializedPayload, expectedRevision: number) => {
            current = {
              ...current,
              sheet: { ...current.sheet!, revision: expectedRevision + 1, values: payload.values },
              computedCache: payload.computedCache,
              palette: payload.palette
            }
            return current
          }
        )
    }
    templateService = { resolvePinnedRevision: jest.fn().mockResolvedValue(template) }
    materializer = {
      materialize: jest.fn().mockImplementation((input) => ({
        sheet: input.sheet,
        computedCache: {},
        projection,
        palette: input.existingPalette ?? []
      }))
    }
    diceExecutionService = {
      executeDiceRoll: jest.fn(),
      executeEvaluatedDiceRoll: jest.fn().mockResolvedValue({ total: ROLLED_TOTAL, details: ROLLED_DETAILS })
    }
    service = new CharacterSheetOperationService(
      repository as unknown as CharacterRepository,
      templateService as unknown as CharacterSheetTemplateService,
      materializer as unknown as SheetMaterializerService,
      diceExecutionService as unknown as DiceExecutionService
    )
  })

  it.each([
    ['track の rollOnCreate', 'uid-hp', '3d6*5'],
    ['roll の notation', 'uid-dex', '1d100']
  ])(
    '%s を宣言している項目は、作成時と同じ実行メソッドと pin 済み gameSystem で振り直し、結果を返す',
    async (_caseName, fieldUid, notation) => {
      const result = await service.rerollCreationRoll(rerollInput({ fieldUid }))

      // 作成時ロールと同じ実行メソッドであること（executeDiceRoll は rands 合算の legacy 互換値で意味が違う）。
      expect(diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledWith(notation, 'DiceBot')
      expect(diceExecutionService.executeDiceRoll).not.toHaveBeenCalled()
      expect(result).toEqual(
        expect.objectContaining({ fieldUid, notation, total: ROLLED_TOTAL, details: ROLLED_DETAILS, revision: 2 })
      )
    }
  )

  it('track の振り直しは内訳の base を差し替える（生の数値では保存しない）', async () => {
    await service.rerollCreationRoll(rerollInput({ fieldUid: 'uid-hp' }))

    const payload = repository.saveSheetMaterialized.mock.calls[0][1] as SaveSheetMaterializedPayload
    expect(payload.values['uid-hp']).toEqual({ parts: { base: ROLLED_TOTAL } })
  })

  /**
   * 本スライスの存在理由。全体上書きだった頃は、± が積んだ parts.other が振り直しのたびに消えていた。
   */
  it('parts.other を持つ track の振り直しは base だけを差し替え、± が積んだ other を保持する', async () => {
    const otherBeforeReroll = -3
    current.sheet!.values['uid-hp'] = { parts: { base: 40, other: otherBeforeReroll } }

    await service.rerollCreationRoll(rerollInput({ fieldUid: 'uid-hp' }))

    const payload = repository.saveSheetMaterialized.mock.calls[0][1] as SaveSheetMaterializedPayload
    const stored = payload.values['uid-hp'] as { parts: Record<string, number> }
    expect(stored.parts.other).toBe(otherBeforeReroll)
    expect(stored.parts.base).toBe(ROLLED_TOTAL)
  })

  it('roll 型の振り直しは生の数値のまま保存される（内訳形にすると保存境界が拒否する）', async () => {
    await service.rerollCreationRoll(rerollInput({ fieldUid: 'uid-dex' }))

    const payload = repository.saveSheetMaterialized.mock.calls[0][1] as SaveSheetMaterializedPayload
    expect(payload.values['uid-dex']).toBe(ROLLED_TOTAL)
  })

  /**
   * 応答の value が保存値と一致することを表明する（応答の値の出所までは測っていない）。
   * 保存形の pin（上の 2 テスト）とは別に要る: 保存形が正しくても応答が食い違えば、
   * front は「出目の合計から保存形を組み立て直す」実装を持つことになり、変換規則が 2 実装に分裂する。
   * 内訳を持てる track が検出器で、生の数値の roll は total と一致してしまうため単独では検出できない。
   */
  it.each([
    ['内訳を持てる track', 'uid-hp'],
    ['内訳を持てない roll', 'uid-dex']
  ])('%s の振り直し応答は、保存された値をそのまま載せる', async (_caseName, fieldUid) => {
    const result = await service.rerollCreationRoll(rerollInput({ fieldUid }))

    const payload = repository.saveSheetMaterialized.mock.calls[0][1] as SaveSheetMaterializedPayload
    expect(result.value).toEqual(payload.values[fieldUid])
  })

  it('振り直しは対象項目以外の値を書き換えない', async () => {
    await service.rerollCreationRoll(rerollInput({ fieldUid: 'uid-hp' }))

    const payload = repository.saveSheetMaterialized.mock.calls[0][1] as SaveSheetMaterializedPayload
    expect(payload.values['uid-dex']).toBe(initialValues['uid-dex'])
    expect(payload.values['uid-score']).toBe(initialValues['uid-score'])
  })

  // T-R1
  it('作成時ロールを宣言していない項目への振り直しは 422 で、値も revision も変わらない', async () => {
    const error = await rejectionOf(service.rerollCreationRoll(rerollInput({ fieldUid: 'uid-score' })), 422)

    expect(error).toBeInstanceOf(UnprocessableEntityException)
    expect(error.message).toContain('does not declare a creation roll')
    expect(diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expectNoSaveAttempted()
  })

  // T-R2
  it('操作の入力に値を混ぜても、保存されるのはサーバ実行の出目である', async () => {
    // 型に無い値プロパティを敢えて混ぜる。DTO にも service 入力にも値の受け口が無いことの表明。
    const inputWithInjectedValue = {
      characterId: 'character-1',
      requesterDiscordUserId: 'owner-1',
      fieldUid: 'uid-hp',
      baseRevision: 1,
      value: 99,
      total: 99,
      newValue: 99
    } as RerollCreationRollInput

    const result = await service.rerollCreationRoll(inputWithInjectedValue)

    const payload = repository.saveSheetMaterialized.mock.calls[0][1] as SaveSheetMaterializedPayload
    // 混ぜた 99 ではなくサーバ実行の出目が入っていること。表明の主眼は値の出所なので行き先キーだけを見る
    // （保存形そのものの pin は本ファイルの専用テストが持つ）。
    const stored = payload.values['uid-hp'] as { parts: Record<string, number> }
    expect(stored.parts.base).toBe(ROLLED_TOTAL)
    expect(result.total).toBe(ROLLED_TOTAL)
  })

  // T-R3
  it('記法の実行に失敗したときは 422 で、値も revision も変わらない', async () => {
    diceExecutionService.executeEvaluatedDiceRoll.mockRejectedValue(new Error('未対応のダイス記法です: 3d6*5'))

    const error = await rejectionOf(service.rerollCreationRoll(rerollInput()), 422)

    expect(error).toBeInstanceOf(UnprocessableEntityException)
    expectNoSaveAttempted()
  })

  // T-R4
  it('roll 型の値はクライアント提出の保存経路では従来どおり拒否される', async () => {
    const error = await rejectionOf(
      service.saveSheet({
        characterId: 'character-1',
        baseRevision: 1,
        changes: [{ path: { fieldUid: 'uid-dex' }, baseValue: 30, newValue: 99 }]
      }),
      422
    )

    expect(error.message).toContain('is not an input field (roll)')
    expectNoSaveAttempted()
  })

  // T-R5
  it('他人のシートへの振り直しは 404 で、値も revision も変わらない', async () => {
    const error = await rejectionOf(
      service.rerollCreationRoll(rerollInput({ requesterDiscordUserId: 'intruder-1' })),
      404
    )

    // 不在の characterId と同じ応答に畳み、触れないシートの存在を漏らさない。
    expect(error).toBeInstanceOf(NotFoundException)
    expect(error.message).toBe('character not found')
    expect(diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expectNoSaveAttempted()
  })

  it('テンプレートに存在しない fieldUid への振り直しは 422 で、値も revision も変わらない', async () => {
    const error = await rejectionOf(service.rerollCreationRoll(rerollInput({ fieldUid: 'uid-unknown' })), 422)

    expect(error.message).toContain('is not defined by the template')
    expect(diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expectNoSaveAttempted()
  })

  it('baseRevision が現在の revision と一致しない振り直しは 409 で、ダイスを実行しない', async () => {
    const error = await rejectionOf(service.rerollCreationRoll(rerollInput({ baseRevision: 0 })), 409)

    expect(error).toBeInstanceOf(ConflictException)
    expect(diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expectNoSaveAttempted()
  })

  /**
   * front が応答の revision を次の baseRevision に書き戻す往復を表明する。
   * この経路の baseRevision は保存経路（saveSheet の path ごとの baseValue CAS）と非対称で、
   * sheet.revision との不一致がそのまま 409 になる。書き戻しを省くと 2 回目以降が必ず落ちる。
   * fixture 上の前提: saveSheetMaterialized モックが current.sheet.revision を expectedRevision + 1 へ
   * 進め、findById がその current を返すので、往復は追加の道具なしで再現できる。
   */
  it('応答の revision を次の baseRevision に渡すと 2 回目の振り直しが通り、revision がさらに 1 つ進む', async () => {
    const first = await service.rerollCreationRoll(rerollInput({ baseRevision: 1 }))
    expect(first.revision).toBe(2)

    const second = await service.rerollCreationRoll(rerollInput({ baseRevision: first.revision }))
    expect(second.revision).toBe(3)

    // 書き戻さずに 1 回目と同じ baseRevision を再送すると 409。front の書き戻しを必須にしているのはこの非対称。
    await rejectionOf(service.rerollCreationRoll(rerollInput({ baseRevision: 1 })), 409)
  })

  it('保存 CAS に敗北した振り直しは再試行せず 409 を返す', async () => {
    repository.saveSheetMaterialized.mockResolvedValue(null)

    const error = await rejectionOf(service.rerollCreationRoll(rerollInput()), 409)

    expect(error).toBeInstanceOf(ConflictException)
    expect(diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledTimes(1)
    expect(repository.saveSheetMaterialized).toHaveBeenCalledTimes(1)
  })
})
