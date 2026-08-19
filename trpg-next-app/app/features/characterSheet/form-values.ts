import type { EvaluationResult, SheetField } from '@trpg/sheet-engine'

/** computed の評価結果が無いことを field 単位で示す表示値。TFR は computed を読み取り専用で描くだけなので、値として渡す。 */
const COMPUTED_ERROR_TEXT = 'Error'

interface BuildFormValuesInput {
  /** evaluateTemplate の結果。評価が例外で終わったときは null を渡す。 */
  evaluated: EvaluationResult | null
  /** 'Error' 表示の対象にする field。呼び出し側がその画面で描く field だけを渡す。 */
  fields: readonly SheetField[]
  /** 画面が raw のまま所有している値。ここに載っているキーが最終値になる。 */
  values: Readonly<Record<string, unknown>>
}

/**
 * TemplateFormRenderer へ渡す表示値を、engine の評価値と画面が所有する raw 値から組み立てる。
 *
 * 3 段で重ねる。順序の不変条件は「3 が最後」だけで、1 と 2 は入れ替えても結果が変わらない
 * （2 のガードは 1 が同じ uid へ書く条件の否定なので、ある uid へ書くのは 1 か 2 の一方だけになる）:
 * 1. 評価値を全 uid に敷く（computed / roll のように画面が raw 値を持たない field は、ここだけが供給源）
 * 2. 評価値の無い computed を 'Error' にする（evaluateTemplate は式 1 本の失敗で全体が落ちるため、
 *    evaluated が null のとき fields 中の computed はすべてここを通る）
 * 3. 画面が所有する raw 値で上書きする
 *
 * 3 を最後に置くことが要。1 を後に回すと、利用者が入力したばかりの値や保存済みの raw 値が
 * engine の解釈（未入力 number の 0 化・parts の合算）へ置き換わって消える。
 *
 * values に載っていないキーの最終値は評価値になる。「値を持たない」ことを表示へ残したい field は、
 * 呼び出し側が values 側でその uid を明示的に undefined として渡す。
 */
export function buildFormValues({ evaluated, fields, values }: BuildFormValuesInput): Record<string, unknown> {
  const formValues: Record<string, unknown> = {}
  for (const [fieldUid, runtime] of Object.entries(evaluated?.values ?? {})) {
    formValues[fieldUid] = runtime.value
  }
  for (const field of fields) {
    if (field.type === 'computed' && evaluated?.values[field.uid] === undefined) {
      formValues[field.uid] = COMPUTED_ERROR_TEXT
    }
  }
  for (const [fieldUid, value] of Object.entries(values)) {
    formValues[fieldUid] = value
  }
  return formValues
}
