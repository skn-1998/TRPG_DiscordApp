/**
 * L-2 再現 spec（design-ledger.md §4 L-2）: LEGACY_COC_TEMPLATE からのキャラ作成で
 * 作成時ロールが発火することを期待する。
 *
 * 期待の根拠: design-v1 §「フィールド型」の RollField = 「作成時ロール（bcdice 記法）」・
 * phase2-operation-contracts OP-3 の供給側保証「rollOnCreate（server 実行）」。
 * roll フィールド値は作成入力として提出不可（value-input.ts が 422）・作成後も書込不可
 * （assertWritablePath は track/scalar のみ）のため、作成時ロールが唯一の値供給経路。
 *
 * 現状は instantiation が engine 契約外の `rollOnCreate` truthy でのみ発火し、seed の
 * roll フィールドはこれを持たないため本 spec は赤くなる（= L-2 の実証）。
 * 期待値を現状挙動（ロール 0 回）へ書き換えて緑にしてはならない。
 * 緑化は L-2 の裁定（型昇格 / seed 付与 / roll 型の常時ロール化）実装によってのみ行う。
 */
import type { CharacterEntity, MaterializedCharacterEntity } from '../../../domains/character/models/character.entity'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { LEGACY_COC_TEMPLATE } from '../../../domains/character-sheet-template/seeds/legacy-coc.template'
import { CharacterInstantiationService } from './character-instantiation.service'
import { SheetMaterializerService } from './sheet-materializer.service'

describe('CharacterInstantiationService × LEGACY_COC_TEMPLATE（L-2 再現）', () => {
  const publishedLegacyCocTemplate = {
    ...LEGACY_COC_TEMPLATE,
    status: 'published',
    draftRevision: 1
  } as unknown as CharacterSheetTemplateEntity

  // seed の全 roll フィールド。3d6*5 が STR/CON/POW/DEX/APP、(2d6+6)*5 が SIZ/INT/EDU
  const EXPECTED_CREATION_ROLLS = [
    { uid: 'lgc_str_roll', notation: '3d6*5' },
    { uid: 'lgc_con_roll', notation: '3d6*5' },
    { uid: 'lgc_pow_roll', notation: '3d6*5' },
    { uid: 'lgc_dex_roll', notation: '3d6*5' },
    { uid: 'lgc_app_roll', notation: '3d6*5' },
    { uid: 'lgc_siz_roll', notation: '(2d6+6)*5' },
    { uid: 'lgc_int_roll', notation: '(2d6+6)*5' },
    { uid: 'lgc_edu_roll', notation: '(2d6+6)*5' }
  ] as const

  const STUB_TOTAL_BY_NOTATION: Record<string, number> = {
    '3d6*5': 55,
    '(2d6+6)*5': 65
  }

  const instantiateInput = {
    templateId: LEGACY_COC_TEMPLATE.templateId,
    templateVersion: LEGACY_COC_TEMPLATE.version,
    requesterDiscordUserId: 'user-1',
    characterName: 'Investigator',
    discordUserId: 'user-1',
    discordChannelId: 'channel-1',
    // scalar 能力値はユーザー手入力扱い（roll フィールドの値供給とは独立）
    values: {
      lgc_str: 50,
      lgc_con: 55,
      lgc_pow: 60,
      lgc_dex: 65,
      lgc_app: 40,
      lgc_siz: 60,
      lgc_int: 70,
      lgc_edu: 75
    }
  }

  function createService() {
    const templateService = { resolvePublished: jest.fn().mockResolvedValue(publishedLegacyCocTemplate) }
    const characterRepository = {
      createMaterializedCharacter: jest
        .fn()
        .mockImplementation(async (entity: MaterializedCharacterEntity) => entity as CharacterEntity)
    }
    const characterIdService = { generateUniqueCharacterId: jest.fn().mockResolvedValue('char-legacy-1') }
    const diceExecutionService = {
      executeEvaluatedDiceRoll: jest.fn().mockImplementation(async (notation: string) => ({
        total: STUB_TOTAL_BY_NOTATION[notation] ?? 1,
        details: `(${notation}) => stub`
      }))
    }
    const service = new CharacterInstantiationService(
      templateService as any,
      characterRepository as any,
      characterIdService as any,
      diceExecutionService as any,
      new SheetMaterializerService()
    )

    return { service, diceExecutionService }
  }

  it('seed の roll フィールド一覧が本 spec の期待ロール一覧と一致する（seed 側を削って緑化する改変の防止）', () => {
    const seedRolls = LEGACY_COC_TEMPLATE.sections
      .flatMap((section) => section.fields)
      .filter((field) => field.type === 'roll')
      .map((field) => ({ uid: field.uid, notation: field.notation }))

    expect(seedRolls).toEqual([...EXPECTED_CREATION_ROLLS])
  })

  it('作成時に seed の全 roll フィールド（8 能力値ロール）の bcdice 実行が発火する', async () => {
    const { service, diceExecutionService } = createService()

    await service.instantiate(instantiateInput)

    const executedNotations = diceExecutionService.executeEvaluatedDiceRoll.mock.calls.map((call) => call[0])
    expect(executedNotations.sort()).toEqual(EXPECTED_CREATION_ROLLS.map((roll) => roll.notation).sort())
    for (const call of diceExecutionService.executeEvaluatedDiceRoll.mock.calls) {
      expect(call[1]).toBe('coc')
    }
  })

  it('rollOnCreateResults が 8 件の roll フィールドを uid・notation 付きで報告する', async () => {
    const { service } = createService()

    const result = await service.instantiate(instantiateInput)

    expect(result.rollOnCreateResults.map(({ uid, notation }) => ({ uid, notation }))).toEqual([
      ...EXPECTED_CREATION_ROLLS
    ])
  })

  it('ロール結果が sheet.values へ保存され parameter 投影に現れる', async () => {
    const { service } = createService()

    const result = await service.instantiate(instantiateInput)

    for (const roll of EXPECTED_CREATION_ROLLS) {
      expect(result.materialized.sheet.values[roll.uid]).toBe(STUB_TOTAL_BY_NOTATION[roll.notation])
    }
    expect(result.materialized.projection.parameter['str_roll']).toMatchObject({
      name: 'STR roll',
      values: { base: STUB_TOTAL_BY_NOTATION['3d6*5'] }
    })
  })
})
