import { extractApiErrorMessages } from './sheetTemplateApi'

jest.mock(
  '~/lib/api-client',
  () => ({
    apiClient: {},
    withJwt: jest.fn()
  }),
  { virtual: true }
)

// TRPG-SERVER の track-range.policy.ts（buildBoundedNonFiniteErrorEnvelope /
// buildNonFiniteFieldMessage / existingIssueCauseMessage）が生成する診断メッセージ形を
// フロントの fixture へ忠実に射影する。envelope.error は各 field 診断を 1 本にまとめた
// 集約スーパーセット文字列、issues[].message は field 単位という builder の関係を再現する。
const TRACK_INPUT_SUMMARY = 'トラックの入力値が有限な数値になりませんでした'
const TRACK_INPUT_GUIDANCE = '有限な数値を入力してください'
const HP_DETAIL = 'フィールド: hp / ラベル: HP / 入力箇所: フィールド値 / 結果: Infinity'
const MP_DETAIL = 'フィールド: mp / ラベル: MP / 入力箇所: フィールド値 / 結果: NaN'
// buildNonFiniteFieldMessage の single-field 形（`${summary}（${detail}）。${guidance}`）。
const HP_ISSUE_MESSAGE = `${TRACK_INPUT_SUMMARY}（${HP_DETAIL}）。${TRACK_INPUT_GUIDANCE}`
const MP_ISSUE_MESSAGE = `${TRACK_INPUT_SUMMARY}（${MP_DETAIL}）。${TRACK_INPUT_GUIDANCE}`
// 複数診断を「；」で連結した集約 message（filter 適用後の Nest body message = wire envelope.error）。
const AGGREGATED_ERROR = `${TRACK_INPUT_SUMMARY}（${HP_DETAIL}；${MP_DETAIL}）。${TRACK_INPUT_GUIDANCE}`
// existingIssueCauseMessage が 'is not an input field' を要約した接頭辞。
const EXISTING_ISSUE_CAUSE = '既存入力の問題: 入力不可フィールド。'
const LEGACY_EXISTING_ISSUE_MESSAGE = 'field "old" is not an input field'
// buildBoundedNonFiniteErrorEnvelope の最小フォールバック（MINIMAL_NON_FINITE_ERROR_ENVELOPE）。
const MINIMAL_NON_FINITE_ERROR = '入力値の検証に失敗しました。入力値を確認してください'

describe('extractApiErrorMessages', () => {
  describe('ErrorEnvelope', () => {
    it('診断2件: error 集約文字列を落とし、各 field 診断を 1 回ずつ返す', () => {
      // 実 builder（buildBoundedNonFiniteErrorEnvelope([hp, mp])）の wire 射影。
      // error は hp・mp を 1 本にまとめた集約、issues は field 単位。
      const error = {
        response: {
          data: {
            success: false,
            message: 'エラーが発生しました',
            timestamp: 1_000_000_000_000,
            requestId: '00000000-0000-0000-0000-000000000000',
            error: AGGREGATED_ERROR,
            issues: [
              { fieldUid: 'hp', path: ['hp'], message: HP_ISSUE_MESSAGE },
              { fieldUid: 'mp', path: ['mp'], message: MP_ISSUE_MESSAGE }
            ]
          }
        }
      }

      const result = extractApiErrorMessages(error)

      expect(result).toEqual([HP_ISSUE_MESSAGE, MP_ISSUE_MESSAGE])
      // 集約スーパーセット文字列は含めない（含めると各 field 診断が二重表示になる）。
      expect(result).not.toContain(AGGREGATED_ERROR)
    })

    it('診断1件＋既存 issue 1件: 接頭辞が異なっても issues 由来の2件だけを返す', () => {
      // buildBoundedNonFiniteErrorEnvelope([hp], [existing]) の wire 射影。
      const error = {
        response: {
          data: {
            success: false,
            message: 'エラーが発生しました',
            timestamp: 1_000_000_000_000,
            requestId: '00000000-0000-0000-0000-000000000000',
            error: `${EXISTING_ISSUE_CAUSE}${HP_ISSUE_MESSAGE}`,
            issues: [
              { fieldUid: 'hp', path: ['hp'], message: HP_ISSUE_MESSAGE },
              { fieldUid: 'old', path: ['old'], message: LEGACY_EXISTING_ISSUE_MESSAGE }
            ]
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual([HP_ISSUE_MESSAGE, LEGACY_EXISTING_ISSUE_MESSAGE])
    })

    it('issues が空で error のみなら実原因（error）を返す', () => {
      const error = {
        response: {
          data: {
            success: false,
            message: 'エラーが発生しました',
            timestamp: 1_000_000_000_000,
            requestId: '00000000-0000-0000-0000-000000000000',
            error: MINIMAL_NON_FINITE_ERROR,
            issues: []
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual([MINIMAL_NON_FINITE_ERROR])
    })

    it('details のみなら error を落として details の message を返す', () => {
      const error = {
        response: {
          data: {
            success: false,
            message: 'エラーが発生しました',
            timestamp: 1,
            error: '入力内容が不正です',
            details: [{ field: 'name', message: '名前は必須です' }]
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual(['名前は必須です'])
    })

    it('issues・details を優先順に結合し、完全一致する重複を除去する', () => {
      const error = {
        response: {
          data: {
            success: false,
            message: 'エラーが発生しました',
            timestamp: 1,
            error: '入力内容が不正です',
            issues: [{ message: '同じ診断です' }],
            details: [{ message: '同じ診断です' }, { message: '詳細診断です' }]
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual(['同じ診断です', '詳細診断です'])
    })

    it('実原因・issues・details が空なら最後の砦としてラベルを返す', () => {
      const error = {
        response: {
          data: {
            success: false,
            message: 'エラーが発生しました',
            timestamp: 1,
            error: '',
            issues: [],
            details: []
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual(['エラーが発生しました'])
    })
  })

  describe('Nest 既定形', () => {
    it('message 配列は各要素を文字列化して返す', () => {
      const error = {
        response: {
          data: {
            statusCode: 400,
            message: ['名前は必須です', 42],
            error: 'Bad Request'
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual(['名前は必須です', '42'])
    })

    it('message 文字列は ASCII セミコロンで分割し、空白と空要素を除く', () => {
      const error = {
        response: {
          data: {
            statusCode: 400,
            message: ' 名前は必須です ; ; タグが不正です ',
            error: 'Bad Request'
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual(['名前は必須です', 'タグが不正です'])
    })

    it('ASCII セミコロンがない message 文字列は単一要素で返す', () => {
      const error = {
        response: {
          data: {
            statusCode: 404,
            message: 'テンプレートが見つかりません',
            error: 'Not Found'
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual(['テンプレートが見つかりません'])
    })

    it('全角セミコロンは分割しない', () => {
      const error = {
        response: {
          data: {
            statusCode: 400,
            message: '名前は必須です；タグが不正です',
            error: 'Bad Request'
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual(['名前は必須です；タグが不正です'])
    })

    it('raw 422 legacy 形（success 無し）は封筒扱いされず message 分岐で単一要素になる', () => {
      // BoundedNonFiniteErrorEnvelope の直接形。success キーが無いため isErrorEnvelope は false。
      // message は全角「；」区切りで ASCII セミコロンを含まないため、単一要素で返る。
      const error = {
        response: {
          data: {
            statusCode: 422,
            error: 'Unprocessable Entity',
            message: HP_ISSUE_MESSAGE,
            issues: [{ fieldUid: 'hp', path: ['hp'], message: HP_ISSUE_MESSAGE }]
          }
        }
      }

      expect(extractApiErrorMessages(error)).toEqual([HP_ISSUE_MESSAGE])
    })
  })

  it('Error インスタンスは message を返す', () => {
    expect(extractApiErrorMessages(new Error('接続に失敗しました'))).toEqual(['接続に失敗しました'])
  })

  it('まったくの unknown はフォールバック文言を返す', () => {
    expect(extractApiErrorMessages(Symbol('unknown'))).toEqual(['リクエストの処理中にエラーが発生しました'])
  })
})
