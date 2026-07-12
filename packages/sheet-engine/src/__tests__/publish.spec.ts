import { validatePublishTemplate } from '..';
import { baseTemplate, issueMessages } from './test-utils';

describe('publish validation rejects unsupported v1 surface', () => {
  it.each([
    ['section', baseTemplate({ sections: [{ id: 'main', label: '   ', fields: [] }] })],
    [
      'field',
      baseTemplate({
        sections: [
          {
            id: 'main',
            label: 'Main',
            fields: [{ type: 'scalar', id: 'hp', uid: 'main.hp', label: '\t', valueType: 'number' }],
          },
        ],
      }),
    ],
  ])('rejects a %s label that is empty after trim', (_target, template) => {
    const result = validatePublishTemplate(template);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ message: 'label must not be empty' }));
  });

  it('rejects visibleTo other than public, when, and secret roles', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'hidden', uid: 'main.hidden', label: 'Hidden', valueType: 'number', visibleTo: 'gm' },
            { type: 'scalar', id: 'gated', uid: 'main.gated', label: 'Gated', valueType: 'number', when: '{main.hidden} > 0' },
            { type: 'scalar', id: 'secret_roll', uid: 'main.secret_roll', label: 'Secret', valueType: 'number', role: { kind: 'rollable', notation: '1d20{value}', secret: true } },
          ],
        },
      ],
    });

    expect(issueMessages(template)).toEqual(expect.arrayContaining([
      'visibleTo other than public is 未対応',
      'when is 未対応',
      'secret role is 未対応',
    ]));
  });

  it('rejects unknown role kinds and unknown field kinds', () => {
    const unknownRole = {
      ...baseTemplate(),
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [{ type: 'scalar', id: 'n', uid: 'main.n', label: 'N', valueType: 'number', role: { kind: 'secret', notation: '1d20' } }],
        },
      ],
    };
    const unknownField = {
      ...baseTemplate(),
      sections: [{ id: 'main', label: 'Main', fields: [{ type: 'mystery', id: 'n', uid: 'main.n', label: 'N' }] }],
    };

    expect(validatePublishTemplate(unknownRole).ok).toBe(false);
    expect(validatePublishTemplate(unknownField).ok).toBe(false);
  });

  it('rejects RollField in itemFields and nested lists in list itemFields', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            {
              type: 'list',
              id: 'items',
              uid: 'main.items',
              label: 'Items',
              itemFields: [
                { type: 'roll', id: 'roll', uid: 'items.roll', label: 'Roll', notation: '1d6' },
                { type: 'list', id: 'nested', uid: 'items.nested', label: 'Nested', itemFields: [] },
              ],
            },
          ],
        },
      ],
    });

    expect(issueMessages(template)).toEqual(expect.arrayContaining([
      'RollField in itemFields is not supported in v1',
      'list inside list is not supported',
    ]));
  });

  it('rejects id convention violations, duplicate uids, and lookup tables over the row cap', () => {
    const template = baseTemplate({
      tables: [{ id: 'bad_table', rows: [[0, 'zero'], [1, 'one']] }],
      sections: [
        {
          id: 'Main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'Bad-Id', uid: 'dup.uid', label: 'Bad', valueType: 'number' },
            { type: 'scalar', id: 'other', uid: 'dup.uid', label: 'Other', valueType: 'number' },
          ],
        },
      ],
    });

    const result = validatePublishTemplate(template, { tableRowLimit: 1 });
    expect(result.issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      'Lookup table row limit exceeded: 2 > 1',
      'uid must be unique: dup.uid',
    ]));
    expect(result.issues.some((issue) => issue.message.startsWith('id must match'))).toBe(true);
  });
});

describe('publish validation formula and notation source typing', () => {
  it('rejects computed resultType mismatches', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'computed', id: 'bad_text', uid: 'main.bad_text', label: 'Bad text', resultType: 'number', formula: "'abc'" },
            { type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', min: 0, max: { formula: "'high'" }, style: 'gauge' },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues.map((issue) => issue.message)).toEqual(expect.arrayContaining([
      'field bad_text expected number, got text',
      'field hp expected number, got text',
    ]));
  });

  it('rejects lookup-backed notation fragments when any dice row is invalid', () => {
    const template = baseTemplate({
      tables: [{ id: 'damage_fragments', resultType: 'dice', rows: [[1, '+1d4'], [2, '+1d4;drop']] }],
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'rank', uid: 'main.rank', label: 'Rank', valueType: 'number' },
            { type: 'computed', id: 'damage', uid: 'main.damage', label: 'Damage', resultType: 'dice', formula: 'lookup(damage_fragments, {main.rank})' },
            { type: 'scalar', id: 'attack', uid: 'main.attack', label: 'Attack', valueType: 'number', role: { kind: 'rollable', notation: '1d20{main.damage}' } },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues.map((issue) => issue.message)).toContain(
      'field damage lookup table damage_fragments row 1 result must be notation fragment: +1d4;drop',
    );
  });

  it('accepts lookup-backed dice notation fragments from DB-style tables', () => {
    const template = baseTemplate({
      tables: [{ id: 'damage_fragments', resultType: 'dice', rows: [[1, '+1d4'], [2, '+2d4']] }],
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'rank', uid: 'main.rank', label: 'Rank', valueType: 'number' },
            { type: 'computed', id: 'damage', uid: 'main.damage', label: 'Damage', resultType: 'dice', formula: 'lookup(damage_fragments, {main.rank})' },
            { type: 'scalar', id: 'attack', uid: 'main.attack', label: 'Attack', valueType: 'number', role: { kind: 'rollable', notation: '1d20{main.damage}' } },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).ok).toBe(true);
  });

  it('rejects shortened list subfield paths in published formulas', () => {
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
              itemFields: [{ type: 'scalar', id: 'atk', uid: 'weapons.atk', label: 'Atk', valueType: 'number' }],
            },
            { type: 'computed', id: 'total', uid: 'main.total', label: 'Total', resultType: 'number', formula: 'sum({weapons.atk})' },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues.map((issue) => issue.message)).toContain('Unknown field reference: weapons.atk');
  });
});
