import { UnprocessableEntityException } from '@nestjs/common'
import type { SheetField } from '@trpg/sheet-engine'
import { allowsParts, isPartsValue, type SheetPartsValue } from './sheet-values.util'

/**
 * 作成時ロールの宣言を、書き込み側が必要とする形へ解決したもの。
 *
 * partsKey は出目の行き先となる内訳キー。undefined は「行き先の指定が無い」であって
 * 「行き先が base である」ではない。既定の行き先を決めるのは書き込み側であり、
 * publish はそこを決めていない（publish.ts の validateRollOnCreatePartsKey が未指定を合法にしている）。
 */
export interface RollOnCreateSpec {
  notation: string
  partsKey?: string
}

/**
 * field が宣言している作成時ロールを返す。宣言がなければ undefined を返す。
 *
 * 現時点で読む宣言は track の rollOnCreate と roll の notation の 2 つ（列挙は現時点のもの）。
 * どちらも「作成時にサーバがロールする」同じ契約なので、判定はこの 1 本に閉じる。
 * 作成（CharacterInstantiationService）と振り直し（CharacterSheetOperationService）が
 * 同じ項目集合を対象にすることは、両者がこの関数だけを述語に使うことで保たれる。
 *
 * 戻り値に記法だけでなく partsKey も載せるのは、呼び出し側が行き先を知るために
 * field.rollOnCreate を読み直すと、1 本化したはずの述語がその場で再び分裂するため。
 * publish は track / scalar のどちらでも行き先 `base` を受理する（publish.ts の
 * validateRollOnCreatePartsKey。publish.spec.ts の 'accepts a %s creation roll targeting base' が
 * 両型を pin している）。したがって本関数は partsKey に `'base'` を載せて返しうる。
 * `undefined` との差は書き込み側では出ない（creationRollValue の既定が partsKey ?? 'base'）。
 * `'base'` 以外の行き先が載るのは partsKeys を宣言した scalar を読むようになってからで、
 * それは下記 PV-S の圏（track は partsKeys を宣言できない — validateNumericAnnotationTarget が拒否する）。
 * ただし宣言を検査するのは publish であり、publish を経ずに DB へ入った宣言まで型が保証しているわけではない。
 *
 * scalar も rollOnCreate を宣言でき publish はそれを受理する（sheet-engine の ScalarField.rollOnCreate）が、
 * 本関数は scalar を読まず undefined を返すため、作成時適用も振り直しも発火しない。
 * これは検出漏れではなく意図的な段階分割で、発火は別スライス PV-S の担当
 * （正本: document/character-sheet-proposals/roll-lane-framing.md の PV レーン）。
 *
 * 「入力可能な項目か」（CharacterSheetOperationService.assertWritablePath が判定する
 * track / scalar の規則）とは別の述語である。roll 型はクライアント提出の入力項目ではないまま、
 * この述語では対象になる。
 */
export function rollOnCreateSpec(field: SheetField): RollOnCreateSpec | undefined {
  if (field.type === 'roll') {
    return { notation: field.notation }
  }
  if (field.type !== 'track') {
    return undefined
  }

  const declared = field.rollOnCreate
  // 契約外形（boolean・string 等）が DB に残存している場合、notation は取り出せない。
  // 宣言なしとして扱い発火させないのは、記法だけを返していた旧実装から変えていない挙動。
  if (declared?.notation === undefined) {
    return undefined
  }
  return { notation: declared.notation, partsKey: declared.partsKey }
}

/**
 * 作成時ロールの出目を、その field の保存形へ変換して返す。
 *
 * 作成（CharacterInstantiationService.applyRollOnCreate）と
 * 振り直し（CharacterSheetOperationService.rerollCreationRoll）が共有する書き込み規則。
 * 経路ごとに規則が食い違うと、同じ項目が作成直後と振り直し後で違う保存形になり、
 * 読み手（front の内訳表示・track-range.policy の実効値解決）が両形を場当たりに扱うことになる。
 *
 * allowsParts が false の field へは生の数値を返す（現時点でここへ来るのは roll 型。PV-S で scalar が
 * 発火すると内訳を宣言していない number scalar も加わる — 下の早期 return のコメント）。
 * この出力を受け止めるのは保存経路の防壁で、SheetMaterializerService.validateStoredValues が
 * roll 型を先に処理し（有限数か文字列だけを受理する）buildValueInputSchema へ渡さない。
 * value-input.ts の `isPartsValue && !allowsParts` 拒否はクライアント提出経路
 * （SheetMaterializerService.validateInputValues）に立つ別の 1 段で、同じ規則を提出側で独立に守っている。
 *
 * 内訳形を返す場合、行き先キー以外の既存の内訳は保持する。Discord の ±（addToOtherPart）が
 * 積んだ parts.other を振り直しが消さないための中心的な規則。
 * 既存値が内訳形でないときは行き先キーだけを持つ形にする（出目が field 全体を置き換えるという
 * 従来の意味をそのまま内訳へ移す）。
 */
export function creationRollValue(
  field: SheetField,
  currentValue: unknown,
  total: number,
  partsKey?: string
): number | SheetPartsValue {
  // allowsParts は型ではなくインスタンスの宣言を見る述語（value-input.ts。scalar には parts: true か
  // partsKeys の宣言を要求する）。一方 publish は number scalar の rollOnCreate にその宣言までは要求しない
  // （validateScalarRollOnCreate。publish.spec.ts の 'accepts a scalar creation roll without a destination'）。
  // よって PV-S で scalar が発火した後は、内訳を宣言していない number scalar もここへ落ち、
  // 宣言された行き先も下の other 拒否も通らないまま生の数値になる。
  // この差集合をどう扱うかは PV-S の設計判断で、本スライスでは挙動を変えない。
  if (!allowsParts(field)) return total

  const destination = partsKey ?? 'base'
  // publish は rollOnCreate.partsKey に other を許さない（validateRollOnCreatePartsKey）ため、
  // 通常経路では到達しない。publish を経ずに DB へ入ったテンプレート向けの防壁であり、
  // 出目と ± の手動増減が同じ内訳に混ざる取り違えを書き込み側でも塞ぐ。
  if (destination === 'other') {
    throw new UnprocessableEntityException(`field ${field.uid} rollOnCreate partsKey must not be other`)
  }

  // 既存値が生の数値のときは旧値を残さない。同じ feature の seedParts（CharacterSheetOperationService。
  // writePathValue と addToOtherPart が使う）は同じ変換で生の数値を base に残すので、規則は一致していない。
  // 行き先が常に base の現時点では観測差が出ない（残しても直後に上書きされる）。base 以外の行き先が
  // 来る時点で、両者を揃えるかどうかを再判定すること。
  const parts = isPartsValue(currentValue) ? { ...currentValue.parts } : {}
  parts[destination] = total
  return { parts }
}
