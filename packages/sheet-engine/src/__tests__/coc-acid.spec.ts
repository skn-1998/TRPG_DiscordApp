import { evaluateTemplate, interpolateNotation } from '..';
import { baseTemplate } from './test-utils';

describe('CoC acid tests', () => {
  it('evaluates damage bonus fragments, half/fifth values, HP, and chained MOV comparisons', () => {
    const template = baseTemplate({
      tables: [
        {
          id: 'db_table',
          resultType: 'dice',
          rows: [
            { min: 0, max: 64, result: '' },
            { min: 65, max: 84, result: '+1d4' },
            { min: 85, max: 999, result: '+1d6' },
          ],
        },
      ],
      sections: [
        {
          id: 'abilities',
          label: 'Abilities',
          fields: [
            { type: 'scalar', id: 'str', uid: 'abilities.str', label: 'STR', valueType: 'number' },
            { type: 'scalar', id: 'siz', uid: 'abilities.siz', label: 'SIZ', valueType: 'number' },
            { type: 'scalar', id: 'con', uid: 'abilities.con', label: 'CON', valueType: 'number' },
            { type: 'scalar', id: 'dex', uid: 'abilities.dex', label: 'DEX', valueType: 'number' },
          ],
        },
        {
          id: 'derived',
          label: 'Derived',
          fields: [
            { type: 'computed', id: 'db', uid: 'derived.db', label: 'DB', resultType: 'dice', formula: "lookup(db_table, {abilities.str} + {abilities.siz})" },
            { type: 'computed', id: 'str_half', uid: 'derived.str_half', label: 'STR Half', resultType: 'number', formula: 'floor({abilities.str} / 2)' },
            { type: 'computed', id: 'str_fifth', uid: 'derived.str_fifth', label: 'STR Fifth', resultType: 'number', formula: 'floor({abilities.str} / 5)' },
            { type: 'computed', id: 'hp', uid: 'derived.hp', label: 'HP', resultType: 'number', formula: 'floor(({abilities.con} + {abilities.siz}) / 10)' },
            { type: 'computed', id: 'mov', uid: 'derived.mov', label: 'MOV', resultType: 'number', formula: 'if({abilities.dex} < {abilities.str}, 7, if({abilities.dex} > {abilities.siz}, 9, 8))' },
          ],
        },
      ],
    });

    const evaluated = evaluateTemplate(template, {
      values: {
        'abilities.str': 55,
        'abilities.siz': 20,
        'abilities.con': 55,
        'abilities.dex': 50,
      },
    });

    expect(evaluated.values['derived.db']).toEqual({ type: 'dice', value: '+1d4' });
    expect(evaluated.values['derived.str_half']).toEqual({ type: 'number', value: 27 });
    expect(evaluated.values['derived.str_fifth']).toEqual({ type: 'number', value: 11 });
    expect(evaluated.values['derived.hp']).toEqual({ type: 'number', value: 7 });
    expect(evaluated.values['derived.mov']).toEqual({ type: 'number', value: 7 });
    expect(interpolateNotation({ template, evaluated, notation: '1d8{derived.db}' }).notation).toBe('1d8+1d4');
  });
});
