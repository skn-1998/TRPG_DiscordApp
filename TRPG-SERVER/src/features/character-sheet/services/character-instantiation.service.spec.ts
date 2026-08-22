import { ConflictException, UnprocessableEntityException } from '@nestjs/common'
import type { CharacterEntity } from '../../../domains/character/models/character.entity'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import type { MaterializedCharacterSheet } from '../types/character-sheet.types'
import { CharacterInstantiationService } from './character-instantiation.service'
import { SheetMaterializerService } from './sheet-materializer.service'

describe('CharacterInstantiationService', () => {
  const template: CharacterSheetTemplateEntity = {
    templateId: 'template-1',
    status: 'published',
    version: '1.0.0',
    schemaVersion: 3,
    name: 'Template',
    gameSystemId: 'DiceBot',
    tags: [],
    visibility: 'public',
    authorDiscordUserId: 'user-1',
    sections: [
      {
        id: 'parameter',
        label: 'Parameter',
        fields: [
          {
            id: 'dex',
            uid: 'uid-dex',
            label: 'DEX',
            type: 'roll',
            notation: '3d6*5',
            role: { kind: 'rollable', notation: '1d100<={value}', group: 'ability' }
          },
          {
            id: 'dex_half',
            uid: 'uid-dex-half',
            label: 'DEX Half',
            type: 'computed',
            resultType: 'number',
            formula: 'floor({parameter.dex}/2)'
          }
        ]
      }
    ],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  }

  const materialized: MaterializedCharacterSheet = {
    sheet: {
      templateId: 'template-1',
      templateVersion: '1.0.0',
      revision: 1,
      visibility: 'private',
      values: { 'uid-dex': 55 }
    },
    computedCache: { 'uid-dex-half': 27 },
    projection: {
      status: {},
      parameter: {
        dex: {
          name: 'DEX',
          values: { base: 50, buff: 5, temp: 0, other: 0 },
          index: 0,
          isVisible: true
        }
      },
      skill: {},
      item: {},
      description: {}
    },
    palette: [
      {
        key: 'dex',
        fieldRef: { uid: 'uid-dex' },
        label: 'DEX (55)',
        kind: 'roll',
        notation: '1d100<=55',
        group: 'ability'
      }
    ]
  }

  const trackCreationTemplate = (
    max: number | { formula: string },
    // rollOnCreate は契約外形（publish を経ずに保存された boolean 等）も渡せるようにしてある。
    {
      includeLimit = false,
      rollOnCreate
    }: { includeLimit?: boolean; rollOnCreate?: { notation: string } | boolean } = {}
  ): CharacterSheetTemplateEntity => ({
    ...template,
    sections: [
      ...(includeLimit
        ? [
            {
              id: 'parameter',
              label: 'Parameter',
              fields: [
                {
                  id: 'limit',
                  uid: 'uid-limit',
                  label: 'Limit',
                  type: 'scalar' as const,
                  valueType: 'number' as const
                }
              ]
            }
          ]
        : []),
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
            max,
            style: 'gauge',
            ...(rollOnCreate === undefined ? {} : { rollOnCreate }),
            role: { kind: 'resource', deltas: [-1, 1] }
          }
        ]
      }
    ]
  })

  // 作成時ロールを宣言した number scalar 1 本だけを持つテンプレート。内訳宣言（parts / partsKeys）の
  // 有無で出目の保存形と衝突判定が変わるので、そこを呼び出し側から差し替えられるようにしてある。
  const scalarCreationTemplate = (scalarProperties: Record<string, unknown>): CharacterSheetTemplateEntity => ({
    ...template,
    sections: [
      {
        id: 'parameter',
        label: 'Parameter',
        fields: [
          {
            id: 'luck',
            uid: 'uid-luck',
            label: 'Luck',
            type: 'scalar',
            valueType: 'number',
            ...scalarProperties
          }
        ]
      }
    ]
  })

  // 内訳キーの既定値（partsKeys[].default）を宣言した number scalar「evade」と、その既定値が参照しうる
  // 2 本の能力値を持つテンプレート。dex は作成時ロールで決まり、bonus は誰も値を入れない。
  // 既定値の評価がロールの後であること（dex）と、参照先が未確定なら何も書かないこと（bonus）を
  // 同じテンプレートで観測できるようにしてある。
  const partsDefaultTemplate = (
    partsKeys: Array<{ id: string; label: string; default?: number | { formula: string } }>,
    evadeProperties: Record<string, unknown> = {}
  ): CharacterSheetTemplateEntity => ({
    ...template,
    sections: [
      {
        id: 'parameter',
        label: 'Parameter',
        fields: [
          {
            id: 'dex',
            uid: 'uid-dex',
            label: 'DEX',
            type: 'scalar',
            valueType: 'number',
            rollOnCreate: { notation: '3d6*5' }
          },
          {
            id: 'bonus',
            uid: 'uid-bonus',
            label: 'Bonus',
            type: 'scalar',
            valueType: 'number'
          },
          {
            id: 'evade',
            uid: 'uid-evade',
            label: 'Evade',
            type: 'scalar',
            valueType: 'number',
            partsKeys,
            ...evadeProperties
          }
        ]
      }
    ]
  })

  const created: CharacterEntity = {
    characterId: 'char-1',
    characterName: 'Investigator',
    gameSystemId: 'DiceBot',
    discordUserId: 'user-1',
    discordChannelId: 'channel-1',
    discordThreadId: 'thread-1',
    sheet: materialized.sheet,
    computedCache: materialized.computedCache,
    palette: materialized.palette,
    status: materialized.projection.status,
    parameter: materialized.projection.parameter,
    skill: materialized.projection.skill,
    item: materialized.projection.item,
    description: materialized.projection.description,
    hub: { status: 'none' },
    appliedInteractionIds: []
  }

  const instantiateInput = {
    templateId: 'template-1',
    templateVersion: '1.0.0',
    requesterDiscordUserId: 'user-1',
    characterName: 'Investigator',
    discordUserId: 'user-1',
    discordChannelId: 'channel-1',
    discordThreadId: 'thread-1'
  }

  function createDependencies() {
    const templateService = { resolveForCreate: jest.fn().mockResolvedValue(template) }
    const characterRepository = { createMaterializedCharacter: jest.fn().mockResolvedValue(created) }
    const characterIdService = { generateUniqueCharacterId: jest.fn().mockResolvedValue('char-1') }
    const diceExecutionService = {
      executeEvaluatedDiceRoll: jest.fn().mockResolvedValue({ total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' })
    }
    const sheetMaterializer = {
      validateInputValues: jest.fn().mockImplementation((_template, values) => values),
      materialize: jest.fn().mockReturnValue(materialized)
    }
    const service = new CharacterInstantiationService(
      templateService as any,
      characterRepository as any,
      characterIdService as any,
      diceExecutionService as any,
      sheetMaterializer as any
    )

    return {
      service,
      templateService,
      characterRepository,
      characterIdService,
      diceExecutionService,
      sheetMaterializer
    }
  }

  it('新規 sheet を private 固定で materialize し、単一 insert まで順に実行する', async () => {
    const dependencies = createDependencies()

    const result = await dependencies.service.instantiate(instantiateInput)

    expect(dependencies.templateService.resolveForCreate).toHaveBeenCalledWith('template-1', '1.0.0', 'user-1')
    expect(dependencies.sheetMaterializer.validateInputValues).toHaveBeenCalledWith(template, {})
    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledWith('3d6*5', 'DiceBot')
    expect(dependencies.sheetMaterializer.materialize).toHaveBeenCalledWith({
      template,
      sheet: {
        templateId: 'template-1',
        templateVersion: '1.0.0',
        revision: 1,
        visibility: 'private',
        values: { 'uid-dex': 55 }
      }
    })
    expect(dependencies.characterRepository.createMaterializedCharacter).toHaveBeenCalledTimes(1)
    expect(dependencies.characterRepository.createMaterializedCharacter).toHaveBeenCalledWith({
      characterId: 'char-1',
      characterName: 'Investigator',
      gameSystemId: 'DiceBot',
      discordUserId: 'user-1',
      discordChannelId: 'channel-1',
      discordThreadId: 'thread-1',
      sheet: materialized.sheet,
      computedCache: materialized.computedCache,
      palette: materialized.palette,
      status: materialized.projection.status,
      parameter: materialized.projection.parameter,
      skill: materialized.projection.skill,
      item: materialized.projection.item,
      description: materialized.projection.description,
      hub: { status: 'none' },
      appliedInteractionIds: []
    })

    const resolveOrder = dependencies.templateService.resolveForCreate.mock.invocationCallOrder[0]
    const validateOrder = dependencies.sheetMaterializer.validateInputValues.mock.invocationCallOrder[0]
    const diceOrder = dependencies.diceExecutionService.executeEvaluatedDiceRoll.mock.invocationCallOrder[0]
    const materializeOrder = dependencies.sheetMaterializer.materialize.mock.invocationCallOrder[0]
    const insertOrder = dependencies.characterRepository.createMaterializedCharacter.mock.invocationCallOrder[0]
    expect(resolveOrder).toBeLessThan(validateOrder)
    expect(validateOrder).toBeLessThan(diceOrder)
    expect(diceOrder).toBeLessThan(materializeOrder)
    expect(materializeOrder).toBeLessThan(insertOrder)

    expect(result.rollOnCreateResults).toEqual([
      { uid: 'uid-dex', label: 'DEX', notation: '3d6*5', total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' }
    ])
    expect(result.materialized.sheet.visibility).toBe('private')
    expect(result.character).toBe(created)
    expect(result.materialized).toBe(materialized)
  })

  // boolean / string は publish を経ずに DB へ残存しうる契約外形。notation を取り出せないので
  // 宣言なしとして扱う（正本: packages/sheet-engine/src/roll-on-create.ts の rollOnCreateSpec）。
  it.each([
    ['boolean', { rollOnCreate: true, notation: '1d20' }],
    ['string', { rollOnCreate: '1d20' }]
  ])('rollOnCreate の契約外形（%s）を持つ scalar は作成時ロールしない', async (_caseName, legacyProperties) => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockResolvedValue(scalarCreationTemplate(legacyProperties))

    await dependencies.service.instantiate(instantiateInput)

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
  })

  it('内訳を宣言した number scalar の rollOnCreate は発火し、出目が内訳の base へ入る', async () => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockResolvedValue(
      scalarCreationTemplate({ parts: true, rollOnCreate: { notation: '3d6*5' } })
    )

    const result = await dependencies.service.instantiate(instantiateInput)

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledWith('3d6*5', 'DiceBot')
    const materializeArgument = dependencies.sheetMaterializer.materialize.mock.calls[0][0]
    expect(materializeArgument.sheet.values['uid-luck']).toEqual({ parts: { base: 55 } })
    expect(result.rollOnCreateResults).toEqual([
      { uid: 'uid-luck', label: 'Luck', notation: '3d6*5', total: 55, details: '(3D6*5) ＞ 11[2,4,5]*5 ＞ 55' }
    ])
  })

  // 内訳を宣言していない number scalar にも publish は rollOnCreate を許す
  // （publish.spec.ts の 'accepts a scalar creation roll without a destination'）。
  // 書き込み側（creationRollValue）は内訳を持てない field へ生の数値を返すので、保存形もそうなる。
  it('内訳を宣言していない number scalar の出目は生の数値のまま保存される', async () => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockResolvedValue(
      scalarCreationTemplate({ rollOnCreate: { notation: '3d6*5' } })
    )

    await dependencies.service.instantiate(instantiateInput)

    const materializeArgument = dependencies.sheetMaterializer.materialize.mock.calls[0][0]
    expect(materializeArgument.sheet.values['uid-luck']).toBe(55)
  })

  // 衝突 = creationRollValue が提出値を残さない形。内訳を持てない scalar への提出は丸ごと、
  // 内訳形でない提出は parts の作り直しで、行き先キーを含む提出はその上書きで失われる。
  it.each([
    ['内訳を持てない scalar への提出', { rollOnCreate: { notation: '3d6*5' } }, { 'uid-luck': 40 }],
    ['内訳形でない提出', { parts: true, rollOnCreate: { notation: '3d6*5' } }, { 'uid-luck': 40 }],
    [
      '行き先キーを含む内訳の提出',
      { parts: true, rollOnCreate: { notation: '3d6*5' } },
      { 'uid-luck': { parts: { base: 40, other: 5 } } }
    ]
  ])(
    'rollOnCreate 宣言 scalar への衝突する提出（%s）を 422 にして roll と insert を実行しない',
    async (_caseName, scalarProperties, values) => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(scalarCreationTemplate(scalarProperties))

      const instantiation = dependencies.service.instantiate({ ...instantiateInput, values })

      await expect(instantiation).rejects.toBeInstanceOf(UnprocessableEntityException)
      await expect(instantiation).rejects.toMatchObject({ response: { fieldUid: 'uid-luck' } })

      expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
      expect(dependencies.sheetMaterializer.materialize).not.toHaveBeenCalled()
      expect(dependencies.characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
      expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
    }
  )

  // track の一律 422 と分かれる中心的なケース。scalar の出目は内訳の 1 キーにしか書かないので、
  // 「職業ボーナスを other へ入れつつ base は振る」が成立する。
  it('rollOnCreate 宣言 scalar への行き先以外の内訳の提出は受理し、提出した内訳を残したまま行き先を振る', async () => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockResolvedValue(
      scalarCreationTemplate({ parts: true, rollOnCreate: { notation: '3d6*5' } })
    )

    await dependencies.service.instantiate({
      ...instantiateInput,
      values: { 'uid-luck': { parts: { other: 5 } } }
    })

    const materializeArgument = dependencies.sheetMaterializer.materialize.mock.calls[0][0]
    expect(materializeArgument.sheet.values['uid-luck']).toEqual({ parts: { other: 5, base: 55 } })
    expect(dependencies.characterRepository.createMaterializedCharacter).toHaveBeenCalledTimes(1)
  })

  it('RollField は契約外 rollOnCreate より正本 notation を優先する', async () => {
    const dependencies = createDependencies()
    const legacyProperties = { rollOnCreate: '1d20' }
    const rollTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'parameter',
          label: 'Parameter',
          fields: [
            {
              id: 'dex',
              uid: 'uid-dex',
              label: 'DEX',
              type: 'roll',
              notation: '3d6*5',
              ...legacyProperties
            }
          ]
        }
      ]
    }
    dependencies.templateService.resolveForCreate.mockResolvedValue(rollTemplate)

    await dependencies.service.instantiate(instantiateInput)

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledTimes(1)
    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledWith('3d6*5', 'DiceBot')
  })

  it.each([
    ['computed uid', { 'uid-dex-half': 27 }],
    ['unknown uid', { 'uid-unknown': 10 }]
  ])('提出された %s を roll 前に 422 で拒否し insert しない', async (_caseName, values) => {
    const dependencies = createDependencies()
    const realMaterializer = new SheetMaterializerService()
    dependencies.sheetMaterializer.validateInputValues.mockImplementation((resolvedTemplate, submittedValues) =>
      realMaterializer.validateInputValues(resolvedTemplate, submittedValues)
    )

    await expect(dependencies.service.instantiate({ ...instantiateInput, values })).rejects.toBeInstanceOf(
      UnprocessableEntityException
    )

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expect(dependencies.sheetMaterializer.materialize).not.toHaveBeenCalled()
    expect(dependencies.characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })

  it('正式形 rollOnCreate の範囲外出目を track 値と結果一覧へ raw のまま採用する', async () => {
    const dependencies = createDependencies()
    const rollOnCreateTrackTemplate = trackCreationTemplate(10, {
      rollOnCreate: { notation: '1d20+10' }
    })
    dependencies.templateService.resolveForCreate.mockResolvedValue(rollOnCreateTrackTemplate)
    dependencies.diceExecutionService.executeEvaluatedDiceRoll.mockResolvedValue({
      total: 25,
      details: '(1D20+10) ＞ 15[15]+10 ＞ 25'
    })

    const result = await dependencies.service.instantiate(instantiateInput)

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).toHaveBeenCalledWith('1d20+10', 'DiceBot')
    // max 10 の track へ出目 25 を clamp せずに渡すこと。保存形そのものの pin は本ファイルの専用テストが持つ。
    const materializeArgument = dependencies.sheetMaterializer.materialize.mock.calls[0][0]
    expect(materializeArgument.template).toBe(rollOnCreateTrackTemplate)
    expect(materializeArgument.sheet.values['uid-hp'].parts.base).toBe(25)
    expect(result.rollOnCreateResults).toEqual([
      {
        uid: 'uid-hp',
        label: 'HP',
        notation: '1d20+10',
        total: 25,
        details: '(1D20+10) ＞ 15[15]+10 ＞ 25'
      }
    ])
    expect(dependencies.characterRepository.createMaterializedCharacter).toHaveBeenCalledTimes(1)
  })

  it('rollOnCreate 宣言 track の出目は内訳の base へ書かれる（生の数値では保存しない）', async () => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockResolvedValue(
      trackCreationTemplate(100, { rollOnCreate: { notation: '3d6*5' } })
    )

    const result = await dependencies.service.instantiate(instantiateInput)

    const materializeArgument = dependencies.sheetMaterializer.materialize.mock.calls[0][0]
    expect(materializeArgument.sheet.values['uid-hp']).toEqual({ parts: { base: 55 } })
    // 行き先が変わるだけで出目そのものは加工しない。
    expect(result.rollOnCreateResults[0]).toMatchObject({ uid: 'uid-hp', total: 55 })
  })

  it('roll 型の出目は生の数値のまま保存される（内訳形にすると保存境界が拒否する）', async () => {
    const dependencies = createDependencies()

    await dependencies.service.instantiate(instantiateInput)

    const materializeArgument = dependencies.sheetMaterializer.materialize.mock.calls[0][0]
    expect(materializeArgument.sheet.values['uid-dex']).toBe(55)
  })

  it('rollOnCreate 宣言 track への明示提出値を 422 にして roll と insert を実行しない', async () => {
    const dependencies = createDependencies()
    const rollOnCreateTrackTemplate = trackCreationTemplate(10, {
      rollOnCreate: { notation: '1d20' }
    })
    dependencies.templateService.resolveForCreate.mockResolvedValue(rollOnCreateTrackTemplate)

    const instantiation = dependencies.service.instantiate({ ...instantiateInput, values: { 'uid-hp': 7 } })

    await expect(instantiation).rejects.toBeInstanceOf(UnprocessableEntityException)
    await expect(instantiation).rejects.toMatchObject({
      response: {
        message: 'track field uid-hp declares rollOnCreate and cannot accept an explicit creation value',
        fieldUid: 'uid-hp'
      }
    })

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expect(dependencies.sheetMaterializer.materialize).not.toHaveBeenCalled()
    expect(dependencies.characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })

  // 契約外形の宣言では rollOnCreateSpec が undefined を返して発火しない。提出まで通ると、
  // 著者が「作成時に振られる」と宣言した項目へクライアントの値だけが入る形になるため、
  // 提出の拒否は宣言の有無だけを見る（発火の述語より外延が広い）。
  it('契約外形 rollOnCreate を持つ track への明示提出値も 422 にする（発火しないが提出も通さない）', async () => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockResolvedValue(trackCreationTemplate(10, { rollOnCreate: true }))

    const instantiation = dependencies.service.instantiate({ ...instantiateInput, values: { 'uid-hp': 7 } })

    await expect(instantiation).rejects.toBeInstanceOf(UnprocessableEntityException)
    await expect(instantiation).rejects.toMatchObject({ response: { fieldUid: 'uid-hp' } })

    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })

  it.each([
    ['数値max × 素の数値', trackCreationTemplate(10), { 'uid-hp': 999 }],
    [
      'formula max × parts合計',
      trackCreationTemplate({ formula: '{parameter.limit}' }, { includeLimit: true }),
      { 'uid-limit': 10, 'uid-hp': { parts: { base: 999, other: 0 } } }
    ]
  ])(
    'rollOnCreate 非宣言 track の範囲外提出値を raw のまま採用して insert する（数値 max × 素の値／formula max × parts）: %s',
    async (_caseName, resolvedTemplate, values) => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(resolvedTemplate)

      await dependencies.service.instantiate({ ...instantiateInput, values })

      expect(dependencies.sheetMaterializer.materialize).toHaveBeenCalledWith({
        template: resolvedTemplate,
        sheet: {
          templateId: 'template-1',
          templateVersion: '1.0.0',
          revision: 1,
          visibility: 'private',
          values
        }
      })
      expect(dependencies.characterIdService.generateUniqueCharacterId).toHaveBeenCalledTimes(1)
      expect(dependencies.characterRepository.createMaterializedCharacter).toHaveBeenCalledTimes(1)
    }
  )

  // 内訳キーの既定値（partsKeys[].default）の焼き込み。適用時点を作成時に固定するのは D-17 の裁定で、
  // 評価時に動的へ倒す実装との差はここで観測する（materialize へ渡る値に既に入っているか）。
  describe('内訳キーの既定値', () => {
    function materializedValues(dependencies: ReturnType<typeof createDependencies>): Record<string, any> {
      return dependencies.sheetMaterializer.materialize.mock.calls[0][0].sheet.values
    }

    it('式の既定値は作成時ロールで決まった値を参照して焼き込まれる', async () => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(
        partsDefaultTemplate([
          { id: 'initial', label: '初期値', default: { formula: '{parameter.dex} * 2' } },
          { id: 'occupation', label: '職業' }
        ])
      )
      dependencies.diceExecutionService.executeEvaluatedDiceRoll.mockResolvedValue({
        total: 40,
        details: '(3D6*5) ＞ 8[2,3,3]*5 ＞ 40'
      })

      await dependencies.service.instantiate(instantiateInput)

      // 出目 40 の 2 倍。評価が作成時ロールより前だと dex が生入力欠落のままとなり、
      // evaluateConstraint が indeterminate を返して initial 自体が作られない（= この期待が赤くなる）。
      expect(materializedValues(dependencies)['uid-dex']).toBe(40)
      // 既定値の無い occupation は作られない。
      expect(materializedValues(dependencies)['uid-evade']).toStrictEqual({ parts: { initial: 80 } })
    })

    it('数値の既定値はそのまま焼き込まれる', async () => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(
        partsDefaultTemplate([{ id: 'initial', label: '初期値', default: 25 }])
      )

      await dependencies.service.instantiate(instantiateInput)

      expect(materializedValues(dependencies)['uid-evade']).toStrictEqual({ parts: { initial: 25 } })
    })

    it('提出値が既に持つ内訳キーには既定値を書かない', async () => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(
        partsDefaultTemplate([{ id: 'initial', label: '初期値', default: 25 }])
      )

      await dependencies.service.instantiate({
        ...instantiateInput,
        values: { 'uid-evade': { parts: { initial: 5 } } }
      })

      expect(materializedValues(dependencies)['uid-evade']).toStrictEqual({ parts: { initial: 5 } })
    })

    // 依頼の実測ケース（回避 = 初期値 DEX*2 + 職業）。提出済みの他の内訳を残したまま既定値が乗り、
    // 合計が 15 ではなく 95 になる。既定値だけで内訳を作り直す実装はここで赤くなる。
    it('提出済みの他の内訳を残したまま既定値を足す', async () => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(
        partsDefaultTemplate([
          { id: 'initial', label: '初期値', default: { formula: '{parameter.dex} * 2' } },
          { id: 'occupation', label: '職業' }
        ])
      )
      dependencies.diceExecutionService.executeEvaluatedDiceRoll.mockResolvedValue({
        total: 40,
        details: '(3D6*5) ＞ 8[2,3,3]*5 ＞ 40'
      })

      await dependencies.service.instantiate({
        ...instantiateInput,
        values: { 'uid-evade': { parts: { occupation: 15 } } }
      })

      expect(materializedValues(dependencies)['uid-evade']).toStrictEqual({
        parts: { occupation: 15, initial: 80 }
      })
    })

    // 本スライスの最重要点。「宣言は正しいのに静かに 0 になる」不具合を作らないため、評価が ok に
    // ならなかった既定値はキー自体を作らないことを固定する（0 でも null でも undefined でもない）。
    it.each([
      ['参照先の値が未入力（indeterminate）', { formula: '{parameter.bonus}' }],
      ['参照が解決できない（error）', { formula: '{parameter.unknown}' }]
    ])('評価が ok にならない既定値（%s）は内訳キー自体を作らない', async (_caseName, defaultSource) => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(
        partsDefaultTemplate([
          { id: 'initial', label: '初期値', default: 25 },
          { id: 'growth', label: '成長', default: defaultSource }
        ])
      )

      await dependencies.service.instantiate(instantiateInput)

      const parts = materializedValues(dependencies)['uid-evade'].parts
      // toEqual は値が undefined のキーを無視するので、キーの不在は hasOwnProperty で直接見る。
      // 同じ field の解決できた既定値（initial）は入ること込みで固定し、評価失敗が field 全体を
      // 落としているだけの実装では緑にならないようにする。
      expect(Object.prototype.hasOwnProperty.call(parts, 'growth')).toBe(false)
      expect(parts).toStrictEqual({ initial: 25 })
    })

    // 上のテストがキー単位で固定していることを field 単位でも固定する。既定値が 1 つも入らなかった field へ
    // 空の内訳（`{ parts: {} }`）を書くと、値を持たない field が「値がある」状態へ化ける。
    // 参照側の evaluateConstraint はこの差を見ており、キー自体が無ければ indeterminate、`{ parts: {} }` があれば
    // ok / 0 を返す。つまりその field を参照する上限・block cap・pool 合計の表示が、未確定（—）から
    // 0 の断定へ転ぶ。同じ機能の front 側で実際に出た退行と同型なので、field を作らないことまで固定する。
    it('既定値が 1 つも入らなかった field には値そのものを作らない（空の内訳を書かない）', async () => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(
        // 参照先の bonus には誰も値を入れないので、この既定値は indeterminate にしかならない。
        // よって evade は提出値も出目も既定値も持たない field になる。
        partsDefaultTemplate([{ id: 'initial', label: '初期値', default: { formula: '{parameter.bonus}' } }])
      )

      await dependencies.service.instantiate(instantiateInput)

      const values = materializedValues(dependencies)
      // toEqual は値が undefined のキーを無視するので、キーの不在は hasOwnProperty で直接見る。
      expect(Object.prototype.hasOwnProperty.call(values, 'uid-evade')).toBe(false)
      // 作成時ロールで決まった値は残る（既定値の焼き込みが他の field を巻き添えに落としていないこと）。
      expect(values).toStrictEqual({ 'uid-dex': 55 })
    })

    // publish は number 以外の scalar への partsKeys を拒否する（validateNumericAnnotationTarget）ため、
    // publish を経ずに DB へ入った契約外形に対する防壁。内訳を書くと value-input.ts の
    // `isPartsValue && !allowsParts` 拒否に引っかかる値になる。
    it('内訳を持てない field（allowsParts が false）には既定値を適用しない', async () => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(
        partsDefaultTemplate([{ id: 'initial', label: '初期値', default: 25 }], { valueType: 'text' })
      )

      await dependencies.service.instantiate(instantiateInput)

      expect(Object.prototype.hasOwnProperty.call(materializedValues(dependencies), 'uid-evade')).toBe(false)
    })

    // 生値をどの内訳に属すると解釈するかは feature 内で規則が割れている（creation-roll-value.util.ts）。
    // 既定値の焼き込みはその裁定を先取りせず、内訳形でない値には手を出さない。
    it('値が内訳形でない（生の数値）field には既定値を適用しない', async () => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(
        partsDefaultTemplate([{ id: 'initial', label: '初期値', default: 25 }])
      )

      await dependencies.service.instantiate({ ...instantiateInput, values: { 'uid-evade': 30 } })

      expect(materializedValues(dependencies)['uid-evade']).toBe(30)
    })

    // 既定値どうしの依存を観測するための最小テンプレート。参照される bonus を参照する側の evade より
    // 前に宣言してある。焼き込んだ端から次の評価へ渡す逐次適用なら、この順序でだけ evade から
    // bonus の既定値が見える（= 宣言順を入れ替えるだけで結果が変わる形）。
    const chainedDefaultTemplate: CharacterSheetTemplateEntity = {
      ...template,
      sections: [
        {
          id: 'parameter',
          label: 'Parameter',
          fields: [
            {
              id: 'bonus',
              uid: 'uid-bonus',
              label: 'Bonus',
              type: 'scalar',
              valueType: 'number',
              partsKeys: [{ id: 'base', label: '基本', default: 10 }]
            },
            {
              id: 'evade',
              uid: 'uid-evade',
              label: 'Evade',
              type: 'scalar',
              valueType: 'number',
              partsKeys: [
                { id: 'initial', label: '初期値', default: { formula: '{parameter.bonus}' } },
                // 解決できる既定値を 1 つ持たせ、evade 自体は必ず作られる状態にしておく。こうしないと
                // 「1 つも入らなかった field を作らない」防壁の方でも赤くなり、どちらが壊れたか分からなくなる。
                { id: 'occupation', label: '職業', default: 5 }
              ]
            }
          ]
        }
      ]
    }

    // 評価は全ての既定値について「作成時ロール適用後の同一スナップショット」に対して行う、を固定する。
    // 焼き込んだ端から次の評価へ渡す逐次適用にすると、宣言順を変えただけで結果が変わる形になり、
    // 同じテンプレートから作ったキャラの値が並び替え次第で食い違う。依存の解決（トポロジカルソート）が
    // 要るならそれを設計してから入れるのが裁定で、この期待はその未設計状態を守っている。
    it('既定値どうしの依存は解決しない（他 field の既定値は評価から見えない）', async () => {
      const dependencies = createDependencies()
      dependencies.templateService.resolveForCreate.mockResolvedValue(chainedDefaultTemplate)

      await dependencies.service.instantiate(instantiateInput)

      const values = materializedValues(dependencies)
      // 参照される側の既定値は入る。逐次適用なら参照側から見えたはずの値が実在することの確認。
      expect(values['uid-bonus']).toStrictEqual({ parts: { base: 10 } })
      // それでも参照側からは見えないので bonus 参照は indeterminate 止まりで、initial は作られない。
      expect(values['uid-evade']).toStrictEqual({ parts: { occupation: 5 } })
    })
  })

  it('version/published 解決失敗時は後続処理も insert も実行しない', async () => {
    const dependencies = createDependencies()
    dependencies.templateService.resolveForCreate.mockRejectedValue(
      new ConflictException('sheet template must be published at the requested version')
    )

    await expect(dependencies.service.instantiate(instantiateInput)).rejects.toBeInstanceOf(ConflictException)

    expect(dependencies.sheetMaterializer.validateInputValues).not.toHaveBeenCalled()
    expect(dependencies.diceExecutionService.executeEvaluatedDiceRoll).not.toHaveBeenCalled()
    expect(dependencies.sheetMaterializer.materialize).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })

  it('評価または正準形投影に失敗した場合は 422 とし insert しない', async () => {
    const dependencies = createDependencies()
    dependencies.sheetMaterializer.materialize.mockImplementation(() => {
      throw new TypeError('Invalid parameter: expected AttributeSection canonical form')
    })

    await expect(dependencies.service.instantiate(instantiateInput)).rejects.toBeInstanceOf(
      UnprocessableEntityException
    )

    expect(dependencies.characterIdService.generateUniqueCharacterId).not.toHaveBeenCalled()
    expect(dependencies.characterRepository.createMaterializedCharacter).not.toHaveBeenCalled()
  })
})
