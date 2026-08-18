import { SheetField } from './types';

/**
 * 作成時ロールの宣言を、書き込み側が必要とする形へ解決したもの。
 *
 * 著者が書いた宣言そのものは types.ts の RollOnCreate（partsKey の意味と、publish が受理する
 * 行き先 id の範囲はそちらが正本）。構造は同じだが、roll 型のように RollOnCreate の宣言を持たない
 * field でも notation から合成して返すため、「宣言」と「解決済み」を別の型で表している。
 * partsKey の undefined は「行き先の指定が無い」であって「行き先が base である」ではない。
 * 既定の行き先を決めるのは書き込み側であり、publish はそこを決めていない
 * （publish.ts の validateRollOnCreatePartsKey が未指定を合法にしている）。
 */
export interface RollOnCreateSpec {
  notation: string;
  partsKey?: string;
}

/**
 * field が宣言している作成時ロールを返す。宣言がなければ undefined を返す。
 *
 * 現時点で読む宣言は track の rollOnCreate と roll の notation の 2 つ（列挙は現時点のもの）。
 * どちらも「作成時にサーバがロールする」同じ契約なので、判定はこの 1 本に閉じる。
 * 現時点の runtime 呼び出しは 2 経路（作成時の適用と、後からの振り直し）。
 * 「振り直せるかの表示」は未実装で、front で実装するときに 3 経路目として加わる予定（RL-7c）。
 * これらの経路が同じ項目集合を対象にすることは、作成時ロールの対象集合を決める述語が
 * この関数 1 本しかないことで保たれる。1 本なのは対象集合の判定についてであり、
 * 同じ rollOnCreate 宣言を別目的で読む述語は他にもある（提出値の拒否は契約外形も true にする
 * 外延の異なる判定で、本関数が undefined を返す field でも成立する）。
 * engine には使い方を強制する手段がないので、これは呼び出し側が守る契約であり、
 * engine が保証できるのは「対象集合を決める述語が 1 本しかない」ことまでである。
 *
 * 戻り値に記法だけでなく partsKey も載せるのは、呼び出し側が行き先を知るために
 * field.rollOnCreate を読み直すと、1 本化したはずの述語がその場で再び分裂するため。
 * publish は track / scalar のどちらでも行き先 `base` を受理する（publish.ts の
 * validateRollOnCreatePartsKey。__tests__/publish.spec.ts の
 * 'accepts a %s creation roll targeting base' が両型を pin している）。
 * したがって本関数は partsKey に `'base'` を載せて返しうる。`undefined` との差が観測されるかは
 * 書き込み側の既定次第で、未指定を `base` へ畳む書き込み側では差が出ない（既定は本関数が決めない）。
 * `'base'` 以外の行き先が載るのは partsKeys を宣言した scalar を読むようになってからで、
 * それは下記 PV-S の圏（track は partsKeys を宣言できない — validateNumericAnnotationTarget が拒否する）。
 * ただし宣言を検査するのは publish であり、publish を経ずに保存された宣言まで型が保証しているわけではない。
 *
 * scalar も rollOnCreate を宣言でき publish はそれを受理する（types.ts の ScalarField.rollOnCreate）が、
 * 本関数は scalar を読まず undefined を返すため、作成時適用も振り直しも発火しない。
 * これは検出漏れではなく意図的な段階分割で、発火は別スライス PV-S の担当
 * （正本: document/character-sheet-proposals/roll-lane-framing.md の PV レーン）。
 *
 * 「入力可能な項目か」（value-input.ts の inputSchemaFor が track / scalar にだけ schema を返す規則）
 * とは別の述語である。roll 型はクライアント提出の入力項目ではないまま、この述語では対象になる。
 */
export function rollOnCreateSpec(field: SheetField): RollOnCreateSpec | undefined {
  if (field.type === 'roll') {
    return { notation: field.notation };
  }
  if (field.type !== 'track') {
    return undefined;
  }

  const declared = field.rollOnCreate;
  // 契約外形（boolean・string 等）が保存済みテンプレートに残存している場合、notation は取り出せない。
  // 宣言なしとして扱い発火させないのは、記法だけを返していた旧実装から変えていない挙動。
  if (declared?.notation === undefined) {
    return undefined;
  }
  return { notation: declared.notation, partsKey: declared.partsKey };
}
