import { UnprocessableEntityException } from '@nestjs/common'
import { evaluateTemplate } from '@trpg/sheet-engine'
import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { TrackRangePolicy } from './track-range.policy'

describe('TrackRangePolicy', () => {
  const trackTemplate = (max: number | { formula: string } = 10): SheetTemplate => ({
    templateId: 'template-1',
    version: '1.0.0',
    schemaVersion: 3,
    name: 'Track template',
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
            max,
            style: 'gauge',
            role: { kind: 'resource', deltas: [-1, 1] }
          }
        ]
      }
    ],
    tables: [],
    settings: { rounding: 'floor' }
  })

  const parameterBoundTemplate = (): SheetTemplate => ({
    ...trackTemplate(),
    sections: [
      {
        id: 'parameter',
        label: 'Parameter',
        fields: [
          {
            id: 'limit',
            uid: 'uid-limit',
            label: 'Limit',
            type: 'scalar',
            valueType: 'number'
          }
        ]
      },
      {
        ...trackTemplate().sections[0],
        fields: (trackTemplate().sections[0].fields as SheetField[]).map((field) => ({
          ...field,
          max: { formula: '{parameter.limit}' }
        }))
      }
    ]
  })

  it.each([
    ['同じ合計を異なるparts表現で維持', { parts: { base: 12 } }, { parts: { base: 6, other: 6 } }, false],
    ['既存違反の縮小', 12, 11, false],
    ['既存違反の拡大', 12, 13, true],
    ['範囲内からの新規逸脱', 8, 11, true],
    ['max側からmin側への逸脱', 12, -1, true],
    ['min側からmax側への逸脱', -2, 11, true],
    ['partsでmax側からmin側への逸脱', { parts: { base: 12 } }, { parts: { base: -1 } }, true],
    ['partsでmin側からmax側への逸脱', { parts: { base: -2 } }, { parts: { base: 11 } }, true]
  ])('%sを判定表どおり扱う', (_caseName, currentValue, nextValue, rejects) => {
    const policy = new TrackRangePolicy(trackTemplate())
    const action = () => policy.assertNoWorsenedTrackValues({ 'uid-hp': currentValue }, { 'uid-hp': nextValue })

    if (rejects) {
      expect(action).toThrow(UnprocessableEntityException)
    } else {
      expect(action).not.toThrow()
    }
  })

  it('max依存値とtrack値を同時更新し、next bounds内へ縮小する更新を許可する', () => {
    const policy = new TrackRangePolicy(parameterBoundTemplate())

    expect(() =>
      policy.assertNoWorsenedTrackValues({ 'uid-limit': 10, 'uid-hp': 8 }, { 'uid-limit': 5, 'uid-hp': 5 })
    ).not.toThrow()
  })

  it('current boundsでは範囲内でも、next boundsで新規違反になる同時更新を拒否する', () => {
    const policy = new TrackRangePolicy(parameterBoundTemplate())

    expect(() =>
      policy.assertNoWorsenedTrackValues({ 'uid-limit': 10, 'uid-hp': 5 }, { 'uid-limit': 5, 'uid-hp': 8 })
    ).toThrow(UnprocessableEntityException)
  })

  it.each([
    [
      'current=15/20からnext=12/10へ違反量を5から2へ縮小',
      { 'uid-limit': 20, 'uid-hp': 15 },
      { 'uid-limit': 10, 'uid-hp': 12 }
    ],
    [
      'current=8/10からnext=7/5へ違反量を3から2へ縮小',
      { 'uid-limit': 10, 'uid-hp': 8 },
      { 'uid-limit': 5, 'uid-hp': 7 }
    ]
  ])('current/nextを同じnext boundsで比較して%sする更新を許可する', (_caseName, current, next) => {
    const policy = new TrackRangePolicy(parameterBoundTemplate())

    expect(() => policy.assertNoWorsenedTrackValues(current, next)).not.toThrow()
  })

  it('track入力が同じなら、依存値低下だけで境界外になっても拒否しない', () => {
    const policy = new TrackRangePolicy(parameterBoundTemplate())

    expect(() =>
      policy.assertNoWorsenedTrackValues({ 'uid-limit': 12, 'uid-hp': 12 }, { 'uid-limit': 11, 'uid-hp': 12 })
    ).not.toThrow()
  })

  it('別trackを参照するformula maxでも、参照先trackだけの更新を拒否しない', () => {
    const template: SheetTemplate = {
      ...trackTemplate(),
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
              max: 10,
              style: 'gauge'
            },
            {
              id: 'mp',
              uid: 'uid-mp',
              label: 'MP',
              type: 'track',
              min: 0,
              max: { formula: '{status.hp}' },
              style: 'gauge'
            }
          ]
        }
      ]
    }
    const policy = new TrackRangePolicy(template)

    expect(() =>
      policy.assertNoWorsenedTrackValues({ 'uid-hp': 10, 'uid-mp': 10 }, { 'uid-hp': 9, 'uid-mp': 10 })
    ).not.toThrow()
  })

  it('computed fieldを経由するformula maxで新規逸脱を拒否する', () => {
    const template: SheetTemplate = {
      ...trackTemplate(),
      sections: [
        {
          id: 'parameter',
          label: 'Parameter',
          fields: [
            {
              id: 'limit',
              uid: 'uid-limit',
              label: 'Limit',
              type: 'scalar',
              valueType: 'number'
            },
            {
              id: 'ceiling',
              uid: 'uid-ceiling',
              label: 'Ceiling',
              type: 'computed',
              resultType: 'number',
              formula: '{parameter.limit} * 2'
            }
          ]
        },
        {
          ...trackTemplate().sections[0],
          fields: (trackTemplate().sections[0].fields as SheetField[]).map((field) => ({
            ...field,
            max: { formula: '{parameter.ceiling}' }
          }))
        }
      ]
    }
    const policy = new TrackRangePolicy(template)

    expect(() =>
      policy.assertNoWorsenedTrackValues({ 'uid-limit': 5, 'uid-hp': 8 }, { 'uid-limit': 5, 'uid-hp': 11 })
    ).toThrow(UnprocessableEntityException)
  })

  it('未変更trackのformula maxがmin未満になっても無関係な保存を拒否しない', () => {
    const template = parameterBoundTemplate()
    const currentValues = { 'uid-limit': 1, 'uid-hp': 1 }
    const nextValues = { 'uid-limit': -1, 'uid-hp': 1 }
    const policy = new TrackRangePolicy(template)
    const evaluated = evaluateTemplate(template, { values: nextValues })

    expect(() => policy.assertNoWorsenedTrackValues(currentValues, nextValues)).not.toThrow()
    expect(() => policy.toLegacyCompatibleMaterializationValues(currentValues, nextValues, evaluated)).not.toThrow()
  })

  it('engineと同じ1e-9以内の浮動小数差を範囲違反にしない', () => {
    const template: SheetTemplate = {
      ...parameterBoundTemplate(),
      sections: [
        {
          id: 'parameter',
          label: 'Parameter',
          fields: [
            {
              id: 'pow',
              uid: 'uid-pow',
              label: 'POW',
              type: 'scalar',
              valueType: 'number'
            }
          ]
        },
        {
          ...trackTemplate().sections[0],
          fields: (trackTemplate().sections[0].fields as SheetField[]).map((field) => ({
            ...field,
            max: { formula: '{parameter.pow}/5' }
          }))
        }
      ]
    }

    expect(() =>
      new TrackRangePolicy(template).assertCreationValuesWithinBounds({
        'uid-pow': 19.999999999999996,
        'uid-hp': 4
      })
    ).not.toThrow()
  })

  it('legacy partsはmaterialize用だけクランプし、元の入力値を保持する', () => {
    const template = trackTemplate()
    const values = { 'uid-hp': { parts: { base: 999, other: 0 } } }
    const evaluated = evaluateTemplate(template, { values })
    const policy = new TrackRangePolicy(template)

    expect(policy.toLegacyCompatibleMaterializationValues(values, values, evaluated)).toEqual({
      'uid-hp': 10
    })
    expect(values).toEqual({ 'uid-hp': { parts: { base: 999, other: 0 } } })
  })

  it('同じvalues snapshotの同一field boundsをメモ化する', () => {
    const template = parameterBoundTemplate()
    const field = template.sections[1].fields[0] as Extract<SheetField, { type: 'track' }>
    const values = { 'uid-limit': 10, 'uid-hp': 8 }
    const policy = new TrackRangePolicy(template)

    const first = policy.resolveBounds(field, values)
    const second = policy.resolveBounds(field, values)

    expect(second).toBe(first)
  })

  it('同じpolicyでも異なるvalues snapshotには別のboundsを返す', () => {
    const template = parameterBoundTemplate()
    const field = template.sections[1].fields[0] as Extract<SheetField, { type: 'track' }>
    const policy = new TrackRangePolicy(template)

    const first = policy.resolveBounds(field, { 'uid-limit': 10, 'uid-hp': 8 })
    const second = policy.resolveBounds(field, { 'uid-limit': 5, 'uid-hp': 4 })

    expect(first).toEqual({ min: 0, max: 10 })
    expect(second).toEqual({ min: 0, max: 5 })
    expect(second).not.toBe(first)
  })
})
