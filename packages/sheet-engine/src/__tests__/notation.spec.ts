import { evaluateTemplate, interpolateNotation, isNotationFragment, validatePublishTemplate } from '..';
import { baseTemplate } from './test-utils';

describe('notation interpolation', () => {
  const template = baseTemplate({
    sections: [
      {
        id: 'main',
        label: 'Main',
        fields: [
          { type: 'computed', id: 'mod', uid: 'main.mod', label: 'Mod', resultType: 'number', formula: '-1' },
          { type: 'computed', id: 'n', uid: 'main.n', label: 'N', resultType: 'number', formula: '3' },
          { type: 'computed', id: 'frag', uid: 'main.frag', label: 'Frag', resultType: 'dice', formula: "'+1d4'" },
        ],
      },
    ],
  });

  it('interpolates multiple refs and normalizes negative signs without producing "+-1"', () => {
    const evaluated = evaluateTemplate(template);
    const result = interpolateNotation({ template, evaluated, notation: '1d20{+main.mod}{main.frag}' });

    expect(result.notation).toBe('1d20-1+1d4');
    expect(result.notation).not.toContain('+-');
    expect(result.refs.map((ref) => ref.kind === 'field' && ref.uid)).toEqual(['main.mod', 'main.frag']);
  });

  it('supports dice-count positions and escaped braces', () => {
    const evaluated = evaluateTemplate(template);

    expect(interpolateNotation({ template, evaluated, notation: '({main.n})d10' }).notation).toBe('(3)d10');
    expect(interpolateNotation({ template, evaluated, notation: '{{literal}}+{main.n}' }).notation).toBe('{literal}+3');
  });
});

describe('notation fragment characterization', () => {
  it.each<[string, boolean]>([
    ['d6', true],
    ['2d6+1d4', true],
    ['1d6+1d6+2', true],
    ['10', true],
    // Legacy CoC seed source: TRPG-SERVER/src/domains/character-sheet-template/seeds/legacy-coc.template.ts
    ['3d6*5', false],
    ['(2d6+6)*5', false],
  ])('isNotationFragment(%s) returns %s', (notation, expected) => {
    expect(isNotationFragment(notation)).toBe(expected);
  });
});

describe('notation publish validation', () => {
  it('rejects {value} in rowRole because the subfield is ambiguous', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            {
              type: 'list',
              id: 'weapons',
              uid: 'main.weapons',
              label: 'Weapons',
              rowRole: { kind: 'rollable', notation: '1d20{value}' },
              itemFields: [{ type: 'scalar', id: 'atk', uid: 'weapons.atk', label: 'Atk', valueType: 'number' }],
            },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues.map((issue) => issue.message)).toContain('rowRole cannot use {value}; use {row.subFieldId}');
  });

  it('rejects free text {value} and free text field references in notation', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'name', uid: 'main.name', label: 'Name', valueType: 'text', role: { kind: 'rollable', notation: '1d20{value}' } },
            { type: 'scalar', id: 'atk', uid: 'main.atk', label: 'Atk', valueType: 'number', role: { kind: 'rollable', notation: '1d20{+main.name}' } },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      'notation reference {value} must be number or validated fragment',
      'notation reference {main.name} must be number or validated fragment',
    ]));
  });
});
