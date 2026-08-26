import {
  buildValueInputSchema,
  LIST_ROW_LIMIT,
  LIST_ROW_TEXT_MAX_LENGTH,
  SheetField,
} from '..';
import { baseTemplate } from './test-utils';

const LIST_UID = 'custom.entries';
const NUMBER_UID = 'custom.value';
const DECLARED_NUMBER_UID = 'custom.allocated';
const TEXT_UID = 'custom.name';
const BOOLEAN_UID = 'custom.active';
const SELECT_UID = 'custom.rank';
const TRACK_UID = 'custom.gauge';
const COMPUTED_UID = 'custom.total';
const ROLL_UID = 'custom.roll';
const NESTED_LIST_UID = 'custom.children';

const itemFields: SheetField[] = [
  { type: 'scalar', id: 'value', uid: NUMBER_UID, label: 'Value', valueType: 'number' },
  {
    type: 'scalar', id: 'allocated', uid: DECLARED_NUMBER_UID, label: 'Allocated', valueType: 'number',
    partsKeys: [{ id: 'occupation', label: 'Occupation' }, { id: 'interest', label: 'Interest' }],
  },
  { type: 'scalar', id: 'name', uid: TEXT_UID, label: 'Name', valueType: 'text' },
  { type: 'scalar', id: 'active', uid: BOOLEAN_UID, label: 'Active', valueType: 'boolean' },
  {
    type: 'scalar', id: 'rank', uid: SELECT_UID, label: 'Rank', valueType: 'select',
    options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }],
  },
  { type: 'track', id: 'gauge', uid: TRACK_UID, label: 'Gauge', max: 99, style: 'gauge' },
  { type: 'computed', id: 'total', uid: COMPUTED_UID, label: 'Total', resultType: 'number', formula: '1' },
  { type: 'roll', id: 'roll', uid: ROLL_UID, label: 'Roll', notation: '1d6' },
  { type: 'list', id: 'children', uid: NESTED_LIST_UID, label: 'Children', itemFields: [] },
];

const schema = buildValueInputSchema(baseTemplate({
  sections: [{
    id: 'custom',
    label: 'Custom',
    fields: [
      { type: 'scalar', id: 'direct', uid: 'direct.value', label: 'Direct', valueType: 'number', parts: true },
      { type: 'track', id: 'direct_track', uid: 'direct.track', label: 'Direct track', max: 10, style: 'gauge' },
      { type: 'scalar', id: 'other', uid: 'other.field', label: 'Other', valueType: 'number' },
      { type: 'list', id: 'entries', uid: LIST_UID, label: 'Entries', itemFields },
    ],
  }],
}));

function issuesFor(value: unknown) {
  const result = schema.safeParse({ [LIST_UID]: value });
  expect(result.success).toBe(false);
  return result.success ? [] : result.error.issues;
}

describe('list value input boundary', () => {
  it('accepts one to three rows with mixed number, text, boolean, select, and track values', () => {
    // Test intent: list 行の公開入力型を itemField uid の raw 値だけで正常保存できることを固定する。
    const rows = [
      { rowId: 'row-1', [NUMBER_UID]: 10, [TEXT_UID]: 'First', [TRACK_UID]: 8 },
      { rowId: 'row_2', [NUMBER_UID]: -2, [TEXT_UID]: 'Second', [BOOLEAN_UID]: true, [SELECT_UID]: 'a' },
      { rowId: 'row3', [TRACK_UID]: 0 },
    ];

    for (let rowCount = 1; rowCount <= rows.length; rowCount += 1) {
      expect(schema.safeParse({ [LIST_UID]: rows.slice(0, rowCount) }).success).toBe(true);
    }
  });

  it('accepts an empty array as deletion of all rows', () => {
    // Test intent: 全行削除を表す空配列が保存境界を通ることを固定する。
    expect(schema.safeParse({ [LIST_UID]: [] }).success).toBe(true);
  });

  it('accepts exactly LIST_ROW_LIMIT rows', () => {
    // Test intent: evaluator と共有する 512 行の境界値を保存側でも受理する。
    const rows = Array.from({ length: LIST_ROW_LIMIT }, (_, index) => ({ rowId: `row-${index}` }));
    expect(schema.safeParse({ [LIST_UID]: rows }).success).toBe(true);
  });

  it('rejects LIST_ROW_LIMIT plus one and points to the row count', () => {
    // Test intent: evaluator が黙って切り捨てる 513 行目を保存前に診断可能な位置で拒否する。
    const rows = Array.from({ length: LIST_ROW_LIMIT + 1 }, (_, index) => ({ rowId: `row-${index}` }));
    expect(issuesFor(rows)).toContainEqual(expect.objectContaining({ path: [LIST_UID, 'length'] }));
  });

  it.each([42, null, 'x', []])('rejects a non-object row value: %p', (row) => {
    // Test intent: evaluator が空行へ退化させる非 object 行を保存済み値へ入れない。
    expect(issuesFor([{ rowId: 'valid' }, row])).toContainEqual(expect.objectContaining({
      path: [LIST_UID, 1, '$row'],
    }));
  });

  it.each([
    ['unknown key', 'unknown', 1],
    ['another field uid', 'other.field', 1],
    ['itemField id alias', 'value', 1],
    ['unsafe key', '__proto__', 1],
  ])('rejects %s with a key-level issue', (_case, key, keyValue) => {
    // Test intent: 保存形を rowId と当該 list の itemField uid だけに正規化し、別名 fallback と未知データを閉じる。
    const row = JSON.parse(`{"rowId":"row-1","${key}":${JSON.stringify(keyValue)}}`) as Record<string, unknown>;
    expect(issuesFor([row])).toContainEqual(expect.objectContaining({ path: [LIST_UID, 0, key] }));
  });

  it.each([
    ['missing', {}, 'rowId'],
    ['empty', { rowId: '' }, 'rowId'],
    ['invalid characters', { rowId: 'row 1' }, 'rowId'],
    ['too long', { rowId: 'a'.repeat(33) }, 'rowId'],
    ['unsafe', { rowId: '__proto__' }, 'rowId'],
  ])('rejects a %s rowId', (_case, row, key) => {
    // Test intent: rowId の必須・形式・予約語契約を行とキーの位置で診断する。
    expect(issuesFor([row])).toContainEqual(expect.objectContaining({ path: [LIST_UID, 0, key] }));
  });

  it('rejects the second and later occurrence of a duplicate rowId', () => {
    // Test intent: index ではなく安定 rowId で行を同定できるよう、list 内の 2 件目を拒否する。
    expect(issuesFor([{ rowId: 'same' }, { rowId: 'same' }])).toContainEqual(expect.objectContaining({
      path: [LIST_UID, 1, 'rowId'],
      message: expect.stringContaining('must be unique'),
    }));
  });

  it.each(['abc', null, true, Number.POSITIVE_INFINITY, JSON.parse('1e400')])(
    'rejects a non-finite raw number without coercing it to zero: %p',
    (value) => {
      // Test intent: evaluator の numberOrZero を入力検証に流用せず、有限 raw number だけを保存する。
      expect(issuesFor([{ rowId: 'row-1', [NUMBER_UID]: value }])).toContainEqual(expect.objectContaining({
        path: [LIST_UID, 0, NUMBER_UID],
      }));
    },
  );

  it.each([NUMBER_UID, TRACK_UID])('rejects parts input while row field %s has no declared partsKeys', (uid) => {
    // Test intent: 行 parts を開いた後も、宣言のない number と track へ受理面を広げない。
    expect(issuesFor([{ rowId: 'row-1', [uid]: { parts: { base: 1 } } }])).toContainEqual(
      expect.objectContaining({ path: [LIST_UID, 0, uid] }),
    );
  });

  it('accepts declared non-negative parts on a number itemField', () => {
    // Test intent: 職業・興味ポイントの宣言済みキーを同じ行の parts 形として保存できることを固定する。
    expect(schema.safeParse({
      [LIST_UID]: [{
        rowId: 'row-1',
        [DECLARED_NUMBER_UID]: { parts: { occupation: 5, interest: 3 } },
      }],
    }).success).toBe(true);
  });

  it.each([
    ['undeclared', 'bogus', 'is not declared'],
    ['reserved base', 'base', 'is reserved'],
    ['reserved other', 'other', 'is reserved'],
    ['unsafe prototype', '__proto__', 'is reserved'],
  ])('rejects a %s list item part key', (_case, key, message) => {
    // Test intent: 行 parts を itemField の宣言語彙だけに限定し、予約・prototype 汚染キーも同じ境界で閉じる。
    const parts = JSON.parse(`{"${key}":1}`) as Record<string, number>;
    expect(issuesFor([{
      rowId: 'row-1', [DECLARED_NUMBER_UID]: { parts },
    }])).toContainEqual(expect.objectContaining({
      path: [LIST_UID, 0, DECLARED_NUMBER_UID, 'parts', key],
      message: expect.stringContaining(message),
    }));
  });

  it('rejects a negative declared list item part', () => {
    // Test intent: 負寄与で共有 pool の remaining が膨張する保存済み状態を行境界で作らせない。
    expect(issuesFor([{
      rowId: 'row-1', [DECLARED_NUMBER_UID]: { parts: { occupation: -1 } },
    }])).toContainEqual(expect.objectContaining({
      path: [LIST_UID, 0, DECLARED_NUMBER_UID, 'parts', 'occupation'],
    }));
  });

  it('rejects an overflowing declared list item parts sum with a row-and-field issue', () => {
    // Test intent: C-9「保存境界を通った値は評価を落とさない」を行 parts にも適用し、evaluator が throw する値を 422 境界で拒否する。
    expect(issuesFor([{
      rowId: 'row-1',
      [DECLARED_NUMBER_UID]: { parts: { occupation: Number.MAX_VALUE, interest: Number.MAX_VALUE } },
    }])).toContainEqual(expect.objectContaining({
      path: [LIST_UID, 0, DECLARED_NUMBER_UID, 'parts'],
      message: expect.stringContaining('parts sum must be finite'),
    }));
  });

  it('accepts raw and declared parts forms for the same number itemField', () => {
    // Test intent: section 直下と同じ raw/parts 二択を行 number にも保ち、一方を開くため他方を閉じない。
    expect(schema.safeParse({
      [LIST_UID]: [
        { rowId: 'raw', [DECLARED_NUMBER_UID]: 8 },
        { rowId: 'parts', [DECLARED_NUMBER_UID]: { parts: { occupation: 5, interest: 3 } } },
      ],
    }).success).toBe(true);
  });

  it('pins the list row text limit to 64 characters', () => {
    // Test intent: 定数自体の変更を境界値テストの自己参照で見逃さないよう、契約値を literal で固定する。
    expect(LIST_ROW_TEXT_MAX_LENGTH).toBe(64);
  });

  it('accepts 64 text characters and rejects 65', () => {
    // Test intent: Discord button label へ安全に投影できる保存時の文字数境界を固定する。
    expect(schema.safeParse({
      [LIST_UID]: [{ rowId: 'row-1', [TEXT_UID]: 'a'.repeat(LIST_ROW_TEXT_MAX_LENGTH) }],
    }).success).toBe(true);
    expect(issuesFor([
      { rowId: 'row-1', [TEXT_UID]: 'a'.repeat(LIST_ROW_TEXT_MAX_LENGTH + 1) },
    ])).toContainEqual(expect.objectContaining({ path: [LIST_UID, 0, TEXT_UID] }));
  });

  it('rejects a select value outside the declared options', () => {
    // Test intent: 行 select も section 直下と同じく宣言 option 値だけを保存する。
    expect(issuesFor([{ rowId: 'row-1', [SELECT_UID]: 'c' }])).toContainEqual(expect.objectContaining({
      path: [LIST_UID, 0, SELECT_UID],
    }));
  });

  it('rejects a non-boolean value for a boolean itemField', () => {
    // Test intent: 行 boolean を truthy/falsy へ変換せず raw boolean に限定する。
    expect(issuesFor([{ rowId: 'row-1', [BOOLEAN_UID]: 'true' }])).toContainEqual(expect.objectContaining({
      path: [LIST_UID, 0, BOOLEAN_UID],
    }));
  });

  it.each([
    ['computed', COMPUTED_UID, 1],
    ['roll', ROLL_UID, '1d6'],
    ['nested list', NESTED_LIST_UID, []],
  ])('rejects a provided %s itemField value', (_case, uid, value) => {
    // Test intent: 値側でも非入力 field を閉じ、publish の roll/list 拒否だけを防御にしない。
    expect(issuesFor([{ rowId: 'row-1', [uid]: value }])).toContainEqual(expect.objectContaining({
      path: [LIST_UID, 0, uid],
    }));
  });

  it.each([42, 'rows', null, { parts: {} }, { 0: { rowId: 'row-1' }, length: 1 }])(
    'keeps rejecting a non-array list value: %p',
    (value) => {
      // Test intent: list 対応前後で共通の非配列拒否を明示し、疑似配列 object も配列扱いしない。
      expect(issuesFor(value)).toContainEqual(expect.objectContaining({ path: [LIST_UID] }));
    },
  );

  it('keeps section-level scalar and track input rules unchanged', () => {
    // Test intent: list 専用 schema の追加が section 直下の raw number / parts 契約へ波及しないことを pin する。
    expect(schema.safeParse({
      'direct.value': { parts: { base: 2 } },
      'direct.track': { parts: { base: 8, damage: -1 } },
    }).success).toBe(true);
    expect(schema.safeParse({ 'direct.value': '2', 'direct.track': true }).success).toBe(false);
  });
});
