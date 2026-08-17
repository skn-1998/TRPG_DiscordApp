import type { SheetField } from '@trpg/sheet-engine'

/**
 * field が宣言している作成時ロールの記法を返す。宣言がなければ undefined を返す。
 *
 * 現時点で読む宣言は track の rollOnCreate.notation と roll の notation の 2 つ（列挙は現時点のもの）。
 * どちらも「作成時にサーバがロールする」同じ契約なので、判定はこの 1 本に閉じる。
 * 作成（CharacterInstantiationService）と振り直し（CharacterSheetOperationService）が
 * 同じ項目集合を対象にすることは、両者がこの関数だけを述語に使うことで保たれる。
 *
 * scalar も rollOnCreate を宣言でき publish はそれを受理する（sheet-engine の ScalarField.rollOnCreate）が、
 * 本関数は scalar を読まず undefined を返すため、作成時適用も振り直しも発火しない。
 * これは検出漏れではなく意図的な段階分割で、発火は次スライス PV-2 の担当
 * （正本: document/character-sheet-proposals/roll-lane-framing.md の PV レーン）。
 *
 * 「入力可能な項目か」（CharacterSheetOperationService.assertWritablePath が判定する
 * track / scalar の規則）とは別の述語である。roll 型はクライアント提出の入力項目ではないまま、
 * この述語では対象になる。
 */
export function rollOnCreateNotation(field: SheetField): string | undefined {
  if (field.type === 'roll') {
    return field.notation
  }
  if (field.type !== 'track') {
    return undefined
  }
  return field.rollOnCreate?.notation
}
