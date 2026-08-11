import isNumberScalar from '../annotation-runtime';
import isRawNumberInputField from '../constraint-evaluator';
import { SheetField } from '../types';

const fieldBase = { id: 'field', uid: 'field-uid', label: 'Field' };
const fieldFixtures = [
  { name: 'scalar number', field: { ...fieldBase, type: 'scalar', valueType: 'number' } },
  { name: 'scalar text', field: { ...fieldBase, type: 'scalar', valueType: 'text' } },
  { name: 'scalar boolean', field: { ...fieldBase, type: 'scalar', valueType: 'boolean' } },
  { name: 'track', field: { ...fieldBase, type: 'track', max: 10, style: 'gauge' } },
  { name: 'roll', field: { ...fieldBase, type: 'roll', notation: '1d6' } },
  { name: 'computed', field: { ...fieldBase, type: 'computed', resultType: 'number', formula: '1' } },
  { name: 'list', field: { ...fieldBase, type: 'list', itemFields: [] } },
  { name: 'relation', field: { ...fieldBase, type: 'relation' } },
  { name: 'tag', field: { ...fieldBase, type: 'tag' } },
] satisfies Array<{ name: string; field: SheetField }>;

describe('H-6/H-7 field predicate superset', () => {
  it('matches number scalars exactly', () => {
    expect(fieldFixtures.filter(({ field }) => isNumberScalar(field)).map(({ name }) => name))
      .toEqual(['scalar number']);
  });

  it('matches raw number inputs exactly', () => {
    expect(fieldFixtures.filter(({ field }) => isRawNumberInputField(field)).map(({ name }) => name))
      .toEqual(['scalar number', 'track']);
  });

  it.each(fieldFixtures)('keeps isNumberScalar($name) inside isRawNumberInputField', ({ field }) => {
    expect(!isNumberScalar(field) || isRawNumberInputField(field)).toBe(true);
  });
});
