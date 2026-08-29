/**
 * LEGACY_COC_TEMPLATE からのキャラ作成で、8 能力値の作成時ロールが発火し、出目が
 * HP / MP / SAN の式が読む場所へ入ることを、実 materializer / 実 evaluator を通して検証する。
 *
 * 期待の根拠: design-v1 §「フィールド型」の作成時ロール（bcdice 記法）・
 * phase2-operation-contracts OP-3 の供給側保証「rollOnCreate（server 実行）」。
 * 能力値 scalar は作成時ロールを宣言しているため作成入力として提出できず
 * （提出すると出目に潰されるので character-instantiation.service.ts が 422 にする）、
 * 作成時ロールが唯一の値供給経路になる。
 *
 * 本 spec は以前、能力値 1 つにつき用意されていた `*_roll`（roll 型）8 件の発火を固定していた。
 * その形では出目が `lgc_*_roll` に入り、式が読む `lgc_*` は未入力のまま 0 に畳まれるため
 * （evaluator.ts の numberOrZero）、作成直後の HP / MP / SAN が静かに 0 になっていた。
 * seed を scalar 1 本へ畳んだのに伴い、期待も「roll 型 8 件」から
 * 「能力値 scalar 8 件が作成時ロールを宣言し、出目が式の参照先に入る」へ移した。
 * 作成時ロールが 8 回発火するという保証の強さは落とさず、出目の行き先の検証を足している。
 *
 * 緑が正しい spec。赤に戻る場合は作成時ロールか出目の行き先の退行を示すため、
 * ロール 0 回や HP 0 へ期待値を書き換えてはならない。
 *
 * v3 で技能セクションが入ったのに伴い、内訳の既定値の焼き込み（applyPartsDefaults）も同じ作成経路で
 * 実測する。既定値の式は作成時ロールで決まった能力値を参照するため、ロールと同じ経路でしか測れない。
 * v4 のカスタム欄は空行を seed せず、保存境界を通った行だけが palette / 投影へ参加することも固定する。
 */
import type { CharacterEntity, MaterializedCharacterEntity } from '../../../domains/character/models/character.entity'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { LEGACY_COC_TEMPLATE } from '../../../domains/character-sheet-template/seeds/legacy-coc.template'
import { CharacterInstantiationService } from './character-instantiation.service'
import { SheetMaterializerService } from './sheet-materializer.service'

describe('CharacterInstantiationService × LEGACY_COC_TEMPLATE（作成時ロール）', () => {
  const publishedLegacyCocTemplate = {
    ...LEGACY_COC_TEMPLATE,
    status: 'published',
    draftRevision: 1
  } as unknown as CharacterSheetTemplateEntity

  // seed の全能力値。3d6*5 が STR/CON/POW/DEX/APP、(2d6+6)*5 が SIZ/INT/EDU
  const EXPECTED_CREATION_ROLLS = [
    { uid: 'lgc_str', label: 'STR', notation: '3d6*5' },
    { uid: 'lgc_con', label: 'CON', notation: '3d6*5' },
    { uid: 'lgc_pow', label: 'POW', notation: '3d6*5' },
    { uid: 'lgc_dex', label: 'DEX', notation: '3d6*5' },
    { uid: 'lgc_app', label: 'APP', notation: '3d6*5' },
    { uid: 'lgc_siz', label: 'SIZ', notation: '(2d6+6)*5' },
    { uid: 'lgc_int', label: 'INT', notation: '(2d6+6)*5' },
    { uid: 'lgc_edu', label: 'EDU', notation: '(2d6+6)*5' }
  ] as const

  const STUB_TOTAL_BY_NOTATION: Record<string, number> = {
    '3d6*5': 55,
    '(2d6+6)*5': 65
  }

  /**
   * 上の出目から seed の式が導く値。式そのものは seed が正本で、ここは実測の期待値。
   * HP = floor((CON 55 + SIZ 65) / 10)、MP = floor(POW 55 / 5)、SAN = POW、
   * DB = lookup(STR 55 + SIZ 65 = 120, damage_bonus) → 85..124 の行。
   */
  const EXPECTED_DERIVED_VALUES = { lgc_hp: 12, lgc_mp: 11, lgc_san: 55, lgc_db: '0' }

  const instantiateInput = {
    templateId: LEGACY_COC_TEMPLATE.templateId,
    templateVersion: LEGACY_COC_TEMPLATE.version,
    requesterDiscordUserId: 'user-1',
    characterName: 'Investigator',
    discordUserId: 'user-1',
    discordChannelId: 'channel-1',
    // 能力値は提出できないため、作成時ロールの対象外である description の項目だけを提出する
    values: { lgc_occupation: 'Antiquarian' }
  }

  function createService() {
    const templateService = { resolveForCreate: jest.fn().mockResolvedValue(publishedLegacyCocTemplate) }
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

  it('seed の作成時ロール宣言が本 spec の期待一覧と一致し、roll 型へ分裂していない', () => {
    const fields = LEGACY_COC_TEMPLATE.sections.flatMap((section) => section.fields)
    const declaredRolls = fields.flatMap((field) =>
      field.type === 'scalar' && field.rollOnCreate !== undefined
        ? [{ uid: field.uid, label: field.label, notation: field.rollOnCreate.notation }]
        : []
    )

    expect(declaredRolls).toEqual([...EXPECTED_CREATION_ROLLS])
    // 出目の行き先が式の参照先から再び分かれる形（能力値ごとの `*_roll`）への逆戻りを検出する
    expect(fields.filter((field) => field.type === 'roll')).toEqual([])
  })

  it('作成時に seed の全能力値（8 件）の bcdice 実行が発火する', async () => {
    const { service, diceExecutionService } = createService()

    await service.instantiate(instantiateInput)

    const executedNotations = diceExecutionService.executeEvaluatedDiceRoll.mock.calls.map((call) => call[0])
    expect(executedNotations.sort()).toEqual(EXPECTED_CREATION_ROLLS.map((roll) => roll.notation).sort())
    for (const call of diceExecutionService.executeEvaluatedDiceRoll.mock.calls) {
      expect(call[1]).toBe('Cthulhu')
    }
  })

  it('rollOnCreateResults が 8 件の能力値を uid・label・notation 付きで報告する', async () => {
    const { service } = createService()

    const result = await service.instantiate(instantiateInput)

    expect(result.rollOnCreateResults.map(({ uid, label, notation }) => ({ uid, label, notation }))).toEqual([
      ...EXPECTED_CREATION_ROLLS
    ])
  })

  it('出目が式の参照先である能力値 scalar へ内訳 base として保存され parameter 投影に現れる', async () => {
    const { service } = createService()

    const result = await service.instantiate(instantiateInput)

    for (const roll of EXPECTED_CREATION_ROLLS) {
      expect(result.materialized.sheet.values[roll.uid]).toEqual({
        parts: { base: STUB_TOTAL_BY_NOTATION[roll.notation] }
      })
    }
    expect(result.materialized.projection.parameter['con']).toMatchObject({
      name: 'CON',
      values: { base: STUB_TOTAL_BY_NOTATION['3d6*5'] }
    })
  })

  it('作成直後の HP / MP / SAN / DB が出目から導かれ、0 に畳まれない', async () => {
    const { service } = createService()

    const result = await service.instantiate(instantiateInput)

    expect(result.materialized.computedCache).toEqual(EXPECTED_DERIVED_VALUES)
    expect(result.materialized.projection.status).toMatchObject({
      hp: { values: { base: EXPECTED_DERIVED_VALUES.lgc_hp } },
      mp: { values: { base: EXPECTED_DERIVED_VALUES.lgc_mp } },
      san: { values: { base: EXPECTED_DERIVED_VALUES.lgc_san } }
    })
  })

  /**
   * Test intent: 技能の初期値（partsKeys の `initial`）が作成経路で内訳 `initial` へ焼き込まれることを、
   * 実 service（applyPartsDefaults）を通して固定する。式で書いた回避・母国語は焼き込みが無いと 0 になり、
   * 例外も警告も出ないまま配布される。上の出目から DEX 55 → 回避 floor(55 * 2 / 5) = 22、EDU 65 → 母国語 65。
   * 62 本すべてを走査して、数値初期値の一部だけが焼き込みから漏れても緑にならないようにする。
   * 回避・母国語・目星の名指し assertion は代表値と式の導出結果を読み手へ示すために残す。
   */
  it('技能の初期値が作成時に内訳 initial へ焼き込まれ、式のものが能力値から導かれる', async () => {
    const { service } = createService()

    const result = await service.instantiate(instantiateInput)
    const skillSection = LEGACY_COC_TEMPLATE.sections.find((section) => section.id === 'skill')
    if (skillSection === undefined) {
      throw new Error('legacy-coc template does not contain the skill section')
    }

    const standardSkillFields = skillSection.fields.filter((field) => field.id !== 'custom_skills')
    expect(standardSkillFields).toHaveLength(62)
    for (const field of standardSkillFields) {
      expect(result.materialized.sheet.values[field.uid]).toEqual({
        parts: { initial: expect.any(Number) }
      })
    }

    expect(result.materialized.sheet.values['lgc_skill_dodge']).toEqual({ parts: { initial: 22 } })
    expect(result.materialized.sheet.values['lgc_skill_own_language']).toEqual({ parts: { initial: 65 } })
    expect(result.materialized.sheet.values['lgc_skill_spot_hidden']).toEqual({ parts: { initial: 25 } })
    expect(result.materialized.projection.skill).toMatchObject({
      dodge: { name: '回避', values: { initial: 22 } },
      own_language: { name: '母国語', values: { initial: 65 } }
    })
  })

  /**
   * Test intent: seed と instantiate が list 行を推測して作らず、保存境界と同じ行スキーマを
   * 通っていない values を作成結果へ混ぜないことを、プロパティ不在まで固定する。
   */
  it('作成直後の values にカスタム技能・ステータスの空 list を焼き込まない', async () => {
    const { service } = createService()

    const result = await service.instantiate(instantiateInput)
    const values = result.materialized.sheet.values

    expect(Object.prototype.hasOwnProperty.call(values, 'lgc_custom_skills')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(values, 'lgc_custom_status')).toBe(false)
  })

  /**
   * Test intent: 全 62 技能の role が作成時に materializer を通り、能力値 8 件と合わせて palette 70 件になることを
   * 固定する。role の `{value}` は保存済み内訳の合計へ展開されるため、目星は初期値 25 を使う `1d100<=25` になる。
   */
  it('作成結果の palette に技能判定が載り、能力値 8 件と技能 62 件で 70 件になる', async () => {
    const { service } = createService()

    const result = await service.instantiate(instantiateInput)

    expect(result.materialized.palette).toHaveLength(70)
    expect(result.materialized.palette).toContainEqual(
      expect.objectContaining({
        fieldRef: { uid: 'lgc_skill_spot_hidden' },
        label: '目星 (25)',
        kind: 'roll',
        notation: '1d100<=25',
        group: 'skill'
      })
    )
  })

  /**
   * Test intent: v4 の実物で、uid キーの list 行が engine の入力スキーマを通過した後にだけ保存値へ入り、
   * S5 の palette と S6 の skill 投影へ同じ行名・行値で到達することを end-to-end で固定する。
   * ユーザーの実使用形（プール配分した行）が palette へ内訳合計で載ることも固定する。
   * validateInputValues は buildValueInputSchema を使う実保存境界であり、生の行配列を materialize へ直送しない。
   */
  it('検査済みのカスタム技能行を再 materialize すると palette 71 件と skill 行投影になる', async () => {
    const { service } = createService()
    const creation = await service.instantiate(instantiateInput)
    const materializer = new SheetMaterializerService()
    const customSkillRow = {
      rowId: 'row_test1',
      lgc_custom_skill_name: '古文書解読',
      lgc_custom_skill_value: { parts: { initial: 20, occupation: 25 } }
    }
    const validatedValues = materializer.validateInputValues(publishedLegacyCocTemplate, {
      ...creation.materialized.sheet.values,
      lgc_custom_skills: [customSkillRow]
    })

    expect(validatedValues.lgc_custom_skills).toEqual([customSkillRow])

    const rematerialized = materializer.materialize({
      template: publishedLegacyCocTemplate,
      sheet: { ...creation.materialized.sheet, values: validatedValues }
    })

    expect(rematerialized.palette).toHaveLength(71)
    expect(rematerialized.palette).toContainEqual(
      expect.objectContaining({
        fieldRef: { uid: 'lgc_custom_skills', rowId: 'row_test1' },
        label: '古文書解読',
        notation: '1d100<=45',
        group: 'skill'
      })
    )
    expect(rematerialized.projection.skill['custom_skills:row_test1']).toMatchObject({
      name: '古文書解読',
      values: { initial: 20, occupation: 25 }
    })
  })
})
