/**
 * 作成時ロールの宣言解決（rollOnCreateSpec）を検証する。
 *
 * この述語は作成時の適用・振り直し・可否表示が共有する 1 本なので、
 * 経路側の spec とは別に、述語だけが守る境界をここに置く。
 */
import { rollOnCreateSpec } from '../roll-on-create';
import { SheetField } from '../types';

const fieldBase = { id: 'field', uid: 'field-uid', label: 'Field' };

describe('rollOnCreateSpec', () => {
  it('roll 型は notation を宣言として返す（partsKey は載らない）', () => {
    const field = { ...fieldBase, type: 'roll', notation: '3d6*5' } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toEqual({ notation: '3d6*5' });
  });

  it('track の rollOnCreate は notation と行き先をそのまま返す', () => {
    const field = {
      ...fieldBase,
      type: 'track',
      max: 10,
      style: 'gauge',
      rollOnCreate: { notation: '1d6', partsKey: 'base' },
    } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toEqual({ notation: '1d6', partsKey: 'base' });
  });

  // 固定するのは「行き先を持たない」ことであってキーの不在ではない。実装は partsKey キー自体は
  // 載せて返す（値が undefined）ので toEqual で足りる。キーの存在を読む消費者は無く、
  // toStrictEqual でキーの不在まで要求すると実装の自然な書き方を縛るだけになる。
  it('行き先未指定の track は行き先を持たない宣言として返す（base に畳むのは書き込み側の裁量）', () => {
    const field = {
      ...fieldBase,
      type: 'track',
      max: 10,
      style: 'gauge',
      rollOnCreate: { notation: '1d6' },
    } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toEqual({ notation: '1d6' });
  });

  // publish が受理するのは valueType === 'number' の scalar だが、本述語は scalar を読まない。
  // 検出漏れではなく段階分割（発火は PV-S）なので、undefined であることを固定して差分を可視化する。
  it('scalar の rollOnCreate は宣言されていても発火させない（段階分割 PV-S）', () => {
    const field = {
      ...fieldBase,
      type: 'scalar',
      valueType: 'number',
      parts: true,
      rollOnCreate: { notation: '3d6', partsKey: 'base' },
    } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toBeUndefined();
  });

  // 型は rollOnCreate を valueType で絞っていない（types.ts の ScalarField.rollOnCreate）。
  // valueType === 'number' に絞るのは publish の検査だけ（publish.ts の validateScalarRollOnCreate）なので、
  // publish を経ずに保存されればこの外形は成立する。現時点の述語は scalar 自体を読まないため valueType を問わず undefined。
  // PV-S で scalar を読むようになったとき、この宣言を発火させるか（型ではなく publish だけが絞っている宣言を
  // 述語側でどう扱うか）が設計判断になる。
  it('valueType が number でない scalar の rollOnCreate も発火させない（型は valueType を絞らない）', () => {
    const field = {
      ...fieldBase,
      type: 'scalar',
      valueType: 'text',
      rollOnCreate: { notation: '3d6', partsKey: 'base' },
    } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toBeUndefined();
  });

  // publish を経ずに保存された宣言は型が保証しない。notation を取り出せない外形は宣言なしとして扱う。
  it.each([
    ['boolean', true],
    ['string', '1d6'],
    ['notation 欠落のオブジェクト', { partsKey: 'base' }],
  ])('契約外形（%s）の track rollOnCreate は宣言なしとして扱う', (_case, declared) => {
    const field = {
      ...fieldBase,
      type: 'track',
      max: 10,
      style: 'gauge',
      rollOnCreate: declared,
    } as unknown as SheetField;

    expect(rollOnCreateSpec(field)).toBeUndefined();
  });

  // ここに並ぶのは rollOnCreate プロパティ自体を型が持たない 4 型。scalar は型として持てるので含めない
  // （scalar の非発火は上の 2 ケースが固定している）。
  it.each([
    ['computed', { ...fieldBase, type: 'computed', resultType: 'number', formula: '1' }],
    ['list', { ...fieldBase, type: 'list', itemFields: [] }],
    ['relation', { ...fieldBase, type: 'relation' }],
    ['tag', { ...fieldBase, type: 'tag' }],
  ] satisfies Array<[string, SheetField]>)('rollOnCreate を型として持たない型（%s）は undefined', (_case, field) => {
    expect(rollOnCreateSpec(field)).toBeUndefined();
  });
});
