import {
  DEFAULT_AST_NODE_LIMIT,
  DEFAULT_STEP_LIMIT,
  estimateStaticEvaluationSteps,
  evaluateTemplate,
  SheetTemplate,
  validatePublishTemplate,
} from '..';
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

  it('keeps maximum-length schema-valid duplicate uids untruncated', () => {
    const duplicateUid = 'u'.repeat(128);
    const uniquenessMessagePrefix = 'uid must be unique: ';
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'first', uid: duplicateUid, label: 'First', valueType: 'number' },
            { type: 'scalar', id: 'second', uid: duplicateUid, label: 'Second', valueType: 'number' },
          ],
        },
      ],
    });

    const uniquenessIssue = validatePublishTemplate(template).issues.find(
      (issue) => issue.message.startsWith(uniquenessMessagePrefix),
    );

    expect(uniquenessIssue).toBeDefined();
    expect(uniquenessIssue?.message.endsWith('…')).toBe(false);
    expect(uniquenessIssue?.message.length).toBeLessThanOrEqual(uniquenessMessagePrefix.length + 131);
    expect(uniquenessIssue?.message).toContain(duplicateUid);
  });
});

describe('publish U15 vocabulary validation', () => {
  function u15Template(
    sectionPatch: Record<string, unknown> = {},
    fieldPatch: Record<string, unknown> = {},
    templatePatch: Record<string, unknown> = {},
  ) {
    return {
      ...baseTemplate(),
      ...templatePatch,
      sections: [{
        id: 'skills',
        label: 'Skills',
        fields: [{
          type: 'scalar', id: 'skill', uid: 'skills.skill', label: 'Skill', valueType: 'number',
          ...fieldPatch,
        }],
        ...sectionPatch,
      }],
    };
  }

  const labelTargets: Array<[string, (label: string) => unknown, string]> = [
    ['block', (label) => u15Template(
      { blocks: [{ id: 'combat', label }] },
      { blockId: 'combat' },
    ), 'sections.0.blocks.0.label'],
    ['pool', (label) => u15Template(
      { pools: [{ id: 'career_pool', label, total: 1, partsKey: 'career' }] },
      { partsKeys: [{ id: 'career', label: 'Career' }] },
    ), 'sections.0.pools.0.label'],
    ['partsKey', (label) => u15Template(
      {},
      { partsKeys: [{ id: 'career', label }] },
    ), 'sections.0.fields.0.partsKeys.0.label'],
  ];

  function fieldWithPartsKey(id: string, label: string, partsKeyLabel: string, blockId?: string) {
    return {
      type: 'scalar',
      id,
      uid: `skills.${id}`,
      label,
      valueType: 'number',
      partsKeys: [{ id: 'career', label: partsKeyLabel }],
      ...(blockId === undefined ? {} : { blockId }),
    };
  }

  const validShapes: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    ['blocks', { blocks: [
      { id: 'combat', label: 'Combat', cap: 99 },
      { id: 'explore', label: 'Explore', cap: { formula: '90 + 9' } },
      { id: 'other_skills', label: 'Other skills' },
    ], fields: [
      { type: 'scalar', id: 'combat', uid: 'skills.combat', label: 'Combat', valueType: 'number', blockId: 'combat' },
      { type: 'scalar', id: 'explore', uid: 'skills.explore', label: 'Explore', valueType: 'number', blockId: 'explore' },
      { type: 'scalar', id: 'misc', uid: 'skills.misc', label: 'Other', valueType: 'number', blockId: 'other_skills' },
    ] }, {}],
    ['pools', { pools: [
      { id: 'career', label: 'Career', total: 100, partsKey: 'career' },
      { id: 'hobby', label: 'Hobby', total: { formula: '50 + 50' }, partsKey: 'hobby', scope: ['explore'] },
    ], blocks: [{ id: 'explore', label: 'Explore' }] }, {
      blockId: 'explore',
      partsKeys: [{ id: 'career', label: 'Career' }, { id: 'hobby', label: 'Hobby' }],
    }],
    ['blockId', { blocks: [{ id: 'combat', label: 'Combat' }] }, { blockId: 'combat' }],
    ['track blockId', { blocks: [{ id: 'combat', label: 'Combat' }] }, { type: 'track', id: 'hp', uid: 'skills.hp', label: 'HP', max: 10, style: 'gauge', blockId: 'combat' }],
    ['numeric scalar max', {}, { max: 99 }],
    ['formula scalar max', {}, { max: { formula: '90 + 9' } }],
    ['partsKeys', {}, { partsKeys: [{ id: 'career', label: 'Career' }] }],
  ];

  it.each(validShapes)('accepts valid %s shape', (_case, sectionPatch, fieldPatch) => {
    const result = validatePublishTemplate(u15Template(sectionPatch, fieldPatch));

    expect(result).toEqual(expect.objectContaining({ ok: true, issues: [], warnings: [] }));
  });

  const invalidShapes: Array<[string, Record<string, unknown>, Record<string, unknown>]> = [
    ['string cap', { blocks: [{ id: 'combat', label: 'Combat', cap: '99' }] }, {}],
    ['pool without total', { pools: [{ id: 'career', label: 'Career', partsKey: 'career' }] }, {}],
    ['pool with string total', { pools: [{ id: 'career', label: 'Career', total: '100', partsKey: 'career' }] }, {}],
    ['pool with non-string scope item', { pools: [{ id: 'career', label: 'Career', total: 100, partsKey: 'career', scope: [1] }] }, {}],
    ['numeric blockId', {}, { blockId: 1 }],
    ['string scalar max', {}, { max: '99' }],
    ['non-array partsKeys', {}, { partsKeys: { id: 'career', label: 'Career' } }],
  ];

  it.each(invalidShapes)('rejects %s as a structural issue', (_case, sectionPatch, fieldPatch) => {
    const result = validatePublishTemplate(u15Template(sectionPatch, fieldPatch));

    expect(result.ok).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['partsKeys with parts omitted', { partsKeys: [{ id: 'career', label: 'Career' }] }],
    ['partsKeys with parts false', { parts: false, partsKeys: [{ id: 'career', label: 'Career' }] }],
    ['distinct non-reserved ids', { partsKeys: [{ id: 'career', label: 'Career' }, { id: 'hobby', label: 'Hobby' }] }],
  ])('accepts %s', (_case, fieldPatch) => {
    expect(validatePublishTemplate(u15Template({}, fieldPatch)).issues).toEqual([]);
  });

  it('rejects empty partsKeys and accepts a non-empty declaration', () => {
    expect(validatePublishTemplate(u15Template({}, { partsKeys: [] })).issues).toContainEqual({
      path: 'sections.0.fields.0.partsKeys',
      message: 'partsKeys must contain at least one entry',
    });
    expect(validatePublishTemplate(u15Template({}, {
      partsKeys: [{ id: 'career', label: 'Career' }],
    })).ok).toBe(true);
  });

  it.each([
    ['parts true with partsKeys', { parts: true, partsKeys: [{ id: 'career', label: 'Career' }] }, 'parts and partsKeys must not be specified together'],
    ['reserved base id', { partsKeys: [{ id: 'base', label: 'Base' }] }, 'id is reserved: base'],
    ['reserved other id', { partsKeys: [{ id: 'other', label: 'Other' }] }, 'id is reserved: other'],
    ['invalid Bad-Id! id', { partsKeys: [{ id: 'Bad-Id!', label: 'Bad' }] }, 'id must match /^[a-z][a-z0-9_]{0,31}$/'],
    ['reserved sum id', { partsKeys: [{ id: 'sum', label: 'Sum' }] }, 'id is reserved: sum'],
    ['reserved values id', { partsKeys: [{ id: 'values', label: 'Values' }] }, 'id is reserved: values'],
    ['reserved row id', { partsKeys: [{ id: 'row', label: 'Row' }] }, 'id is reserved: row'],
    ['invalid __proto__ id', { partsKeys: [{ id: '__proto__', label: 'Prototype' }] }, 'id must match /^[a-z][a-z0-9_]{0,31}$/'],
    ['duplicate id', { partsKeys: [{ id: 'career', label: 'Career' }, { id: 'career', label: 'Duplicate' }] }, 'partsKey id must be unique within field: career'],
  ])('rejects %s', (_case, fieldPatch, message) => {
    expect(issueMessages(u15Template({}, fieldPatch))).toContain(message);
  });

  it.each([
    ['field', u15Template({}, { id: 'constructor', uid: 'skills.constructor' }), 'skills.constructor.id'],
    ['table', u15Template({}, {}, { tables: [{ id: 'constructor', rows: [[0, 'zero']] }] }), 'tables.constructor.id'],
    ['partsKey', u15Template({}, { partsKeys: [{ id: 'constructor', label: 'Prototype' }] }), 'skills.skill.partsKeys.0.id'],
  ])('rejects constructor as a reserved %s id', (_case, template, path) => {
    const result = validatePublishTemplate(template);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({ path, message: 'id is reserved: constructor' });
  });

  it('rejects a single 1 MiB partsKey id without amplifying the issue response', () => {
    const oversizedId = 'x'.repeat(1024 * 1024);
    const result = validatePublishTemplate(u15Template({}, {
      partsKeys: [{ id: oversizedId, label: 'Oversized' }],
    }));
    const serializedIssues = JSON.stringify(result.issues);

    expect(result.issues).toEqual([{
      path: 'skills.skill.partsKeys.0.id',
      message: 'id must match /^[a-z][a-z0-9_]{0,31}$/',
    }]);
    expect(Buffer.byteLength(serializedIssues, 'utf8')).toBeLessThan(200);
  });

  it('bounds the duplicate partsKey id message for a 1 MiB input', () => {
    const duplicateId = 'x'.repeat(1024 * 1024);
    const messagePrefix = 'partsKey id must be unique within field: ';
    const result = validatePublishTemplate(u15Template({}, {
      partsKeys: [{ id: duplicateId, label: 'First' }, { id: duplicateId, label: 'Duplicate' }],
    }));
    const issue = result.issues.find((candidate) => candidate.message.startsWith(messagePrefix));

    expect(issue?.path).toBe('skills.skill.partsKeys.1.id');
    expect(issue?.message).toHaveLength(messagePrefix.length + 131);
    expect(issue?.message.endsWith('…')).toBe(true);
  });

  it.each([
    ['relation attr', {
      type: 'relation', id: 'ally', uid: 'skills.ally', label: 'Ally',
      attrs: [{ type: 'scalar', id: 'score', uid: 'ally.score', label: 'Score', valueType: 'number', parts: true,
        partsKeys: [{ id: 'base', label: 'Base' }, { id: 'career', label: 'Career' }, { id: 'career', label: 'Duplicate' }] }],
    }, 'skills.ally.score'],
    ['list item field', {
      type: 'list', id: 'items', uid: 'skills.items', label: 'Items',
      itemFields: [{ type: 'scalar', id: 'score', uid: 'items.score', label: 'Score', valueType: 'number', parts: true,
        partsKeys: [{ id: 'base', label: 'Base' }, { id: 'career', label: 'Career' }, { id: 'career', label: 'Duplicate' }] }],
    }, 'skills.items.score'],
  ])('applies all partsKey rules to a nested %s', (_case, fieldPatch, path) => {
    const result = validatePublishTemplate(u15Template({}, fieldPatch));

    expect(result.issues).toEqual([
      { path: `${path}.partsKeys`, message: 'parts and partsKeys must not be specified together' },
      { path: `${path}.partsKeys.0.id`, message: 'id is reserved: base' },
      { path: `${path}.partsKeys.2.id`, message: 'partsKey id must be unique within field: career' },
      { path: `${path}.partsKeys`, message: 'scalar partsKeys are only supported on section-level number scalar fields' },
    ]);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['block pattern', { blocks: [{ id: 'Bad-Id!', label: 'Bad' }] }, { blockId: 'Bad-Id!' },
      { path: 'sections.skills.blocks.0.id', message: 'id must match /^[a-z][a-z0-9_]{0,31}$/' }],
    ['block reserved id', { blocks: [{ id: 'sum', label: 'Sum' }] }, { blockId: 'sum' },
      { path: 'sections.skills.blocks.0.id', message: 'id is reserved: sum' }],
    ['pool pattern', { pools: [{ id: 'Bad-Id!', label: 'Bad', total: 1, partsKey: 'career' }] },
      { partsKeys: [{ id: 'career', label: 'Career' }] },
      { path: 'sections.skills.pools.0.id', message: 'id must match /^[a-z][a-z0-9_]{0,31}$/' }],
    ['pool reserved id', { pools: [{ id: 'values', label: 'Values', total: 1, partsKey: 'career' }] },
      { partsKeys: [{ id: 'career', label: 'Career' }] },
      { path: 'sections.skills.pools.0.id', message: 'id is reserved: values' }],
  ])('applies the existing id convention to %s', (_case, sectionPatch, fieldPatch, expectedIssue) => {
    const result = validatePublishTemplate(u15Template(sectionPatch, fieldPatch));

    expect(result.issues).toEqual([expectedIssue]);
    expect(result.warnings).toEqual([]);
  });

  it.each(labelTargets)('accepts a %s label at 128 characters', (_target, templateWithLabel) => {
    expect(validatePublishTemplate(templateWithLabel('L'.repeat(128))).issues).toEqual([]);
  });

  it.each(labelTargets)('rejects a whitespace-only %s label', (_target, templateWithLabel, path) => {
    expect(validatePublishTemplate(templateWithLabel(' \t ')).issues).toEqual([{
      path,
      message: 'label must not be empty',
    }]);
  });

  it.each(labelTargets)('rejects a %s label over 128 characters', (_target, templateWithLabel, path) => {
    expect(validatePublishTemplate(templateWithLabel('L'.repeat(129))).issues).toEqual([{
      path,
      message: 'label must be 128 characters or fewer',
    }]);
  });

  it('rejects a 1 MiB partsKey label without amplifying the issue response', () => {
    const oversizedLabel = 'L'.repeat(1024 * 1024);
    const result = validatePublishTemplate(u15Template({}, {
      partsKeys: [{ id: 'career', label: oversizedLabel }],
    }));
    const serializedIssues = JSON.stringify(result.issues);

    expect(result.issues).toEqual([{
      path: 'sections.0.fields.0.partsKeys.0.label',
      message: 'label must be 128 characters or fewer',
    }]);
    expect(Buffer.byteLength(serializedIssues, 'utf8')).toBeLessThan(200);
  });

  it.each([
    ['declared block', {
      blocks: [{ id: 'core', label: 'Core' }],
      fields: [
        fieldWithPartsKey('first', 'First', 'Career', 'core'),
        fieldWithPartsKey('second', 'Second', 'Occupation', 'core'),
      ],
    }],
    ['default block', {
      fields: [
        fieldWithPartsKey('first', 'First', 'Career'),
        fieldWithPartsKey('second', 'Second', 'Occupation'),
      ],
    }],
  ])('rejects different labels for the same partsKey id within the same %s', (_case, sectionPatch) => {
    const result = validatePublishTemplate(u15Template(sectionPatch));

    expect(result.issues).toEqual([{
      path: 'skills.second.partsKeys.0.label',
      message: 'partsKey label must be consistent within block for id: career',
    }]);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['the labels match', {
      blocks: [{ id: 'core', label: 'Core' }],
      fields: [
        fieldWithPartsKey('first', 'First', 'Career', 'core'),
        fieldWithPartsKey('second', 'Second', 'Career', 'core'),
      ],
    }],
    ['the fields belong to different blocks', {
      blocks: [{ id: 'core', label: 'Core' }, { id: 'secondary', label: 'Secondary' }],
      fields: [
        fieldWithPartsKey('first', 'First', 'Career', 'core'),
        fieldWithPartsKey('second', 'Second', 'Occupation', 'secondary'),
      ],
    }],
  ])('accepts repeated partsKey ids when %s', (_case, sectionPatch) => {
    const result = validatePublishTemplate(u15Template(sectionPatch));

    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['same-field duplicate', u15Template({}, {
      partsKeys: [{ id: 'career', label: 'A' }, { id: 'career', label: 'B' }],
    }), [
      { path: 'skills.skill.partsKeys.1.id', message: 'partsKey id must be unique within field: career' },
    ]],
    ['three labels in the default block', u15Template({ fields: [
      fieldWithPartsKey('first', 'First', 'A'),
      fieldWithPartsKey('second', 'Second', 'B'),
      fieldWithPartsKey('third', 'Third', 'C'),
    ] }), [
      { path: 'skills.second.partsKeys.0.label', message: 'partsKey label must be consistent within block for id: career' },
      { path: 'skills.third.partsKeys.0.label', message: 'partsKey label must be consistent within block for id: career' },
    ]],
    ['default block and named block', u15Template({
      blocks: [{ id: 'core', label: 'Core' }],
      fields: [
        fieldWithPartsKey('first', 'First', 'A'),
        fieldWithPartsKey('second', 'Second', 'B', 'core'),
      ],
    }), []],
    ['same missing blockId', u15Template({ fields: [
      fieldWithPartsKey('first', 'First', 'A', 'missing'),
      fieldWithPartsKey('second', 'Second', 'B', 'missing'),
    ] }), [
      { path: 'skills.first.blockId', message: 'field blockId must reference a declared block: missing' },
      { path: 'skills.second.blockId', message: 'field blockId must reference a declared block: missing' },
      { path: 'skills.second.partsKeys.0.label', message: 'partsKey label must be consistent within block for id: career' },
    ]],
    ['different missing blockIds', u15Template({ fields: [
      fieldWithPartsKey('first', 'First', 'A', 'missing_a'),
      fieldWithPartsKey('second', 'Second', 'B', 'missing_b'),
    ] }), [
      { path: 'skills.first.blockId', message: 'field blockId must reference a declared block: missing_a' },
      { path: 'skills.second.blockId', message: 'field blockId must reference a declared block: missing_b' },
    ]],
  ])('pins exact H-16 issues for %s', (_case, template, expectedIssues) => {
    const result = validatePublishTemplate(template);

    expect(result.issues).toEqual(expectedIssues);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['duplicate block id', { blocks: [{ id: 'combat', label: 'A' }, { id: 'combat', label: 'B' }] }, { blockId: 'combat' },
      { path: 'sections.skills.blocks.1.id', message: 'block id must be unique: combat' }],
    ['duplicate pool id', { pools: [
      { id: 'career', label: 'A', total: 1, partsKey: 'career' },
      { id: 'career', label: 'B', total: 2, partsKey: 'career' },
    ] }, { partsKeys: [{ id: 'career', label: 'Career' }] },
    { path: 'sections.skills.pools.1.id', message: 'pool id must be unique: career' }],
    ['missing field blockId', {}, { blockId: 'missing' },
      { path: 'skills.skill.blockId', message: 'field blockId must reference a declared block: missing' }],
    ['missing relation attr blockId', {}, { type: 'relation', id: 'ally', uid: 'skills.ally', label: 'Ally', attrs: [
      { type: 'scalar', id: 'score', uid: 'ally.score', label: 'Score', valueType: 'number', blockId: 'missing' },
    ] }, { path: 'skills.ally.score.blockId', message: 'field blockId must reference a declared block: missing' }],
    ['missing list item blockId', {}, { type: 'list', id: 'items', uid: 'skills.items', label: 'Items', itemFields: [
      { type: 'scalar', id: 'score', uid: 'items.score', label: 'Score', valueType: 'number', blockId: 'missing' },
    ] }, { path: 'skills.items.score.blockId', message: 'field blockId must reference a declared block: missing' }],
    ['missing pool scope block', {
      blocks: [{ id: 'known', label: 'Known' }],
      pools: [{ id: 'career', label: 'Career', total: 1, partsKey: 'career', scope: ['known', 'missing'] }],
    }, { blockId: 'known', partsKeys: [{ id: 'career', label: 'Career' }] },
    { path: 'sections.skills.pools.0.scope.1', message: 'pool scope must reference a declared block: missing' }],
    ['missing pool partsKey', { pools: [{ id: 'career', label: 'Career', total: 1, partsKey: 'career' }] }, {},
      { path: 'sections.skills.pools.0.partsKey', message: 'pool partsKey must be declared by a field in scope: career' }],
  ])('rejects %s reference inconsistency', (_case, sectionPatch, fieldPatch, expectedIssue) => {
    const result = validatePublishTemplate(u15Template(sectionPatch, fieldPatch));

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([expectedIssue]);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['empty pool scope', { blocks: [{ id: 'known', label: 'Known' }], pools: [
      { id: 'career', label: 'Career', total: 1, partsKey: 'career', scope: [] },
    ] }, { blockId: 'known', partsKeys: [{ id: 'career', label: 'Career' }] }, [
      { path: 'sections.skills.pools.0.partsKey', message: 'pool partsKey must be declared by a field in scope: career' },
    ], []],
    ['omitted blocks and pool scope', { pools: [{ id: 'career', label: 'Career', total: 1, partsKey: 'career' }] },
      { partsKeys: [{ id: 'career', label: 'Career' }] }, [], []],
    ['omitted field blockId', {}, {}, [], []],
    ['empty section with blocks and pools', { fields: [], blocks: [{ id: 'known', label: 'Known' }],
      pools: [{ id: 'career', label: 'Career', total: 1, partsKey: 'career' }] }, {}, [
      { path: 'sections.skills.pools.0.partsKey', message: 'pool partsKey must be declared by a field in scope: career' },
    ], [
      { code: 'section-empty', path: 'sections.skills.fields', message: 'section has no fields' },
      { code: 'block-empty', path: 'sections.skills.blocks.0', message: 'declared block has no fields: known' },
    ]],
  ])('pins exact issues and warnings for %s', (_case, sectionPatch, fieldPatch, expectedIssues, expectedWarnings) => {
    const result = validatePublishTemplate(u15Template(sectionPatch, fieldPatch));

    expect(result.issues).toEqual(expectedIssues);
    expect(result.warnings).toEqual(expectedWarnings);
  });

  it('bounds every new diagnostic message that echoes reference input', () => {
    const declaredId = 'd'.repeat(1024 * 1024);
    const missingId = 'm'.repeat(1024 * 1024);
    const result = validatePublishTemplate(u15Template({
      blocks: [{ id: declaredId, label: 'A' }, { id: declaredId, label: 'B' }],
      pools: [
        { id: declaredId, label: 'A', total: 1, partsKey: missingId, scope: [missingId] },
        { id: declaredId, label: 'B', total: 1, partsKey: missingId, scope: [missingId] },
      ],
    }, { blockId: missingId }));
    const reflectedDiagnostics = [...result.issues, ...result.warnings]
      .filter(({ message }) => message.includes('unique:') || message.includes('declared block:')
        || message.includes('in scope:') || message.includes('has no fields:'));

    expect(reflectedDiagnostics.length).toBeGreaterThan(0);
    expect(reflectedDiagnostics.every(({ message }) => message.length < 256 && message.endsWith('…'))).toBe(true);
  });

  it.each([
    ['section-level number scalar', { type: 'scalar', id: 'score', uid: 'skills.score', label: 'Score', valueType: 'number', max: 99,
      partsKeys: [{ id: 'career', label: 'Career' }] }, []],
    ['section-level text scalar', { type: 'scalar', id: 'score', uid: 'skills.score', label: 'Score', valueType: 'text', max: 99,
      partsKeys: [{ id: 'career', label: 'Career' }] }, [
      'scalar max is only supported on section-level number scalar fields',
      'scalar partsKeys are only supported on section-level number scalar fields',
    ]],
    ['relation attr', { type: 'relation', id: 'ally', uid: 'skills.ally', label: 'Ally', attrs: [
      { type: 'scalar', id: 'score', uid: 'ally.score', label: 'Score', valueType: 'number', max: 99,
        partsKeys: [{ id: 'career', label: 'Career' }] },
    ] }, [
      'scalar max is only supported on section-level number scalar fields',
      'scalar partsKeys are only supported on section-level number scalar fields',
    ]],
    ['list item field', { type: 'list', id: 'items', uid: 'skills.items', label: 'Items', itemFields: [
      { type: 'scalar', id: 'score', uid: 'items.score', label: 'Score', valueType: 'number', max: 99,
        partsKeys: [{ id: 'career', label: 'Career' }] },
    ] }, [
      'scalar max is only supported on section-level number scalar fields',
      'scalar partsKeys are only supported on section-level number scalar fields',
    ]],
  ])('enforces numeric annotation target for %s', (_case, fieldPatch, expectedMessages) => {
    const result = validatePublishTemplate(u15Template({}, fieldPatch));

    expect(result.issues.map((issue) => issue.message)).toEqual(expectedMessages);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['boolean scalar max/partsKeys', { valueType: 'boolean', max: { formula: "'bad'" }, partsKeys: [{ id: 'career', label: 'Career' }] }, [
      { path: 'skills.skill.max', message: 'scalar max is only supported on section-level number scalar fields' },
      { path: 'skills.skill.partsKeys', message: 'scalar partsKeys are only supported on section-level number scalar fields' },
    ]],
    ['select scalar max/partsKeys', { valueType: 'select', max: 99, partsKeys: [{ id: 'career', label: 'Career' }] }, [
      { path: 'skills.skill.max', message: 'scalar max is only supported on section-level number scalar fields' },
      { path: 'skills.skill.partsKeys', message: 'scalar partsKeys are only supported on section-level number scalar fields' },
    ]],
    ['relation attr max only', { type: 'relation', id: 'ally', uid: 'skills.ally', label: 'Ally', attrs: [
      { type: 'scalar', id: 'score', uid: 'ally.score', label: 'Score', valueType: 'number', max: { formula: "'bad'" } },
    ] }, [{ path: 'skills.ally.score.max', message: 'scalar max is only supported on section-level number scalar fields' }]],
  ])('pins exact H-6 issues for %s', (_case, fieldPatch, expectedIssues) => {
    const result = validatePublishTemplate(u15Template({}, fieldPatch));

    expect(result.issues).toEqual(expectedIssues);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['computed own max undefined', {
      type: 'computed', id: 'computed_value', uid: 'skills.computed_value', label: 'Computed', resultType: 'number', formula: '1', max: undefined,
    }, [{ path: 'skills.computed_value.max', message: 'max is only supported on section-level number scalar and track fields' }]],
    ['computed absent max', {
      type: 'computed', id: 'computed_value', uid: 'skills.computed_value', label: 'Computed', resultType: 'number', formula: '1',
    }, []],
    ['track own partsKeys undefined', {
      type: 'track', id: 'hp', uid: 'skills.hp', label: 'HP', max: 99, style: 'gauge', partsKeys: undefined,
    }, [{ path: 'skills.hp.partsKeys', message: 'partsKeys are only supported on section-level number scalar fields' }]],
    ['track absent partsKeys', {
      type: 'track', id: 'hp', uid: 'skills.hp', label: 'HP', max: 99, style: 'gauge',
    }, []],
  ])('pins the H-6 hasOwnProperty boundary for %s', (_case, fieldPatch, expectedIssues) => {
    const result = validatePublishTemplate(u15Template({}, fieldPatch));

    expect(result.issues).toEqual(expectedIssues);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['computed', { type: 'computed', id: 'computed_value', uid: 'skills.computed_value', label: 'Computed', resultType: 'number', formula: '1', max: 99,
      partsKeys: [{ id: 'career', label: 'Career' }] }, true],
    ['tag', { type: 'tag', id: 'tags', uid: 'skills.tags', label: 'Tags', max: 99,
      partsKeys: [{ id: 'career', label: 'Career' }] }, true],
    ['list', { type: 'list', id: 'items', uid: 'skills.items', label: 'Items', itemFields: [], max: 99,
      partsKeys: [{ id: 'career', label: 'Career' }] }, true],
    ['relation', { type: 'relation', id: 'ally', uid: 'skills.ally', label: 'Ally', attrs: [], max: 99,
      partsKeys: [{ id: 'career', label: 'Career' }] }, true],
    ['roll', { type: 'roll', id: 'check', uid: 'skills.check', label: 'Check', notation: '1d100', max: 99,
      partsKeys: [{ id: 'career', label: 'Career' }] }, true],
    ['track', { type: 'track', id: 'hp', uid: 'skills.hp', label: 'HP', max: 99, style: 'gauge',
      partsKeys: [{ id: 'career', label: 'Career' }] }, false],
  ])('rejects passthrough numeric annotations on a section-level %s field', (_case, fieldPatch, rejectsMax) => {
    const result = validatePublishTemplate(u15Template({}, fieldPatch));
    const path = `skills.${fieldPatch.id}`;
    const expectedIssues = [
      ...(rejectsMax ? [{
        path: `${path}.max`,
        message: 'max is only supported on section-level number scalar and track fields',
      }] : []),
      {
        path: `${path}.partsKeys`,
        message: 'partsKeys are only supported on section-level number scalar fields',
      },
    ];

    expect(result.issues).toEqual(expectedIssues);
    expect(result.warnings).toEqual([]);
  });

  it('keeps passthrough max and partsKeys on nested non-scalar fields outside the new H-6 gate', () => {
    const result = validatePublishTemplate(u15Template({}, {
      type: 'list',
      id: 'items',
      uid: 'skills.items',
      label: 'Items',
      itemFields: [{
        type: 'computed',
        id: 'cost',
        uid: 'items.cost',
        label: 'Cost',
        resultType: 'number',
        formula: '1',
        max: 99,
        partsKeys: [{ id: 'career', label: 'Career' }],
      }],
    }));

    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ['scalar max literal', {}, { max: { formula: '99' } }, {}],
    ['block cap ref operation', {
      blocks: [{ id: 'combat', label: 'Combat', cap: { formula: '{skills.skill} + 1' } }],
    }, { blockId: 'combat' }, {}],
    ['pool total lookup', {
      pools: [{ id: 'career', label: 'Career', total: { formula: 'lookup(budget, {skills.skill})' }, partsKey: 'career' }],
    }, { partsKeys: [{ id: 'career', label: 'Career' }] }, {
      tables: [{ id: 'budget', resultType: 'number', rows: [[1, 100]] }],
    }],
  ])('accepts a number-returning %s formula', (_case, sectionPatch, fieldPatch, templatePatch) => {
    expect(validatePublishTemplate(u15Template(sectionPatch, fieldPatch, templatePatch)).issues).toEqual([]);
  });

  const nonNumberFormulas = [
    ['text', "'high'"],
    ['dice', "'1d6' + '+1'"],
    ['boolean', '1 < 2'],
  ] as const;
  const h13Cases = nonNumberFormulas.flatMap(([actual, formula]) => [
    [`scalar max returning ${actual}`, {}, { max: { formula } }, 'skills.skill.max.formula', 'skill', actual],
    [`block cap returning ${actual}`, {
      blocks: [{ id: 'combat', label: 'Combat', cap: { formula } }],
    }, { blockId: 'combat' }, 'sections.skills.blocks.0.cap.formula', 'combat', actual],
    [`pool total returning ${actual}`, {
      pools: [{ id: 'career', label: 'Career', total: { formula }, partsKey: 'career' }],
    }, { partsKeys: [{ id: 'career', label: 'Career' }] }, 'sections.skills.pools.0.total.formula', 'career', actual],
  ] as const);

  it.each(h13Cases)('rejects %s under H-13', (_case, sectionPatch, fieldPatch, path, targetId, actual) => {
    expect(validatePublishTemplate(u15Template(sectionPatch, fieldPatch)).issues).toEqual([
      { path, message: `field ${targetId} expected number, got ${actual}` },
    ]);
  });

  it.each([
    ['missing ref from scalar max', {}, { max: { formula: '{skills.missing}' } }, {},
      'skills.skill.max.formula', 'Unknown field reference: skills.missing'],
    ['parse error from block cap', { blocks: [{ id: 'combat', label: 'Combat', cap: { formula: '(' } }] },
      { blockId: 'combat' }, {}, 'sections.skills.blocks.0.cap.formula', 'Unexpected token eof'],
    ['AST budget from pool total', {
      pools: [{ id: 'career', label: 'Career', total: { formula: '1 + 2' }, partsKey: 'career' }],
    }, { partsKeys: [{ id: 'career', label: 'Career' }] }, { astNodeLimit: 2 },
    'sections.skills.pools.0.total.formula', 'AST node limit exceeded: 3 > 2'],
  ])('routes %s through formula validation', (_case, sectionPatch, fieldPatch, options, path, message) => {
    expect(validatePublishTemplate(u15Template(sectionPatch, fieldPatch), options).issues).toContainEqual({ path, message });
  });

  const oversizedReferenceSentinel = 'x'.repeat(1024 * 1024);
  const oversizedUndefinedReference = `{main.${oversizedReferenceSentinel}}`;
  it.each([
    ['scalar max', {}, { max: { formula: oversizedUndefinedReference } }],
    ['block cap', { blocks: [{ id: 'combat', label: 'Combat', cap: { formula: oversizedUndefinedReference } }] },
      { blockId: 'combat' }],
    ['pool total', { pools: [{ id: 'career', label: 'Career', total: { formula: oversizedUndefinedReference }, partsKey: 'career' }] },
      { partsKeys: [{ id: 'career', label: 'Career' }] }],
  ])('bounds every issue message for a 1 MiB undefined reference in %s', (_case, sectionPatch, fieldPatch) => {
    const issues = validatePublishTemplate(u15Template(sectionPatch, fieldPatch)).issues;

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every(({ message }) => message.length < 256)).toBe(true);
    expect(issues.every(({ message }) => !message.includes(oversizedReferenceSentinel))).toBe(true);
  });

  it('bounds an H-13 diagnostic that reflects a block id', () => {
    const blockId = 'x'.repeat(1024 * 1024);
    const result = validatePublishTemplate(u15Template({
      blocks: [{ id: blockId, label: 'Block', cap: { formula: "'high'" } }],
    }, { blockId }));
    const issue = result.issues.find(({ message }) => message.includes('expected number, got text'));

    expect(issue?.message.length).toBeLessThan(256);
    expect(issue?.message).not.toContain(blockId);
  });

  it.each([
    ['empty section', { fields: [] }, {}, ['section-empty']],
    ['empty block', { blocks: [{ id: 'combat', label: 'Combat' }] }, {}, ['block-empty']],
    ['populated section and block', { blocks: [{ id: 'combat', label: 'Combat' }] }, { blockId: 'combat' }, []],
  ])('reports the expected empty-content warnings for %s', (_case, sectionPatch, fieldPatch, expectedCodes) => {
    const result = validatePublishTemplate(u15Template(sectionPatch, fieldPatch));

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual(expectedCodes);
  });

  it('keeps warnings and issues independent', () => {
    const result = validatePublishTemplate(u15Template(
      { blocks: [{ id: 'known', label: 'Known' }] },
      { blockId: 'missing' },
    ));

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual(expect.objectContaining({ path: 'skills.skill.blockId' }));
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'block-empty' }));
  });
});

describe('publish layout warnings', () => {
  function templateWithSectionLayout(layout: unknown) {
    return {
      ...baseTemplate(),
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{ type: 'scalar', id: 'value', uid: 'main.value', label: 'Value', valueType: 'number' }],
        layout,
      }],
    };
  }

  function templateWithField(field: Record<string, unknown>, sectionLayout?: unknown) {
    return {
      ...baseTemplate(),
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [field],
        layout: sectionLayout,
      }],
    };
  }

  function templateWithFieldLayout(layout: unknown, sectionLayout?: unknown) {
    return templateWithField(
      { type: 'scalar', id: 'value', uid: 'main.value', label: 'Value', valueType: 'number', layout },
      sectionLayout,
    );
  }

  it.each([
    ['stack', { preset: 'stack' }],
    ['stack with ignored valid columns', { preset: 'stack', columns: 2 }],
    ['grid with two columns', { preset: 'grid', columns: 2 }],
    ['grid with four columns', { preset: 'grid', columns: 4 }],
    ['table', { preset: 'table' }],
    ['table with ignored valid columns', { preset: 'table', columns: 2 }],
  ])('accepts the %s section layout without warnings', (_case, layout) => {
    const result = validatePublishTemplate(templateWithSectionLayout(layout));

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it.each([1, 2, 3, 'full'])('accepts field span %s without warnings', (span) => {
    const result = validatePublishTemplate(
      templateWithFieldLayout({ span }, { preset: 'grid', columns: 4 }),
    );

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('ignores a legacy section layout without blocking publish', () => {
    const result = validatePublishTemplate(templateWithSectionLayout({ direction: 'row' }));

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual([{
      code: 'layout-legacy-ignored',
      path: 'sections.main.layout',
      message: 'section layout without preset is ignored',
    }]);
  });

  it('warns for an unknown preset without blocking publish', () => {
    const result = validatePublishTemplate(templateWithSectionLayout({ preset: 'cards' }));

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'layout-invalid-ignored',
      path: 'sections.main.layout.preset',
    }));
  });

  it.each([1, 5, 2.5])('warns for invalid section columns %s without blocking publish', (columns) => {
    const result = validatePublishTemplate(templateWithSectionLayout({ preset: 'grid', columns }));

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'layout-invalid-ignored',
      path: 'sections.main.layout.columns',
    }));
  });

  it.each([0, 4, 'wide'])('warns for invalid field span %s without blocking publish', (span) => {
    const result = validatePublishTemplate(templateWithFieldLayout({ span }));

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      code: 'layout-invalid-ignored',
      path: 'main.value.layout.span',
    }));
  });

  it.each([
    ['explicit stack', templateWithFieldLayout({ span: 1 }, { preset: 'stack' })],
    ['implicit stack', templateWithField({ type: 'scalar', id: 'value', uid: 'main.value', label: 'Value', valueType: 'number', layout: { span: 1 } })],
    ['table', templateWithFieldLayout({ span: 1 }, { preset: 'table' })],
  ])('warns when a valid span is specified in %s layout', (_case, template) => {
    const result = validatePublishTemplate(template);

    expect(result.warnings).toEqual([{
      code: 'layout-span-outside-grid',
      path: 'main.value.layout.span',
      message: 'field layout span is ignored outside grid',
    }]);
  });

  it.each([
    [
      'invalid grid with scalar span',
      templateWithFieldLayout({ span: 1 }, { preset: 'grid', columns: 5 }),
      [
        { code: 'layout-invalid-ignored', path: 'sections.main.layout.columns', message: 'section layout columns must be an integer from 2 to 4' },
      ],
    ],
    [
      'invalid grid columns with clamped scalar span',
      templateWithFieldLayout({ span: 2 }, { preset: 'grid', columns: 5 }),
      [
        { code: 'layout-invalid-ignored', path: 'sections.main.layout.columns', message: 'section layout columns must be an integer from 2 to 4' },
        { code: 'layout-span-clamped', path: 'main.value.layout.span', message: 'field layout span is clamped to full because it is not smaller than grid columns' },
      ],
    ],
    [
      'stack with complex field span',
      templateWithField({ type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', max: 10, style: 'gauge', layout: { span: 1 } }, { preset: 'stack' }),
      [{ code: 'layout-span-outside-grid', path: 'main.hp.layout.span', message: 'field layout span is ignored outside grid' }],
    ],
    [
      'nested relation attr span',
      templateWithField({
        type: 'relation', id: 'ally', uid: 'main.ally', label: 'Ally', targetKind: 'character',
        attrs: [{ type: 'scalar', id: 'name', uid: 'ally.name', label: 'Name', valueType: 'text', layout: { span: 1 } }],
      }),
      [],
    ],
    [
      'table with simple field span',
      templateWithFieldLayout({ span: 1 }, { preset: 'table' }),
      [{ code: 'layout-span-outside-grid', path: 'main.value.layout.span', message: 'field layout span is ignored outside grid' }],
    ],
    [
      'table with complex field span',
      templateWithField({ type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', max: 10, style: 'gauge', layout: { span: 1 } }, { preset: 'table' }),
      [
        { code: 'layout-span-outside-grid', path: 'main.hp.layout.span', message: 'field layout span is ignored outside grid' },
        { code: 'layout-table-complex-demoted', path: 'main.hp', message: 'complex field is demoted to a full-width table row' },
      ],
    ],
    [
      'table with invalid columns and complex field',
      templateWithField(
        { type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', max: 10, style: 'gauge' },
        { preset: 'table', columns: 5 },
      ),
      [
        { code: 'layout-invalid-ignored', path: 'sections.main.layout.columns', message: 'section layout columns must be an integer from 2 to 4' },
        { code: 'layout-table-complex-demoted', path: 'main.hp', message: 'complex field is demoted to a full-width table row' },
      ],
    ],
  ])('preserves warning boundaries and order for %s', (_case, template, expectedWarnings) => {
    const result = validatePublishTemplate(template);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.warnings).toEqual(expectedWarnings);
  });

  it.each([
    [2, 2],
    [2, 3],
    [3, 3],
  ])('warns when grid column count %s clamps numeric span %s', (columns, span) => {
    const result = validatePublishTemplate(templateWithFieldLayout({ span }, { preset: 'grid', columns }));

    expect(result.warnings).toEqual([{
      code: 'layout-span-clamped',
      path: 'main.value.layout.span',
      message: 'field layout span is clamped to full because it is not smaller than grid columns',
    }]);
  });

  it.each([
    ['track', { type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', max: 10, style: 'gauge' }],
    ['list', { type: 'list', id: 'items', uid: 'main.items', label: 'Items', itemFields: [] }],
    ['relation', { type: 'relation', id: 'ally', uid: 'main.ally', label: 'Ally', targetKind: 'character' }],
    ['tag', { type: 'tag', id: 'traits', uid: 'main.traits', label: 'Traits' }],
  ])('warns when table layout demotes a %s field', (_type, field) => {
    const result = validatePublishTemplate(templateWithField(field, { preset: 'table' }));

    expect(result.warnings).toEqual([{
      code: 'layout-table-complex-demoted',
      path: `main.${field.id}`,
      message: 'complex field is demoted to a full-width table row',
    }]);
  });

  it.each([
    ['span below columns', templateWithFieldLayout({ span: 1 }, { preset: 'grid', columns: 2 }), []],
    ['full span', templateWithFieldLayout({ span: 'full' }, { preset: 'grid', columns: 2 }), []],
    ['complex field span in grid', templateWithField(
      { type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', max: 10, style: 'gauge', layout: { span: 3 } },
      { preset: 'grid', columns: 2 },
    ), []],
    ['invalid span', templateWithFieldLayout({ span: 4 }, { preset: 'stack' }), ['layout-invalid-ignored']],
    ['list item field span', templateWithField({
      type: 'list', id: 'items', uid: 'main.items', label: 'Items',
      itemFields: [{ type: 'scalar', id: 'name', uid: 'items.name', label: 'Name', valueType: 'text', layout: { span: 1 } }],
    }), []],
  ])('does not emit a semantic warning for %s', (_case, template, expectedCodes) => {
    const result = validatePublishTemplate(template);

    expect(result.warnings.map((warning) => warning.code)).toEqual(expectedCodes);
  });
});

describe('publish diagnostic path amplification bound', () => {
  const maxPathLength = 131;
  const oversizedSectionId = 's'.repeat(1024 * 1024);

  it('bounds every diagnostic path and prevents response amplification', () => {
    const fields = Array.from({ length: 16 }, (_, index) => ({
      type: 'scalar' as const,
      id: `text_${index}`,
      uid: `text.${index}`,
      label: `Text ${index}`,
      valueType: 'text' as const,
      max: 99,
    }));
    const template = baseTemplate({ sections: [{
      id: oversizedSectionId,
      label: 'Large',
      fields,
      blocks: [{ id: 'unused', label: 'Unused' }],
    }] });

    const result = validatePublishTemplate(template);
    const diagnostics = [...result.issues, ...result.warnings];
    const inputBytes = Buffer.byteLength(JSON.stringify(template), 'utf8');
    const responseBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
    const amplificationRatio = responseBytes / inputBytes;

    expect(result.issues).toHaveLength(17);
    expect(result.warnings).toHaveLength(1);
    expect(diagnostics.every(({ path }) => path.length <= maxPathLength)).toBe(true);
    expect(amplificationRatio).toBeLessThanOrEqual(1);
  });

  it('prevents total response amplification from a 1 MiB field id echoed by 16 invalid dice rows', () => {
    const oversizedFieldId = 'f'.repeat(1024 * 1024);
    const template = baseTemplate({
      tables: [{
        id: 'damage',
        resultType: 'dice',
        rows: Array.from({ length: 16 }, (_, index) => [index, `invalid-${index}`]),
      }],
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{
          type: 'computed',
          id: oversizedFieldId,
          uid: 'main.damage',
          label: 'Damage',
          resultType: 'dice',
          formula: 'lookup(damage, 1)',
        }],
      }],
    });

    const result = validatePublishTemplate(template);
    const inputBytes = Buffer.byteLength(JSON.stringify(template), 'utf8');
    const responseBytes = Buffer.byteLength(JSON.stringify(result), 'utf8');
    const amplificationRatio = responseBytes / inputBytes;

    expect(result.issues.filter(({ message }) => message.includes('result must be notation fragment'))).toHaveLength(16);
    expect(result.issues.every(({ message }) => message.length <= 512)).toBe(true);
    expect(amplificationRatio).toBeLessThanOrEqual(1);
  });

  it('bounds a section-empty warning path at the same choke point', () => {
    const result = validatePublishTemplate(baseTemplate({ sections: [{
      id: oversizedSectionId,
      label: 'Empty',
      fields: [],
    }] }));
    const unboundedPath = `sections.${oversizedSectionId}.fields`;
    const expectedPath = `${unboundedPath.slice(0, maxPathLength - 1)}…`;

    expect(result.warnings).toEqual([{
      code: 'section-empty',
      path: expectedPath,
      message: 'section has no fields',
    }]);
  });

  it('omits resolved refs and keeps the response bounded for an invalid 1 MiB section id', () => {
    const template = baseTemplate({ sections: [{
      id: oversizedSectionId,
      label: 'Large',
      fields: [
        { type: 'scalar', id: 'value', uid: 'large.value', label: 'Value', valueType: 'number' },
        {
          type: 'computed',
          id: 'derived',
          uid: 'large.derived',
          label: 'Derived',
          resultType: 'number',
          formula: `{${oversizedSectionId}.value}`,
        },
      ],
    }] });

    const result = validatePublishTemplate(template);

    expect(result.ok).toBe(false);
    expect(result.resolvedRefs).toEqual([]);
    expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThan(4_096);
  });
});

describe('publish diagnostic input truncation boundaries', () => {
  const uniquenessMessagePrefix = 'table id must be unique: ';

  function duplicateTableIdMessage(id: string): string | undefined {
    const result = validatePublishTemplate(baseTemplate({
      tables: [{ id, rows: [] }, { id, rows: [] }],
    }));
    return result.issues.find(({ message }) => message.startsWith(uniquenessMessagePrefix))?.message;
  }

  it.each([
    ['131 code units', 'a'.repeat(131), `${uniquenessMessagePrefix}${'a'.repeat(131)}`],
    ['132 code units', 'a'.repeat(132), `${uniquenessMessagePrefix}${'a'.repeat(130)}…`],
    ['BMP Japanese at the boundary', 'あ'.repeat(132), `${uniquenessMessagePrefix}${'あ'.repeat(130)}…`],
    ['astral character crossing the boundary', `${'a'.repeat(129)}😀x`, `${uniquenessMessagePrefix}${'a'.repeat(129)}…`],
  ])('truncates %s without splitting Unicode', (_case, id, expectedMessage) => {
    expect(duplicateTableIdMessage(id)).toBe(expectedMessage);
  });
});

describe('publish reference key uniqueness', () => {
  it('truncates uid uniqueness issue paths above the shared limit', () => {
    const longSectionId = 's'.repeat(150);
    const duplicateUid = 'duplicate.uid';
    const unboundedPath = `${longSectionId}.second`;
    const expectedPath = `${unboundedPath.slice(0, 130)}…`;
    const template = baseTemplate({
      sections: [
        {
          id: longSectionId,
          label: 'Long section',
          fields: [
            { type: 'scalar', id: 'first', uid: duplicateUid, label: 'First', valueType: 'number' },
            { type: 'scalar', id: 'second', uid: duplicateUid, label: 'Second', valueType: 'number' },
          ],
        },
      ],
    });

    const uniquenessIssue = validatePublishTemplate(template).issues.find(
      (issue) => issue.message === `uid must be unique: ${duplicateUid}`,
    );

    expect(uniquenessIssue?.path).toBe(expectedPath);
    expect(uniquenessIssue?.path).toHaveLength(131);
  });

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
    expect(uniquenessIssue?.path.length).toBeLessThanOrEqual(131);
    expect(uniquenessIssue?.message.length).toBeLessThanOrEqual(uniquenessMessagePrefix.length + 131);
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

describe('relation attr and role when validation', () => {
  it('rejects an attr uid that duplicates a top-level field uid', () => {
    const template = baseTemplate({
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [
          { type: 'scalar', id: 'owner_id', uid: 'shared.uid', label: 'Owner ID', valueType: 'text' },
          {
            type: 'relation',
            id: 'owner',
            uid: 'main.owner',
            label: 'Owner',
            attrs: [{ type: 'scalar', id: 'name', uid: 'shared.uid', label: 'Name', valueType: 'text' }],
          },
        ],
      }],
    });

    expect(validatePublishTemplate(template).issues).toContainEqual({
      path: 'main.owner.name',
      message: 'uid must be unique: shared.uid',
    });
  });

  it('preserves the 131-character path for a duplicate uid in a list relation attr', () => {
    const sectionId = 's'.repeat(32);
    const listId = 'l'.repeat(32);
    const relationId = 'r'.repeat(32);
    const attrId = 'a'.repeat(32);
    const duplicateUid = 'duplicate.uid';
    const expectedPath = [sectionId, listId, relationId, attrId].join('.');
    const template = baseTemplate({
      sections: [{
        id: sectionId,
        label: 'Section',
        fields: [{
          type: 'list',
          id: listId,
          uid: duplicateUid,
          label: 'List',
          itemFields: [{
            type: 'relation',
            id: relationId,
            uid: 'relation.uid',
            label: 'Relation',
            attrs: [{ type: 'scalar', id: attrId, uid: duplicateUid, label: 'Attr', valueType: 'text' }],
          }],
        }],
      }],
    });

    expect(expectedPath).toHaveLength(131);
    expect(validatePublishTemplate(template).issues).toContainEqual({
      path: expectedPath,
      message: `uid must be unique: ${duplicateUid}`,
    });
  });

  it('rejects duplicate attr ids through canonical path uniqueness', () => {
    const template = baseTemplate({
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{
          type: 'relation',
          id: 'owner',
          uid: 'main.owner',
          label: 'Owner',
          attrs: [
            { type: 'scalar', id: 'name', uid: 'owner.name.primary', label: 'Primary name', valueType: 'text' },
            { type: 'scalar', id: 'name', uid: 'owner.name.alias', label: 'Alias', valueType: 'text' },
          ],
        }],
      }],
    });

    expect(validatePublishTemplate(template).issues).toContainEqual({
      path: 'main.owner.name',
      message: 'canonical path must be unique: main.owner.name',
    });
  });

  it('rejects attr when', () => {
    const template = baseTemplate({
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{
          type: 'relation',
          id: 'owner',
          uid: 'main.owner',
          label: 'Owner',
          attrs: [{
            type: 'scalar',
            id: 'name',
            uid: 'owner.name',
            label: 'Name',
            valueType: 'text',
            when: '{main.enabled}',
          }],
        }],
      }],
    });

    expect(validatePublishTemplate(template).issues).toContainEqual({
      path: 'main.owner.name',
      message: 'when is 未対応',
    });
  });

  it('rejects attr id pattern violations and the reserved row id', () => {
    const template = baseTemplate({
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{
          type: 'relation',
          id: 'owner',
          uid: 'main.owner',
          label: 'Owner',
          attrs: [
            { type: 'scalar', id: 'Bad-Id', uid: 'owner.bad', label: 'Bad', valueType: 'text' },
            { type: 'scalar', id: 'row', uid: 'owner.row', label: 'Row', valueType: 'text' },
          ],
        }],
      }],
    });

    expect(validatePublishTemplate(template).issues).toEqual(expect.arrayContaining([
      { path: 'main.owner.Bad-Id.id', message: 'id must match /^[a-z][a-z0-9_]{0,31}$/' },
      { path: 'main.owner.row.id', message: 'id is reserved: row' },
    ]));
  });

  it('rejects role when with an issue distinguishable from field when', () => {
    const template = {
      ...baseTemplate(),
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{
          type: 'scalar',
          id: 'hp',
          uid: 'main.hp',
          label: 'HP',
          valueType: 'number',
          when: '{main.enabled}',
          role: { kind: 'resource', deltas: [-1, 1], when: '{main.can_edit}' },
        }],
      }],
    };

    expect(validatePublishTemplate(template).issues).toEqual(expect.arrayContaining([
      { path: 'main.hp', message: 'when is 未対応' },
      { path: 'main.hp', message: 'role.when is 未対応' },
    ]));
  });

  it('rejects rowRole when', () => {
    const template = {
      ...baseTemplate(),
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{
          type: 'list',
          id: 'items',
          uid: 'main.items',
          label: 'Items',
          rowRole: { kind: 'resource', deltas: [-1, 1], when: '{row.enabled}' },
          itemFields: [{ type: 'scalar', id: 'name', uid: 'items.name', label: 'Name', valueType: 'text' }],
        }],
      }],
    };

    expect(validatePublishTemplate(template).issues).toContainEqual({
      path: 'main.items.rowRole',
      message: 'role.when is 未対応',
    });
  });

  it('accepts a relation with compliant attrs', () => {
    const template = baseTemplate({
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{
          type: 'relation',
          id: 'owner',
          uid: 'main.owner',
          label: 'Owner',
          targetKind: 'character',
          attrs: [
            { type: 'scalar', id: 'name', uid: 'owner.name', label: 'Name', valueType: 'text' },
            { type: 'scalar', id: 'level', uid: 'owner.level', label: 'Level', valueType: 'number' },
          ],
        }],
      }],
    });

    expect(validatePublishTemplate(template).ok).toBe(true);
  });
});

describe('publish schema uid and label length limits', () => {
  function templateWithUid(uid: string) {
    return baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [{ type: 'scalar', id: 'value', uid, label: 'Value', valueType: 'number' }],
        },
      ],
    });
  }

  it('rejects an empty uid without rejecting a whitespace-only uid', () => {
    expect(validatePublishTemplate(templateWithUid('')).issues).toContainEqual(
      expect.objectContaining({ message: 'uid must not be empty' }),
    );
    expect(validatePublishTemplate(templateWithUid(' ')).ok).toBe(true);
  });

  it.each(['__proto__', 'constructor', 'prototype'])('rejects reserved uid %s', (uid) => {
    const result = validatePublishTemplate(templateWithUid(uid));

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: 'sections.0.fields.0.uid',
      message: `uid is reserved: ${uid}`,
    });
  });

  it.each(['stats_base', 'stats.base'])('accepts ordinary uid %s', (uid) => {
    expect(validatePublishTemplate(templateWithUid(uid)).ok).toBe(true);
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

describe('publish function call validation', () => {
  function formulaIssues(formula: string) {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'computed', id: 'result', uid: 'main.result', label: 'Result', resultType: 'number', formula },
          ],
        },
      ],
    });

    return validatePublishTemplate(template).issues;
  }

  it('reports an unknown function exactly once', () => {
    expect(formulaIssues('mystery(1)')).toEqual([
      { path: 'main.result.formula', message: 'Unknown function: mystery' },
    ]);
  });

  it('reports invalid function arity exactly once', () => {
    expect(formulaIssues('max(1)')).toEqual([
      { path: 'main.result.formula', message: 'max is a binary function' },
    ]);
  });

  it('keeps independent unknown-function and arity issues in the same expression', () => {
    expect(formulaIssues('mystery(1) + max(1)')).toEqual([
      { path: 'main.result.formula', message: 'Unknown function: mystery' },
      { path: 'main.result.formula', message: 'max is a binary function' },
    ]);
  });
});

describe('publish validation formula and notation source typing', () => {
  it('keeps array-valued lookup results as text during publish inference', () => {
    const template = {
      ...baseTemplate(),
      tables: [{ id: 'malformed_result', rows: [[1, ['1d6']]] }],
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'computed', id: 'result', uid: 'main.result', label: 'Result', resultType: 'text', formula: 'lookup(malformed_result, 1)' },
          ],
        },
      ],
    };

    expect(validatePublishTemplate(template).ok).toBe(true);
  });

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

describe('FIX-C list container reference validation', () => {
  function listField(): SheetTemplate['sections'][number]['fields'][number] {
    return {
      type: 'list', id: 'items', uid: 'main.items', label: 'Items',
      itemFields: [{ type: 'scalar', id: 'name', uid: 'items.name', label: 'Name', valueType: 'text' }],
    };
  }

  function computedReferenceTemplate(formula: string, resultType: 'text' | 'number' = 'text'): SheetTemplate {
    return baseTemplate({
      tables: [{ id: 'labels', rows: [[1, 'one']] }],
      sections: [{
        id: 'main', label: 'Main', fields: [
          listField(),
          { type: 'computed', id: 'label', uid: 'main.label', label: 'Label', resultType, formula },
        ],
      }],
    });
  }

  const directReferenceIssue = {
    path: 'main.label.formula',
    message: 'list field cannot be referenced directly: main.items',
  };

  it('rejects the C4 text counterexample before its evaluator failure', () => {
    const template = computedReferenceTemplate('{main.items}');

    expect(estimateStaticEvaluationSteps(template)).toBe(1);
    expect(validatePublishTemplate(template)).toEqual(expect.objectContaining({
      ok: false, issues: [directReferenceIssue],
    }));
    expect(() => evaluateTemplate(template)).toThrow('Missing value for main.items');
  });

  it('rejects direct references from a number computed field and a max annotation', () => {
    const template = computedReferenceTemplate('{main.items}', 'number');
    template.sections[0].fields.push({
      type: 'scalar', id: 'score', uid: 'main.score', label: 'Score', valueType: 'number',
      max: { formula: '{main.items}' },
    });

    expect(validatePublishTemplate(template).issues).toEqual([
      { path: 'main.score.max.formula', message: directReferenceIssue.message },
      directReferenceIssue,
    ]);
  });

  it.each([
    ['if branch', "if(true, {main.items}, 'fallback')"],
    ['lookup key', 'lookup(labels, {main.items})'],
  ])('rejects a list container nested in a %s', (_case, formula) => {
    expect(validatePublishTemplate(computedReferenceTemplate(formula)).issues).toEqual([directReferenceIssue]);
  });

  it('keeps sum/count, lookup, and relation-with-attrs row references valid', () => {
    const template = baseTemplate({
      tables: [{ id: 'labels', rows: [[1, 'one']] }],
      sections: [{ id: 'main', label: 'Main', fields: [
        {
          type: 'list', id: 'items', uid: 'main.items', label: 'Items', itemFields: [
            { type: 'scalar', id: 'amount', uid: 'items.amount', label: 'Amount', valueType: 'number' },
            { type: 'scalar', id: 'name', uid: 'items.name', label: 'Name', valueType: 'text' },
            { type: 'relation', id: 'owner', uid: 'items.owner', label: 'Owner', attrs: [
              { type: 'scalar', id: 'note', uid: 'items.owner.note', label: 'Note', valueType: 'text' },
            ] },
            { type: 'computed', id: 'owner_text', uid: 'items.owner_text', label: 'Owner text', resultType: 'text', formula: '{row.owner}' },
          ],
        },
        { type: 'scalar', id: 'key', uid: 'main.key', label: 'Key', valueType: 'number' },
        { type: 'computed', id: 'total_amount', uid: 'main.total_amount', label: 'Sum', resultType: 'number', formula: 'sum({main.items.amount})' },
        { type: 'computed', id: 'row_count', uid: 'main.row_count', label: 'Count', resultType: 'number', formula: 'count({main.items.name})' },
        { type: 'computed', id: 'found_label', uid: 'main.found_label', label: 'Lookup', resultType: 'text', formula: 'lookup(labels, {main.key})' },
      ] }],
    });

    expect(validatePublishTemplate(template)).toEqual(expect.objectContaining({ ok: true, issues: [] }));
  });
});

describe('publish AST node limit normalization', () => {
  const formulaWith257AstNodes = Array.from({ length: 129 }, () => '1').join(' + ');
  const computedTemplate = (formula: string) => baseTemplate({ sections: [{
    id: 'main', label: 'Main', fields: [
      { type: 'computed', id: 'total', uid: 'main.total', label: 'Total', resultType: 'number', formula },
    ],
  }] });
  const expectedDefaultLimitIssue = { path: 'main.total.formula', message: `AST node limit exceeded: 257 > ${DEFAULT_AST_NODE_LIMIT}` };

  it('caps an upward option at the default runtime limit', () => {
    expect(validatePublishTemplate(computedTemplate(formulaWith257AstNodes), { astNodeLimit: 257 }).issues)
      .toContainEqual(expectedDefaultLimitIssue);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('falls back from non-finite limit %p', (astNodeLimit) => {
    expect(validatePublishTemplate(computedTemplate(formulaWith257AstNodes), { astNodeLimit }).issues)
      .toContainEqual(expectedDefaultLimitIssue);
  });

  it('keeps a lower positive option effective', () => {
    expect(validatePublishTemplate(computedTemplate('1 + 2'), { astNodeLimit: 2 }).issues).toContainEqual({
      path: 'main.total.formula', message: 'AST node limit exceeded: 3 > 2',
    });
  });
});

describe('H-18 static aggregate evaluation bound', () => {
  const formula = '1+1+1+1+1+1';

  function computedTemplate(fieldCount: number): SheetTemplate {
    return baseTemplate({
      sections: [{
        id: 'main',
        label: 'Main',
        fields: Array.from({ length: fieldCount }, (_, index) => ({
          type: 'computed',
          id: `f_${index}`,
          uid: `main.f_${index}`,
          label: `F ${index}`,
          resultType: 'number',
          formula,
        })),
      }],
    });
  }

  it('caps an upward option and rejects the measured 1,024 x 11 AST counterexample on both boundaries', () => {
    const template = computedTemplate(1_024);

    expect(validatePublishTemplate(template, { evaluationStepLimit: DEFAULT_STEP_LIMIT + 1 }).issues).toContainEqual({
      path: '$',
      message: `Static evaluation step limit exceeded: 11264 > ${DEFAULT_STEP_LIMIT}`,
    });
    expect(() => evaluateTemplate(template)).toThrow(`Evaluation step limit exceeded: ${DEFAULT_STEP_LIMIT}`);
  });

  it('accepts and evaluates a large template at the static boundary', () => {
    const template = computedTemplate(Math.floor(DEFAULT_STEP_LIMIT / 11));

    expect(estimateStaticEvaluationSteps(template)).toBe(9_999);
    expect(validatePublishTemplate(template).ok).toBe(true);
    expect(() => evaluateTemplate(template)).not.toThrow();
  });

  it('matches the default result for an upward finite limit on lightweight input', () => {
    const template = computedTemplate(2);

    expect(validatePublishTemplate(template, { evaluationStepLimit: DEFAULT_STEP_LIMIT + 1 }))
      .toEqual(validatePublishTemplate(template));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('falls back from non-finite limit %p', (evaluationStepLimit) => {
    const template = computedTemplate(2);

    expect(validatePublishTemplate(template, { evaluationStepLimit })).toEqual(validatePublishTemplate(template));
  });

  it.each([0, -1])('falls back from non-positive limit %p', (evaluationStepLimit) => {
    const template = computedTemplate(2);

    expect(validatePublishTemplate(template, { evaluationStepLimit })).toEqual(validatePublishTemplate(template));
  });

  it('keeps the static estimate above the measured runtime minimum for if', () => {
    const measuredMinimum = 3;
    const template = baseTemplate({ sections: [{
      id: 'main', label: 'Main', fields: [{
        type: 'computed', id: 'choice', uid: 'main.choice', label: 'Choice', resultType: 'number',
        formula: 'if(true, 1, 1+2+3+4+5)',
      }],
    }] });
    const estimated = estimateStaticEvaluationSteps(template);

    expect(estimated).toBe(12);
    expect(() => evaluateTemplate(template, { evaluationStepLimit: measuredMinimum - 1 }))
      .toThrow(`Evaluation step limit exceeded: ${measuredMinimum - 1}`);
    expect(() => evaluateTemplate(template, { evaluationStepLimit: measuredMinimum })).not.toThrow();
    expect(estimated).toBeGreaterThanOrEqual(measuredMinimum);
  });

  it('counts computed, max/resetTo, cap, and total formulas once and connects the option limit', () => {
    const threeNodes = '1 + 2';
    const template = baseTemplate({ sections: [{
      id: 'main',
      label: 'Main',
      blocks: [{ id: 'core', label: 'Core', cap: { formula: threeNodes } }],
      pools: [{ id: 'career', label: 'Career', total: { formula: threeNodes }, partsKey: 'career' }],
      fields: [
        {
          type: 'scalar', id: 'score', uid: 'main.score', label: 'Score', valueType: 'number',
          max: { formula: threeNodes }, partsKeys: [{ id: 'career', label: 'Career' }], blockId: 'core',
        },
        {
          type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', style: 'gauge',
          max: { formula: threeNodes }, resetTo: { formula: threeNodes },
        },
        {
          type: 'computed', id: 'total', uid: 'main.total', label: 'Total', resultType: 'number', formula: threeNodes,
        },
      ],
    }] });

    expect(estimateStaticEvaluationSteps(template)).toBe(18);
    expect(validatePublishTemplate(template, { evaluationStepLimit: 18 }).ok).toBe(true);
    expect(validatePublishTemplate(template, { evaluationStepLimit: 17 }).issues).toEqual([{
      path: '$', message: 'Static evaluation step limit exceeded: 18 > 17',
    }]);
  });

  it('excludes list-row computed repetition pending the D-R3 decision', () => {
    const template = baseTemplate({
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [{
          type: 'list',
          id: 'items',
          uid: 'main.items',
          label: 'Items',
          itemFields: [{
            type: 'computed', id: 'cost', uid: 'items.cost', label: 'Cost', resultType: 'number', formula,
          }],
        }],
      }],
    });

    expect(estimateStaticEvaluationSteps(template)).toBe(0);
    expect(validatePublishTemplate(template, { evaluationStepLimit: 1 }).ok).toBe(true);
  });
});
