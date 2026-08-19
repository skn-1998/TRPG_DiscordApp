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
