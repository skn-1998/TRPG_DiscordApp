import { UnprocessableEntityException } from '@nestjs/common'
import type { SheetField } from '@trpg/sheet-engine'
import { allowsParts, isPartsValue, type SheetPartsValue } from './sheet-values.util'

/**
 * 作成時ロールの出目を、その field の保存形へ変換して返す。
 *
 * 対になる述語 `rollOnCreateSpec`（どの field が作成時ロールを宣言しているか）は
 * `@trpg/sheet-engine` の roll-on-create.ts が正本で、server の外（front の振り直し可否表示）からも
 * 同じ述語を使えるようにするため engine に置いてある。書き込み規則である本関数は
 * Nest の例外を投げるため server に残す。
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

  // engine の rollOnCreateSpec は「行き先の指定が無い」を undefined のまま返し、既定を決めていない。
  // 既定の行き先を base に畳むのはこの書き込み側であり、engine 側の述語には載っていない規則。
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
