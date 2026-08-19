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

  it('scalar の rollOnCreate は notation と行き先をそのまま返す', () => {
    const field = {
      ...fieldBase,
      type: 'scalar',
      valueType: 'number',
      parts: true,
      rollOnCreate: { notation: '3d6', partsKey: 'base' },
    } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toEqual({ notation: '3d6', partsKey: 'base' });
  });

  // partsKeys を宣言できるのは scalar だけなので、`base` 以外の行き先が載るのはこの型だけ。
  // 書き込み側が既定へ畳む前の宣言をそのまま渡すことを固定する。
  it('宣言済み partsKeys を行き先にした scalar は base 以外の行き先を載せて返す', () => {
    const field = {
      ...fieldBase,
      type: 'scalar',
      valueType: 'number',
      partsKeys: [{ id: 'growth', label: 'Growth' }],
      rollOnCreate: { notation: '1d10', partsKey: 'growth' },
    } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toEqual({ notation: '1d10', partsKey: 'growth' });
  });

  it('rollOnCreate を宣言していない scalar は undefined', () => {
    const field = {
      ...fieldBase,
      type: 'scalar',
      valueType: 'number',
      parts: true,
    } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toBeUndefined();
  });

  // 型は rollOnCreate を valueType で絞っていない（types.ts の ScalarField.rollOnCreate）。
  // valueType === 'number' に絞るのは publish の検査だけ（publish.ts の validateScalarRollOnCreate）で、
  // 本述語はそれを重ねない。publish の受理範囲とここの発火範囲を別々のゲートにしないための選択なので、
  // publish を経ずに保存された text scalar の宣言もここでは宣言として返る。
  it('valueType が number でない scalar の rollOnCreate も宣言として返す（valueType を絞るのは publish だけ）', () => {
    const field = {
      ...fieldBase,
      type: 'scalar',
      valueType: 'text',
      rollOnCreate: { notation: '3d6', partsKey: 'base' },
    } satisfies SheetField;

    expect(rollOnCreateSpec(field)).toEqual({ notation: '3d6', partsKey: 'base' });
  });

  // publish を経ずに保存された宣言は型が保証しない。notation を取り出せない外形は宣言なしとして扱う。
  // track / scalar のどちらも同じ扱いで、この点が両型で分岐していないことも併せて固定する。
  it.each([
    ['boolean', true],
    ['string', '1d6'],
    ['notation 欠落のオブジェクト', { partsKey: 'base' }],
  ])('契約外形（%s）の rollOnCreate は track でも scalar でも宣言なしとして扱う', (_case, declared) => {
    const track = {
      ...fieldBase,
      type: 'track',
      max: 10,
      style: 'gauge',
      rollOnCreate: declared,
    } as unknown as SheetField;
    const scalar = {
      ...fieldBase,
      type: 'scalar',
      valueType: 'number',
      parts: true,
      rollOnCreate: declared,
    } as unknown as SheetField;

    expect(rollOnCreateSpec(track)).toBeUndefined();
    expect(rollOnCreateSpec(scalar)).toBeUndefined();
  });

  // ここに並ぶのは rollOnCreate プロパティ自体を型が持たない 4 型。
  it.each([
    ['computed', { ...fieldBase, type: 'computed', resultType: 'number', formula: '1' }],
    ['list', { ...fieldBase, type: 'list', itemFields: [] }],
    ['relation', { ...fieldBase, type: 'relation' }],
    ['tag', { ...fieldBase, type: 'tag' }],
  ] satisfies Array<[string, SheetField]>)('rollOnCreate を型として持たない型（%s）は undefined', (_case, field) => {
    expect(rollOnCreateSpec(field)).toBeUndefined();
  });
});
