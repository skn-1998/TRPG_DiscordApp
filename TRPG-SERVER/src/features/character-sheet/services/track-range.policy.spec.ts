import { UnprocessableEntityException } from '@nestjs/common'
import { evaluateTemplate } from '@trpg/sheet-engine'
import type { SheetField, SheetTemplate } from '@trpg/sheet-engine'
import { DEFAULT_ERROR_RESPONSE_MESSAGE, ErrorResponse } from '../../../core/dto/api-response.dto'
import {
  buildBoundedNonFiniteErrorEnvelope,
  buildSheetErrorEnvelope,
  nonFiniteHttpBodyBytes,
  TrackRangePolicy
} from './track-range.policy'

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

  it('共通エラーラベルをリテラルで固定し、ErrorResponse と sheet 封筒で共有する', () => {
    expect(DEFAULT_ERROR_RESPONSE_MESSAGE).toBe('エラーが発生しました')
    expect(new ErrorResponse('入力値が不正です').message).toBe(DEFAULT_ERROR_RESPONSE_MESSAGE)
    expect(buildSheetErrorEnvelope('入力値が不正です').message).toBe(DEFAULT_ERROR_RESPONSE_MESSAGE)
  })

  it('placeholder 会計と実値注入で固定キー集合を共有する', () => {
    const error = '計算式の結果が有限な数値になりませんでした'
    const issues = [{ fieldUid: 'uid-computed', path: ['uid-computed'], message: error }]
    const placeholderTimestamp = 1_000_000_000_000
    const placeholderRequestId = '00000000-0000-0000-0000-000000000000'
    const actualTimestamp = 1_753_670_800_000
    const actualRequestId = '12345678-1234-1234-1234-123456789abc'
    const placeholderEnvelope = buildSheetErrorEnvelope(
      error,
      { issues },
      {
        timestamp: placeholderTimestamp,
        requestId: placeholderRequestId
      }
    )
    const actualEnvelope = buildSheetErrorEnvelope(
      error,
      { issues },
      {
        timestamp: actualTimestamp,
        requestId: actualRequestId
      }
    )
    const expectedKeys = ['error', 'issues', 'message', 'requestId', 'success', 'timestamp']

    expect(Object.keys(placeholderEnvelope).sort()).toEqual(expectedKeys)
    expect(Object.keys(actualEnvelope).sort()).toEqual(Object.keys(placeholderEnvelope).sort())
    expect(actualEnvelope.timestamp).toBe(actualTimestamp)
    expect(actualEnvelope.requestId).toBe(actualRequestId)
  })

  it('固定 diagnostic 1 件の最終 wire モデルを 678 bytes に固定する', () => {
    const nestBody = buildBoundedNonFiniteErrorEnvelope([
      {
        kind: 'computed',
        fieldUid: 'uid-computed',
        label: 'Computed',
        formula: '1 / 0',
        result: 'Infinity'
      }
    ])

    expect(nonFiniteHttpBodyBytes(nestBody)).toBe(678)
  })

  it.each([
    ['既存違反の拡大', 12, 13],
    ['範囲内からの新規逸脱', 8, 11],
    ['max側からmin側への逸脱', 12, -1],
    ['min側からmax側への逸脱', -2, 11],
    ['partsでmax側からmin側への逸脱', { parts: { base: 12 } }, { parts: { base: -1 } }],
    ['partsでmin側からmax側への逸脱', { parts: { base: -2 } }, { parts: { base: 11 } }]
  ])('%sを判定表どおり拒否する', (_caseName, currentValue, nextValue) => {
    const policy = new TrackRangePolicy(trackTemplate())
    const action = () => policy.assertNoWorsenedTrackValues({ 'uid-hp': currentValue }, { 'uid-hp': nextValue })

    expect(action).toThrow(UnprocessableEntityException)
  })

  it.each([
    ['同じ合計を異なるparts表現で維持', { parts: { base: 12 } }, { parts: { base: 6, other: 6 } }],
    ['既存違反の縮小', 12, 11]
  ])('%sを判定表どおり許可する', (_caseName, currentValue, nextValue) => {
    const policy = new TrackRangePolicy(trackTemplate())
    const action = () => policy.assertNoWorsenedTrackValues({ 'uid-hp': currentValue }, { 'uid-hp': nextValue })

    expect(action).not.toThrow()
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

    // 19.999999999999996/5 は max=3.9999999999999996 となり、入力 4 との差は約 4.4e-16。
    // 範囲判定が engine と同じ EPSILON(1e-9) 許容を失って素の大小比較へ退行すると、
    // この二進浮動小数の丸め残差だけで新規違反と判定されるため、ここで許容を固定する。
    expect(() =>
      new TrackRangePolicy(template).assertNoWorsenedTrackValues({}, { 'uid-pow': 19.999999999999996, 'uid-hp': 4 })
    ).not.toThrow()
  })

  it.each([
    ['正方向', { a: Number.MAX_VALUE, b: Number.MAX_VALUE }, 'Infinity'],
    ['負方向', { a: -Number.MAX_VALUE, b: -Number.MAX_VALUE }, '-Infinity']
  ])('parts 合計の%sオーバーフローを共通 track-input 診断で拒否する', (_direction, parts, result) => {
    const policy = new TrackRangePolicy(trackTemplate())
    let failure: unknown

    try {
      policy.assertNoWorsenedTrackValues({}, { 'uid-hp': { parts } })
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as { message: string }
    expect(response.message).toContain('トラックの入力値が有限な数値になりませんでした')
    expect(response.message).toContain('フィールド: uid-hp')
    expect(response.message).toContain('ラベル: HP')
    expect(response.message).toContain('入力箇所: parts 合計')
    expect(response.message).toContain(`結果: ${result}`)
    expect(response.message).not.toContain('outside resolved bounds')
  })

  it.each([
    ['正方向overflowから範囲内', { parts: { first: Number.MAX_VALUE, second: Number.MAX_VALUE } }, 5],
    ['正方向overflowから同じmax側の20', { parts: { first: Number.MAX_VALUE, second: Number.MAX_VALUE } }, 20],
    ['正方向overflowから同じmax側の11', { parts: { first: Number.MAX_VALUE, second: Number.MAX_VALUE } }, 11],
    ['負方向overflowから同じmin側の-5', { parts: { first: -Number.MAX_VALUE, second: -Number.MAX_VALUE } }, -5]
  ])('既存の parts 合計%sへの有限な縮小更新を許可する', (_caseName, currentValue, nextValue) => {
    const policy = new TrackRangePolicy(trackTemplate())

    expect(() => policy.assertNoWorsenedTrackValues({ 'uid-hp': currentValue }, { 'uid-hp': nextValue })).not.toThrow()
  })

  it.each([
    ['Infinityから範囲内', Number.POSITIVE_INFINITY, 5],
    ['Infinityからmax側範囲外', Number.POSITIVE_INFINITY, 20],
    ['-Infinityから範囲内', Number.NEGATIVE_INFINITY, 5],
    ['-Infinityからmin側範囲外', Number.NEGATIVE_INFINITY, -5],
    ['NaNから範囲内', Number.NaN, 5],
    ['NaNからmax側範囲外', Number.NaN, 20],
    ['NaNからmin側範囲外', Number.NaN, -5]
  ])('既存の直接入力%sへの修復更新を許可する', (_caseName, currentValue, nextValue) => {
    const policy = new TrackRangePolicy(trackTemplate())

    expect(() => policy.assertNoWorsenedTrackValues({ 'uid-hp': currentValue }, { 'uid-hp': nextValue })).not.toThrow()
  })

  it('有限な既存値から parts 合計 overflow への更新は引き続き拒否する', () => {
    const policy = new TrackRangePolicy(trackTemplate())

    expect(() =>
      policy.assertNoWorsenedTrackValues(
        { 'uid-hp': 5 },
        { 'uid-hp': { parts: { first: Number.MAX_VALUE, second: Number.MAX_VALUE } } }
      )
    ).toThrow(UnprocessableEntityException)
  })

  it('数値でない既存 parts からの修復更新は引き続き拒否する', () => {
    const policy = new TrackRangePolicy(trackTemplate())

    expect(() => policy.assertNoWorsenedTrackValues({ 'uid-hp': { parts: { base: 'x' } } }, { 'uid-hp': 5 })).toThrow(
      UnprocessableEntityException
    )
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

  it('legacy materialize の非有限評価も resource-eval 共通診断を使う', () => {
    const template = trackTemplate()
    const policy = new TrackRangePolicy(template)
    const evaluated = {
      ...evaluateTemplate(template, { values: { 'uid-hp': 12 } }),
      values: { 'uid-hp': { type: 'number' as const, value: Number.POSITIVE_INFINITY } }
    }
    let failure: unknown

    try {
      policy.toLegacyCompatibleMaterializationValues({ 'uid-hp': 11 }, { 'uid-hp': 12 }, evaluated)
    } catch (error) {
      failure = error
    }

    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    const response = (failure as UnprocessableEntityException).getResponse() as { message: string }
    expect(response.message).toContain('リソースフィールドの計算結果が有限な数値になりませんでした')
    expect(response.message).toContain('フィールド: uid-hp')
    expect(response.message).toContain('ラベル: HP')
    expect(response.message).toContain('結果: Infinity')
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
