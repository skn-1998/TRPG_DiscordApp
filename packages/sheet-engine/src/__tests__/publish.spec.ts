import { validatePublishTemplate } from '..';
import { baseTemplate, issueMessages } from './test-utils';

declare const Buffer: {
  byteLength(value: string, encoding: 'utf8'): number;
};

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

  it('rejects unknown list rowRole kinds', () => {
    const template = {
      ...baseTemplate(),
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
              rowRole: { kind: 'secret' },
              itemFields: [
                { type: 'scalar', id: 'name', uid: 'items.name', label: 'Name', valueType: 'text' },
              ],
            },
          ],
        },
      ],
    };

    const result = validatePublishTemplate(template);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: 'sections.0.fields.0.rowRole.kind' }),
    );
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

describe('publish reference key uniqueness', () => {
  it('rejects duplicate top-level canonical field paths', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'hp', uid: 'hp-current', label: 'Current HP', valueType: 'number' },
            { type: 'scalar', id: 'hp', uid: 'hp-maximum', label: 'Maximum HP', valueType: 'number' },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues).toContainEqual({
      path: 'main.hp',
      message: 'canonical path must be unique: main.hp',
    });
  });

  it('rejects duplicate canonical paths in list itemFields', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            {
              type: 'list',
              id: 'items',
              uid: 'items',
              label: 'Items',
              itemFields: [
                { type: 'scalar', id: 'weight', uid: 'weight-base', label: 'Base weight', valueType: 'number' },
                { type: 'scalar', id: 'weight', uid: 'weight-total', label: 'Total weight', valueType: 'number' },
              ],
            },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues).toContainEqual({
      path: 'main.items.weight',
      message: 'canonical path must be unique: main.items.weight',
    });
  });

  it('rejects duplicate table ids', () => {
    const template = baseTemplate({
      tables: [
        { id: 'damage', rows: [[1, '1d4']] },
        { id: 'damage', rows: [[1, '1d6']] },
      ],
    });

    expect(validatePublishTemplate(template).issues).toContainEqual({
      path: 'tables.damage.id',
      message: 'table id must be unique: damage',
    });
  });

  it('reports duplicate table ids one character beyond the ID_PATTERN maximum', () => {
    const overlongId = `a${'b'.repeat(32)}`;
    const path = `tables.${overlongId}.id`;
    const template = baseTemplate({
      tables: [
        { id: overlongId, rows: [[1, '1d4']] },
        { id: overlongId, rows: [[1, '1d6']] },
      ],
    });

    expect(validatePublishTemplate(template).issues).toEqual(expect.arrayContaining([
      { path, message: 'id must match /^[a-z][a-z0-9_]{0,31}$/' },
      { path, message: `table id must be unique: ${overlongId}` },
    ]));
  });

  it('truncates overlong duplicate table ids in uniqueness issues', () => {
    const overlongId = 'a'.repeat(150);
    const uniquenessMessagePrefix = 'table id must be unique: ';
    const template = baseTemplate({
      tables: [
        { id: overlongId, rows: [[1, '1d4']] },
        { id: overlongId, rows: [[1, '1d6']] },
      ],
    });

    const uniquenessIssue = validatePublishTemplate(template).issues.find(
      (issue) => issue.message.startsWith(uniquenessMessagePrefix),
    );

    expect(uniquenessIssue).toBeDefined();
    expect(uniquenessIssue?.path.endsWith('…')).toBe(true);
    expect(uniquenessIssue?.message.endsWith('…')).toBe(true);
    expect(uniquenessIssue?.path.length).toBeLessThanOrEqual(98);
    expect(uniquenessIssue?.message.length).toBeLessThanOrEqual(uniquenessMessagePrefix.length + 98);
    expect(uniquenessIssue?.path).not.toContain(overlongId);
    expect(uniquenessIssue?.message).not.toContain(overlongId);
  });

  it('accepts an existing valid template with unique canonical paths and table ids', () => {
    const template = baseTemplate({
      tables: [
        { id: 'damage', rows: [[1, '1d4']] },
        { id: 'healing', rows: [[1, '1d6']] },
      ],
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'hp', uid: 'hp', label: 'HP', valueType: 'number' },
            {
              type: 'list',
              id: 'items',
              uid: 'items',
              label: 'Items',
              itemFields: [
                { type: 'scalar', id: 'weight', uid: 'weight', label: 'Weight', valueType: 'number' },
              ],
            },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).ok).toBe(true);
  });
});

describe('publish schema uid and label length limits', () => {
  it('rejects an empty uid without rejecting a whitespace-only uid', () => {
    const withUid = (uid: string) => baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [{ type: 'scalar', id: 'value', uid, label: 'Value', valueType: 'number' }],
        },
      ],
    });

    expect(validatePublishTemplate(withUid('')).issues).toContainEqual(
      expect.objectContaining({ message: 'uid must not be empty' }),
    );
    expect(validatePublishTemplate(withUid(' ')).ok).toBe(true);
  });

  it('accepts a uid at 128 characters', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [{ type: 'scalar', id: 'value', uid: 'u'.repeat(128), label: 'Value', valueType: 'number' }],
        },
      ],
    });

    expect(validatePublishTemplate(template).ok).toBe(true);
  });

  it('rejects a uid at 129 characters', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [{ type: 'scalar', id: 'value', uid: 'u'.repeat(129), label: 'Value', valueType: 'number' }],
        },
      ],
    });

    expect(validatePublishTemplate(template).ok).toBe(false);
  });

  it('accepts a label at 128 characters', () => {
    const template = baseTemplate({
      sections: [{ id: 'main', label: 'L'.repeat(128), fields: [] }],
    });

    expect(validatePublishTemplate(template).ok).toBe(true);
  });

  it('rejects a label at 129 characters', () => {
    const template = baseTemplate({
      sections: [{ id: 'main', label: 'L'.repeat(129), fields: [] }],
    });

    expect(validatePublishTemplate(template).ok).toBe(false);
  });

  it('rejects an overlong uid in nested list itemFields', () => {
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
                { type: 'scalar', id: 'value', uid: 'u'.repeat(129), label: 'Value', valueType: 'number' },
              ],
            },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).ok).toBe(false);
  });

  it('keeps overlong uid issues bounded without echoing the input value', () => {
    const sentinel = 'SENTINEL_DO_NOT_ECHO_';
    const oversizedUid = sentinel + 'u'.repeat(99_979);
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [{ type: 'scalar', id: 'value', uid: oversizedUid, label: 'Value', valueType: 'number' }],
        },
      ],
    });

    const result = validatePublishTemplate(template);
    const serializedIssues = JSON.stringify(result.issues);

    expect(result.issues.length).toBeGreaterThan(0);
    expect(serializedIssues).not.toContain(sentinel);
    expect(Buffer.byteLength(serializedIssues, 'utf8')).toBeLessThan(2_000);
    expect(result.issues.every((issue) => JSON.stringify(issue).length < 200)).toBe(true);
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
