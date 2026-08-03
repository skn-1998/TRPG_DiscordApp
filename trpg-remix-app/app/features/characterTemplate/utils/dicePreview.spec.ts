import type { EvaluationResult, SheetTemplate } from '@trpg/sheet-engine'
import {
  buildDicePreviewRequest,
  classifyDicePreviewError,
  DICE_PREVIEW_NETWORK_ERROR_CODE,
  NOTATION_INTERPOLATION_ERROR_MESSAGE,
  readDicePreviewActionData
} from './dicePreview'

const template: SheetTemplate = {
  templateId: 'template-1',
  name: 'CoC preview',
  version: '1.0.0',
  schemaVersion: 3,
  gameSystemId: 'Cthulhu7th',
  tags: [],
  visibility: 'private',
  authorDiscordUserId: 'user-1',
  sections: [
    {
      id: 'derived',
      label: '派生値',
      fields: [
        {
          id: 'db',
          uid: 'derived-db',
          label: 'ダメージボーナス',
          type: 'computed',
          resultType: 'dice',
          formula: '0'
        }
      ]
    }
  ],
  tables: [],
  settings: { rounding: 'floor' }
}

const evaluated: EvaluationResult = {
  values: { 'derived-db': { type: 'dice', value: '+1d4' } },
  rows: {},
  evaluationOrder: ['derived-db'],
  resolvedRefs: []
}

describe('buildDicePreviewRequest', () => {
  it('参照を補間した最終式と gameSystemId を request に組み立てる', () => {
    expect(
      buildDicePreviewRequest({
        template,
        evaluated,
        notation: '1d8{derived.db}',
        gameSystemId: 'Cthulhu7th'
      })
    ).toEqual({
      ok: true,
      request: { notation: '1d8+1d4', gameSystemId: 'Cthulhu7th' }
    })
  })

  it('gameSystemId が無い場合は request から省略する', () => {
    expect(buildDicePreviewRequest({ template, evaluated, notation: '1d6' })).toEqual({
      ok: true,
      request: { notation: '1d6' }
    })
  })

  it.each([
    ['評価結果が無い', null],
    ['参照先が evaluated に無い', { ...evaluated, values: {} }]
  ])('%s 場合は request を作らずローカルエラーにする', (_label, unavailableEvaluation) => {
    expect(
      buildDicePreviewRequest({
        template,
        evaluated: unavailableEvaluation,
        notation: '1d8{derived.db}'
      })
    ).toEqual({ ok: false, error: NOTATION_INTERPOLATION_ERROR_MESSAGE })
  })
})

describe('classifyDicePreviewError', () => {
  it.each([
    [400, 'standalone roll expression must contain a dice term', 'ダイス記法が不正です。'],
    [422, 'invalid notation', 'BCDice がこのダイス記法を受理できませんでした。'],
    [429, 'dice preview rate limit exceeded', 'ロール回数の上限に達しました。']
  ])('status %i を固有の文言へ分類する', (status, message, expectedPrefix) => {
    const classified = classifyDicePreviewError({ status, message })

    expect(classified).toContain(expectedPrefix)
    expect(classified).toContain(message)
  })

  it('network failure は notation 不正とは異なる文言にする', () => {
    const networkMessage = classifyDicePreviewError({
      status: 502,
      message: 'upstream unavailable',
      code: DICE_PREVIEW_NETWORK_ERROR_CODE
    })
    const notationMessage = classifyDicePreviewError({ status: 400, message: 'invalid notation' })

    expect(networkMessage).toBe('ダイスロールサーバーに接続できませんでした。通信状態を確認して再試行してください。')
    expect(networkMessage).not.toBe(notationMessage)
  })
})

describe('readDicePreviewActionData', () => {
  it('有限 total と details を成功結果として読む', () => {
    expect(readDicePreviewActionData({ total: 9, details: '(2D6) ＞ 9[4,5]' })).toEqual({
      ok: true,
      result: { total: 9, details: '(2D6) ＞ 9[4,5]' }
    })
  })

  it('Nest の message 配列を status ごとのエラーへ変換する', () => {
    expect(
      readDicePreviewActionData({
        statusCode: 422,
        message: ['invalid notation', 'BCDice rejected'],
        error: 'Unprocessable Entity'
      })
    ).toEqual({
      ok: false,
      error: 'BCDice がこのダイス記法を受理できませんでした。 invalid notation / BCDice rejected'
    })
  })

  it('応答データが無い場合は network failure として扱う', () => {
    expect(readDicePreviewActionData(undefined)).toEqual({
      ok: false,
      error: 'ダイスロールサーバーに接続できませんでした。通信状態を確認して再試行してください。'
    })
  })
})
