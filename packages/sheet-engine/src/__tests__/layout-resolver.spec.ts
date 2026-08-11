import { resolveGridSpan, resolveSectionLayout, type SheetField } from '..';

const simpleField: SheetField = {
  id: 'name',
  uid: 'uid_name',
  label: 'Name',
  type: 'scalar',
  valueType: 'text',
};

const resolutionCases = [
  {
    name: '未指定 layout を stack として解決する',
    assert: () => {
      expect(resolveSectionLayout(undefined)).toEqual({ mode: 'stack', columns: null });
    },
  },
  {
    name: 'preset のない legacy record を stack として解決する',
    assert: () => {
      expect(resolveSectionLayout({ direction: 'row' })).toEqual({ mode: 'stack', columns: null });
    },
  },
  {
    name: '明示 stack を stack として解決する',
    assert: () => {
      expect(resolveSectionLayout({ preset: 'stack' })).toEqual({ mode: 'stack', columns: null });
    },
  },
  {
    name: 'stack では columns を無視する',
    assert: () => {
      expect(resolveSectionLayout({ preset: 'stack', columns: 2 })).toEqual({ mode: 'stack', columns: null });
    },
  },
  {
    name: '不正 preset は stack、不正 columns の grid は既定 2 列として解決する',
    assert: () => {
      expect(resolveSectionLayout({ preset: 'cards' })).toEqual({ mode: 'stack', columns: null });
      expect(resolveSectionLayout({ preset: 'grid', columns: 5 })).toEqual({ mode: 'grid', columns: 2 });
    },
  },
  {
    name: 'columns と span を省略した正当 grid に既定値を使う',
    assert: () => {
      expect(resolveSectionLayout({ preset: 'grid' })).toEqual({ mode: 'grid', columns: 2 });
      expect(resolveGridSpan(simpleField, 2)).toBe(1);
    },
  },
  {
    name: 'simple field の不正 span に既定値を使う',
    assert: () => {
      const field = { ...simpleField, layout: { span: 'wide' } } as unknown as SheetField;

      expect(resolveGridSpan(field, 2)).toBe(1);
    },
  },
  {
    name: 'simple field の明示 full span を保持する',
    assert: () => {
      expect(resolveGridSpan({ ...simpleField, layout: { span: 'full' } }, 4)).toBe('full');
    },
  },
  {
    name: 'table は columns の正誤に影響されない',
    assert: () => {
      expect(resolveSectionLayout({ preset: 'table' })).toEqual({ mode: 'table', columns: null });
      expect(resolveSectionLayout({ preset: 'table', columns: 2 })).toEqual({ mode: 'table', columns: null });
      expect(resolveSectionLayout({ preset: 'table', columns: 99 })).toEqual({ mode: 'table', columns: null });
    },
  },
  {
    name: 'prototype 継承された preset を採用しない',
    assert: () => {
      const layout = Object.assign(Object.create({ preset: 'grid' }) as object, { columns: 4 });

      expect(resolveSectionLayout(layout)).toEqual({ mode: 'stack', columns: null });
    },
  },
] as const;

describe('layout resolver', () => {
  it.each(resolutionCases)('$name', ({ assert }) => {
    assert();
  });

  it.each([
    [2, 2],
    [3, 2],
  ] as const)('span %s が columns %s 以上なら full へ clamp する', (span, columns) => {
    expect(resolveGridSpan({ ...simpleField, layout: { span } }, columns)).toBe('full');
  });

  it.each([
    { id: 'hp', uid: 'uid_hp', label: 'HP', type: 'track', max: 10, style: 'gauge', layout: { span: 1 } },
    { id: 'items', uid: 'uid_items', label: 'Items', type: 'list', itemFields: [], layout: { span: 1 } },
    { id: 'bond', uid: 'uid_bond', label: 'Bond', type: 'relation', layout: { span: 1 } },
    { id: 'tags', uid: 'uid_tags', label: 'Tags', type: 'tag', layout: { span: 1 } },
  ] satisfies SheetField[])('$type field は常に full として解決する', (field) => {
    expect(resolveGridSpan(field, 4)).toBe('full');
  });
});
