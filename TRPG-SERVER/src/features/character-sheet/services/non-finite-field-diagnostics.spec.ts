import { UnprocessableEntityException } from '@nestjs/common'
import type { SheetField } from '@trpg/sheet-engine'
import type { CharacterSheetTemplateEntity } from '../../../domains/character-sheet-template/models/character-sheet-template.entity'
import { toEngineTemplate } from '../../../domains/character-sheet-template/validation/sheet-engine-template.mapper'
import { SheetMaterializerService } from './sheet-materializer.service'
import {
  buildBoundedNonFiniteErrorEnvelope,
  type NonFiniteFieldDiagnostic,
  TrackRangePolicy
} from './track-range.policy'

describe('non-finite field diagnostics', () => {
  const templateWithFields = (fields: SheetField[]): CharacterSheetTemplateEntity => ({
    templateId: 'non-finite-diagnostics-template',
    status: 'published',
    version: '1.0.0',
    schemaVersion: 3,
    name: 'Non-finite diagnostics',
    gameSystemId: 'DiceBot',
    tags: [],
    visibility: 'public',
    authorDiscordUserId: 'owner-1',
    sections: [{ id: 'parameter', label: 'Parameter', fields }],
    tables: [],
    settings: { rounding: 'floor' },
    draftRevision: 1
  })

  const materialize = (template: CharacterSheetTemplateEntity, values: Record<string, unknown>) =>
    new SheetMaterializerService().materialize({
      template,
      sheet: {
        templateId: template.templateId,
        templateVersion: template.version,
        revision: 1,
        visibility: 'private',
        values
      }
    })

  const captureUnprocessable = (action: () => unknown): UnprocessableEntityException => {
    let failure: unknown
    try {
      action()
    } catch (error) {
      failure = error
    }
    expect(failure).toBeInstanceOf(UnprocessableEntityException)
    return failure as UnprocessableEntityException
  }

  it('roll は従来成功する有限数・文字列を保存可能なまま保ち、非有限数は識別可能な 422 にする', () => {
    const template = templateWithFields([
      { id: 'luck', uid: 'uid-luck', label: 'Luck', type: 'roll', notation: '1d100' },
      { id: 'damage', uid: 'uid-damage', label: 'Damage', type: 'roll', notation: '1d6' }
    ])

    expect(materialize(template, { 'uid-luck': 42, 'uid-damage': '1d6+1' }).sheet.values).toEqual({
      'uid-luck': 42,
      'uid-damage': '1d6+1'
    })

    const exception = captureUnprocessable(() =>
      materialize(template, { 'uid-luck': Number.POSITIVE_INFINITY, 'uid-damage': '1d6+1' })
    )
    const response = exception.getResponse() as {
      statusCode: number
      message: string
      issues: Array<{ fieldUid?: string; path: string[]; message: string }>
    }
    const expectedMessage =
      'ロール結果が有限な数値になりませんでした（フィールド: uid-luck / ラベル: Luck / 結果: Infinity）。有限な数値または文字列のロール結果を確認してください'

    expect(exception.getStatus()).toBe(422)
    expect(response).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: expectedMessage,
      issues: [{ fieldUid: 'uid-luck', path: ['uid-luck'], message: expectedMessage }]
    })
    expect(response.message).not.toBe('Character sheet values are invalid')
  })

  it.each([
    {
      name: '未知 uid だけ',
      values: { 'uid-unknown': 1 },
      expectedIssues: [expect.objectContaining({ fieldUid: 'uid-unknown' })],
      expectedMessage: 'Character sheet values are invalid'
    },
    {
      name: '非有限 roll だけ',
      values: { 'uid-luck': Number.POSITIVE_INFINITY },
      expectedIssues: [expect.objectContaining({ fieldUid: 'uid-luck' })],
      expectedMessage: 'ロール結果が有限な数値になりませんでした'
    },
    {
      name: '非有限 roll と未知 uid の同時入力',
      values: { 'uid-luck': Number.POSITIVE_INFINITY, 'uid-unknown': 1 },
      expectedIssues: [
        expect.objectContaining({
          fieldUid: 'uid-luck',
          path: ['uid-luck'],
          message: expect.stringContaining('ロール結果が有限な数値になりませんでした')
        }),
        {
          fieldUid: 'uid-unknown',
          path: ['uid-unknown'],
          message: 'field uid-unknown is not defined by the template'
        }
      ],
      expectedMessage: 'ロール結果が有限な数値になりませんでした'
    }
  ])('$name で蓄積済み issue をまとめて返す', ({ values, expectedIssues, expectedMessage }) => {
    const template = templateWithFields([
      { id: 'luck', uid: 'uid-luck', label: 'Luck', type: 'roll', notation: '1d100' },
      { id: 'score', uid: 'uid-score', label: 'Score', type: 'scalar', valueType: 'number' }
    ])

    const exception = captureUnprocessable(() => materialize(template, values))
    const response = exception.getResponse() as {
      message: string
      issues: Array<{ fieldUid?: string; path: string[]; message: string }>
    }

    expect(response.message).toContain(expectedMessage)
    expect(response.issues).toEqual(expectedIssues)
  })

  it.each([3, 10])('未知 uid が %i 件あっても予算に余裕があれば非有限 issue を保持する', (unknownCount) => {
    const template = templateWithFields([
      { id: 'luck', uid: 'uid-luck', label: 'Luck', type: 'roll', notation: '1d100' }
    ])
    const values = Object.fromEntries([
      ['uid-luck', Number.POSITIVE_INFINITY],
      ...Array.from({ length: unknownCount }, (_, index) => [`unknown-${index}`, index])
    ])

    const response = captureUnprocessable(() => materialize(template, values)).getResponse() as {
      issues: Array<{ fieldUid?: string; path: string[]; message: string }>
    }

    expect(Buffer.byteLength(JSON.stringify(response), 'utf8')).toBeLessThanOrEqual(4_096)
    expect(response.issues[0]).toEqual(
      expect.objectContaining({
        fieldUid: 'uid-luck',
        path: ['uid-luck'],
        message: expect.stringContaining('ロール結果が有限な数値になりませんでした')
      })
    )
    expect(response.issues.map((issue) => issue.fieldUid)).toContain('uid-luck')
  })

  it('track max は従来成功する有限式を許可したまま、非有限式の実原因を uid・ラベルつき 422 にする', () => {
    const formula = '{parameter.numerator} / {parameter.denominator}'
    const template = templateWithFields([
      {
        id: 'numerator',
        uid: 'uid-numerator',
        label: 'Numerator',
        type: 'scalar',
        valueType: 'number'
      },
      {
        id: 'denominator',
        uid: 'uid-denominator',
        label: 'Denominator',
        type: 'scalar',
        valueType: 'number'
      },
      {
        id: 'hp',
        uid: 'uid-hp',
        label: 'HP',
        type: 'track',
        min: 0,
        max: { formula },
        style: 'gauge'
      }
    ])
    const policy = new TrackRangePolicy(toEngineTemplate(template))

    expect(() =>
      policy.assertFiniteTrackValues(
        {},
        {
          'uid-numerator': 10,
          'uid-denominator': 2,
          'uid-hp': 4
        }
      )
    ).not.toThrow()

    const exception = captureUnprocessable(() =>
      policy.assertFiniteTrackValues(
        {},
        {
          'uid-numerator': 10,
          'uid-denominator': 0,
          'uid-hp': 4
        }
      )
    )
    const detail = 'formula did not produce a finite number'
    const expectedMessage = `トラック最大値の計算に失敗しました（フィールド: uid-hp / ラベル: HP / 式: ${formula} / 原因: ${detail}）。最大値の式を確認してください`

    expect(exception.getStatus()).toBe(422)
    expect(exception.getResponse()).toEqual({
      statusCode: 422,
      error: 'Unprocessable Entity',
      message: expectedMessage,
      issues: [{ fieldUid: 'uid-hp', path: ['uid-hp'], message: expectedMessage }]
    })
  })

  it('track 入力値は従来成功する有限数を許可したまま、非有限数を uid・ラベルつき 422 にする', () => {
    const template = templateWithFields([
      {
        id: 'hp',
        uid: 'uid-hp',
        label: 'HP',
        type: 'track',
        min: 0,
        max: 10,
        style: 'gauge'
      }
    ])
    const policy = new TrackRangePolicy(toEngineTemplate(template))

    expect(() => policy.assertFiniteTrackValues({}, { 'uid-hp': 5 })).not.toThrow()

    const exception = captureUnprocessable(() =>
      policy.assertFiniteTrackValues({}, { 'uid-hp': Number.NEGATIVE_INFINITY })
    )
    const expectedMessage =
      'トラックの入力値が有限な数値になりませんでした（フィールド: uid-hp / ラベル: HP / 入力箇所: フィールド値 / 結果: -Infinity）。有限な数値を入力してください'
    const response = exception.getResponse() as { statusCode: number; message: string; error: string }

    expect(exception.getStatus()).toBe(422)
    expect(response).toEqual({
      statusCode: 422,
      message: expectedMessage,
      error: 'Unprocessable Entity',
      issues: [{ fieldUid: 'uid-hp', path: ['uid-hp'], message: expectedMessage }]
    })
  })

  it('多数の非有限 roll でも先頭3件と省略件数だけを返し、レスポンスを一定サイズに制限する', () => {
    const fieldCount = 20
    const template = templateWithFields(
      Array.from({ length: fieldCount }, (_, index) => ({
        id: `roll_${index}`,
        uid: `uid-roll-${index}`,
        label: `Roll ${index}`,
        type: 'roll' as const,
        notation: '1d100'
      }))
    )
    const values = Object.fromEntries(
      Array.from({ length: fieldCount }, (_, index) => [`uid-roll-${index}`, Number.POSITIVE_INFINITY])
    )

    const exception = captureUnprocessable(() => materialize(template, values))
    const response = exception.getResponse() as {
      statusCode: number
      message: string
      issues: Array<{ fieldUid?: string; message: string }>
    }
    const responseBytes = Buffer.byteLength(JSON.stringify(response), 'utf8')

    expect(response).toEqual(
      expect.objectContaining({
        statusCode: 422,
        message: expect.stringContaining(`ほか ${fieldCount - 3} 件`),
        issues: [
          expect.objectContaining({ fieldUid: 'uid-roll-0' }),
          expect.objectContaining({ fieldUid: 'uid-roll-1' }),
          expect.objectContaining({ fieldUid: 'uid-roll-2' })
        ]
      })
    )
    expect(response.message).not.toContain('uid-roll-3')
    expect(responseBytes).toBeLessThanOrEqual(4_096)
  })

  it('敵対的な JSON 文字列要素と診断件数でも formatter は throw しない', () => {
    const adversarialCharacters = ['\0', '"', '\\', '\u2028', '😀']
    const components: Array<
      keyof Pick<NonFiniteFieldDiagnostic, 'fieldUid' | 'label' | 'formula' | 'detail' | 'inputLocation'>
    > = ['fieldUid', 'label', 'formula', 'detail', 'inputLocation']
    const counts = [1, 2, 3, 4, 11, 12, 13, 101, 102, 103, 1_001, 1_002, 1_003, 9_999, 10_000]

    expect(() => {
      for (const character of adversarialCharacters) {
        const longText = character.repeat(100_000)
        for (const component of components) {
          const diagnostic = {
            kind: 'computed',
            fieldUid: 'uid-computed',
            result: 'Infinity',
            [component]: longText
          } as NonFiniteFieldDiagnostic
          for (const count of counts) {
            const result = buildBoundedNonFiniteErrorEnvelope(Array.from({ length: count }, () => diagnostic))
            expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThanOrEqual(4_096)
          }
        }
      }
      const emptyResult = buildBoundedNonFiniteErrorEnvelope([])
      expect(Buffer.byteLength(JSON.stringify(emptyResult), 'utf8')).toBeLessThanOrEqual(4_096)
    }).not.toThrow()
  })

  it('診断件数1〜10,000の全件で formatter は throw しない', () => {
    const diagnostic: NonFiniteFieldDiagnostic = {
      kind: 'computed',
      fieldUid: 'uid-computed',
      label: 'Computed',
      formula: '1 / 0',
      result: 'Infinity'
    }
    const diagnostics = Array.from({ length: 10_000 }, () => diagnostic)

    expect(() => {
      for (let count = diagnostics.length; count > 0; count -= 1) {
        diagnostics.length = count
        const result = buildBoundedNonFiniteErrorEnvelope(diagnostics)
        expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThanOrEqual(4_096)
      }
    }).not.toThrow()
  })

  it('空診断の安全網でも既存 issue 全体を会計し、長大 issue は丸ごと落とす', () => {
    const longUid = 'u'.repeat(100_000)
    const formatted = buildBoundedNonFiniteErrorEnvelope(
      [],
      [
        {
          fieldUid: longUid,
          path: [longUid],
          message: `field ${longUid} is not defined by the template`
        }
      ]
    )

    expect(Buffer.byteLength(JSON.stringify(formatted), 'utf8')).toBeLessThanOrEqual(4_096)
    expect(formatted.message).toContain('テンプレート未定義フィールド')
    expect(formatted.issues).toEqual([])
  })

  it('NUL の component 上限は UTF-8 生値ではなく最終封筒の JSON.stringify 後の長さで数える', () => {
    const formatted = buildBoundedNonFiniteErrorEnvelope([
      {
        kind: 'computed',
        fieldUid: 'uid-computed',
        label: '\0'.repeat(100_000),
        result: 'Infinity'
      }
    ])

    expect(Buffer.byteLength(JSON.stringify(formatted), 'utf8')).toBeLessThanOrEqual(4_096)
    expect(formatted.message).not.toContain('\0'.repeat(100_000))
    expect(formatted.issues).toEqual([expect.objectContaining({ fieldUid: 'uid-computed', path: ['uid-computed'] })])
  })
})
