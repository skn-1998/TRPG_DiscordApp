/**
 * Runtime annotation degradation, pool accounting, and effective limits stay deterministic for draft skew.
 * Assertions use the public package API and never depend on publish validation.
 */
import {
  AnnotationRuntimeResult,
  ScalarField,
  SheetSection,
  SheetTemplate,
  evaluateAnnotationRuntime,
} from '..';
import { baseTemplate } from './test-utils';

function numberField(overrides: Partial<ScalarField> = {}): ScalarField {
  return { type: 'scalar', id: 'skill', uid: 'skills.skill', label: 'Skill', valueType: 'number', ...overrides };
}

function skillsTemplate(overrides: Partial<SheetSection> = {}): SheetTemplate {
  return baseTemplate({ sections: [{ id: 'skills', label: 'Skills', fields: [numberField()], ...overrides }] });
}

type SkewCase = {
  name: string;
  template: SheetTemplate;
  rawValues?: Record<string, unknown>;
  observe: (result: AnnotationRuntimeResult) => unknown;
  expected: unknown;
  warnings: AnnotationRuntimeResult['warnings'];
};

const h10SkewCases: SkewCase[] = [
  {
    name: 'missing field.blockId becomes the default block',
    template: skillsTemplate({ fields: [numberField({ blockId: 'missing' })] }),
    observe: ({ sections }) => sections[0].fieldBlocks,
    expected: [{ fieldUid: 'skills.skill' }],
    warnings: [{ code: 'missing-field-block', sectionId: 'skills', blockId: 'missing', fieldUid: 'skills.skill' }],
  },
  {
    name: 'missing pool scope blocks are dropped while real blocks are consumed',
    template: skillsTemplate({
      blocks: [{ id: 'known', label: 'Known' }],
      pools: [{ id: 'career', label: 'Career', total: 10, partsKey: 'career', scope: ['known', 'missing'] }],
      fields: [numberField({ blockId: 'known', partsKeys: [{ id: 'career', label: 'Career' }] })],
    }),
    rawValues: { 'skills.skill': { parts: { career: 3 } } },
    observe: ({ sections }) => sections[0].pools,
    expected: [{ sectionId: 'skills', poolId: 'career', consumed: 3, status: 'ok', total: 10, remaining: 7, over: false }],
    warnings: [{ code: 'missing-pool-scope-block', sectionId: 'skills', poolId: 'career', blockId: 'missing' }],
  },
  {
    name: 'a pool without a declaring field consumes zero',
    template: skillsTemplate({
      pools: [{ id: 'career', label: 'Career', total: 10, partsKey: 'career' }],
      fields: [numberField({ partsKeys: [{ id: 'hobby', label: 'Hobby' }] })],
    }),
    rawValues: { 'skills.skill': { parts: { career: 9 } } },
    observe: ({ sections }) => sections[0].pools,
    expected: [{ sectionId: 'skills', poolId: 'career', consumed: 0, status: 'ok', total: 10, remaining: 10, over: false }],
    warnings: [{
      code: 'missing-pool-parts-key-declaration', sectionId: 'skills', poolId: 'career', partsKey: 'career',
    }],
  },
  {
    name: 'duplicate block, pool, and partsKey ids keep their first definitions',
    template: skillsTemplate({
      blocks: [{ id: 'combat', label: 'First', cap: 10 }, { id: 'combat', label: 'Second', cap: 1 }],
      pools: [
        { id: 'career', label: 'First', total: 10, partsKey: 'career' },
        { id: 'career', label: 'Second', total: 1, partsKey: 'career' },
      ],
      fields: [numberField({ blockId: 'combat', partsKeys: [
        { id: 'career', label: 'First' }, { id: 'career', label: 'Second' },
      ] })],
    }),
    rawValues: { 'skills.skill': { parts: { base: 2, career: 3 } } },
    observe: ({ sections }) => {
      const { blocks: _blocks, ...legacyRuntime } = sections[0];
      return legacyRuntime;
    },
    expected: {
      sectionId: 'skills', blockIds: ['combat'],
      fieldBlocks: [{ fieldUid: 'skills.skill', blockId: 'combat', displayValue: 5 }],
      pools: [{ sectionId: 'skills', poolId: 'career', consumed: 3, status: 'ok', total: 10, remaining: 7, over: false }],
      limits: [{
        sectionId: 'skills', fieldUid: 'skills.skill', blockId: 'combat', origin: 'block',
        status: 'ok', limit: 10, displayValue: 5, over: false,
      }],
    },
    warnings: [
      { code: 'duplicate-block-id', sectionId: 'skills', blockId: 'combat' },
      { code: 'duplicate-pool-id', sectionId: 'skills', poolId: 'career' },
      { code: 'duplicate-parts-key-id', sectionId: 'skills', fieldUid: 'skills.skill', partsKey: 'career' },
    ],
  },
];

describe('evaluateAnnotationRuntime H-10 degradation table', () => {
  it.each(h10SkewCases)('$name', ({ template, rawValues, observe, expected, warnings }) => {
    const result = evaluateAnnotationRuntime(template, rawValues);
    expect(observe(result)).toEqual(expected);
    expect(result.warnings).toEqual(warnings);
  });
});

describe('evaluateAnnotationRuntime field display values', () => {
  it.each([
    { name: 'plain number scalar', field: numberField(), raw: 7, expected: 7 },
    {
      name: 'declared and implicit parts including a negative part',
      field: numberField({ partsKeys: [{ id: 'career', label: 'Career' }, { id: 'penalty', label: 'Penalty' }] }),
      raw: { parts: { base: 10, career: 20, penalty: -4, other: 3 } },
      expected: 29,
    },
  ])('resolves $name', ({ field, raw, expected }) => {
    const result = evaluateAnnotationRuntime(skillsTemplate({ fields: [field] }), { [field.uid]: raw });

    expect(result.sections[0].fieldBlocks).toEqual([{ fieldUid: field.uid, displayValue: expected }]);
  });

  it.each([
    { name: 'missing own non-nullish raw value', raw: null },
    { name: 'invalid parts', raw: { parts: { base: 10, other: 'bad' } } },
  ])('omits displayValue for $name', ({ raw }) => {
    const result = evaluateAnnotationRuntime(skillsTemplate(), { 'skills.skill': raw });

    expect(result.sections[0].fieldBlocks).toEqual([{ fieldUid: 'skills.skill' }]);
  });

  it('does not add displayValue to non-number-scalar entries', () => {
    const template = skillsTemplate({ fields: [
      { type: 'scalar', id: 'text', uid: 'skills.text', label: 'Text', valueType: 'text' },
      { type: 'track', id: 'track', uid: 'skills.track', label: 'Track', max: 10, style: 'gauge' },
      { type: 'list', id: 'list', uid: 'skills.list', label: 'List', itemFields: [numberField()] },
    ] });
    const result = evaluateAnnotationRuntime(template, {
      'skills.text': 1, 'skills.track': 2, 'skills.list': { parts: { base: 3 } },
    });

    expect(result.sections[0].fieldBlocks).toEqual([
      { fieldUid: 'skills.text' }, { fieldUid: 'skills.track' }, { fieldUid: 'skills.list' },
    ]);
  });

  it('matches the existing limit displayValue for the same input', () => {
    const result = evaluateAnnotationRuntime(skillsTemplate({ fields: [numberField({ max: 30 })] }), {
      'skills.skill': { parts: { base: 10, career: 20, penalty: -4, other: 3 } },
    });
    const fieldDisplayValue = result.sections[0].fieldBlocks[0].displayValue;

    expect(fieldDisplayValue).toBe(29);
    expect(result.sections[0].limits).toEqual([{
      sectionId: 'skills', fieldUid: 'skills.skill', origin: 'field', status: 'ok',
      limit: 30, displayValue: fieldDisplayValue, over: false,
    }]);
  });
});

describe('evaluateAnnotationRuntime block caps', () => {
  it.each([
    {
      name: 'numeric cap', cap: 10, rawValues: {},
      expected: { sectionId: 'skills', blockId: 'capped', status: 'ok', cap: 10 },
    },
    {
      name: 'formula cap with its raw dependency', cap: { formula: '{skills.skill} * 2' },
      rawValues: { 'skills.skill': 20 },
      expected: { sectionId: 'skills', blockId: 'capped', status: 'ok', cap: 40 },
    },
    {
      name: 'invalid formula cap', cap: { formula: '1 / 0' }, rawValues: {},
      expected: { sectionId: 'skills', blockId: 'capped', status: 'error' },
    },
    {
      name: 'formula cap with a missing raw dependency', cap: { formula: '{skills.skill}' }, rawValues: {},
      expected: { sectionId: 'skills', blockId: 'capped', status: 'indeterminate' },
    },
  ])('resolves $name', ({ cap, rawValues, expected }) => {
    const result = evaluateAnnotationRuntime(skillsTemplate({
      blocks: [{ id: 'capped', label: 'Capped', cap }],
    }), rawValues);

    expect(result.sections[0].blocks).toEqual([expected]);
  });

  it('omits blocks without caps', () => {
    const result = evaluateAnnotationRuntime(skillsTemplate({ blocks: [{ id: 'plain', label: 'Plain' }] }));

    expect(result.sections[0].blocks).toEqual([]);
  });

  it('uses the first cap for duplicate block ids', () => {
    const result = evaluateAnnotationRuntime(skillsTemplate({ blocks: [
      { id: 'combat', label: 'First', cap: 10 }, { id: 'combat', label: 'Second', cap: 1 },
    ] }));

    expect(result.sections[0].blocks).toEqual([
      { sectionId: 'skills', blockId: 'combat', status: 'ok', cap: 10 },
    ]);
  });

  it('resolves a cap for a block without fields', () => {
    const result = evaluateAnnotationRuntime(skillsTemplate({
      blocks: [{ id: 'empty', label: 'Empty', cap: 99 }], fields: [],
    }));

    expect(result.sections[0].blocks).toEqual([
      { sectionId: 'skills', blockId: 'empty', status: 'ok', cap: 99 },
    ]);
  });
});

describe('evaluateAnnotationRuntime pools', () => {
  it('accounts for CoC career and hobby pools over the same skills, including negative parts', () => {
    const template = baseTemplate({ sections: [
      { id: 'skills', label: 'Skills', blocks: [{ id: 'group', label: 'Skills' }], fields: [
        numberField({ id: 'a', uid: 'skills.a', blockId: 'group', partsKeys: [
          { id: 'career', label: 'Career' }, { id: 'hobby', label: 'Hobby' },
        ] }),
        numberField({ id: 'b', uid: 'skills.b', partsKeys: [
          { id: 'career', label: 'Career' }, { id: 'hobby', label: 'Hobby' },
        ] }),
      ], pools: [
        { id: 'career', label: 'Career', total: { formula: '{stats.int} * 2' }, partsKey: 'career' },
        { id: 'hobby', label: 'Hobby', total: 20, partsKey: 'hobby' },
      ] },
      { id: 'stats', label: 'Stats', fields: [numberField({ id: 'int', uid: 'stats.int' })] },
    ] });
    const result = evaluateAnnotationRuntime(template, {
      'skills.a': { parts: { base: 10, career: 40, hobby: 10 } },
      'skills.b': { parts: { career: 25, hobby: -5 } },
      'stats.int': 30,
    });

    expect(result.sections[0].pools).toEqual([
      { sectionId: 'skills', poolId: 'career', consumed: 65, status: 'ok', total: 60, remaining: -5, over: true },
      { sectionId: 'skills', poolId: 'hobby', consumed: 5, status: 'ok', total: 20, remaining: 15, over: false },
    ]);
    expect(result.warnings).toEqual([{ code: 'pool-over', sectionId: 'skills', poolId: 'career' }]);
  });

  it('keeps empty scope empty and propagates indeterminate/error without remaining', () => {
    const template = baseTemplate({ sections: [
      { id: 'skills', label: 'Skills', fields: [numberField({ partsKeys: [{ id: 'career', label: 'Career' }] })], pools: [
        { id: 'empty', label: 'Empty', total: 10, partsKey: 'career', scope: [] },
        { id: 'pending', label: 'Pending', total: { formula: '{stats.base}' }, partsKey: 'career' },
        { id: 'broken', label: 'Broken', total: { formula: '1 / 0' }, partsKey: 'career' },
      ] },
      { id: 'stats', label: 'Stats', fields: [numberField({ id: 'base', uid: 'stats.base' })] },
    ] });
    const result = evaluateAnnotationRuntime(template, { 'skills.skill': { parts: { career: 2 } } });

    expect(result.sections[0].pools).toEqual([
      { sectionId: 'skills', poolId: 'empty', consumed: 0, status: 'ok', total: 10, remaining: 10, over: false },
      { sectionId: 'skills', poolId: 'pending', consumed: 2, status: 'indeterminate' },
      { sectionId: 'skills', poolId: 'broken', consumed: 2, status: 'error' },
    ]);
    expect(result.warnings).toEqual([{
      code: 'missing-pool-parts-key-declaration', sectionId: 'skills', poolId: 'empty', partsKey: 'career',
    }]);
  });

  it.each([{ value: 'bad' }, { value: Number.POSITIVE_INFINITY }])(
    'skips invalid declared value $value and excludes a matching parts:true free key',
    ({ value }) => {
      const template = skillsTemplate({
        pools: [{ id: 'career', label: 'Career', total: 10, partsKey: 'career' }],
        fields: [
          numberField({ partsKeys: [{ id: 'career', label: 'Career' }] }),
          numberField({ id: 'free', uid: 'skills.free', parts: true }),
        ],
      });
      const result = evaluateAnnotationRuntime(template, {
        'skills.skill': { parts: { career: value } }, 'skills.free': { parts: { career: 100 } },
      });

      expect(result.sections[0].pools[0]).toEqual({
        sectionId: 'skills', poolId: 'career', consumed: 0, status: 'ok', total: 10, remaining: 10, over: false,
      });
      expect(result.warnings).toEqual([]);
    },
  );

  it.each([
    { name: 'positive', value: Number.MAX_VALUE, warning: true },
    { name: 'negative', value: -Number.MAX_VALUE, warning: false },
  ])('skips a $name contribution that would overflow the accumulated pool total', ({ value, warning }) => {
    const template = skillsTemplate({
      pools: [{ id: 'career', label: 'Career', total: 0, partsKey: 'career' }],
      fields: [
        numberField({ id: 'a', uid: 'skills.a', partsKeys: [{ id: 'career', label: 'Career' }] }),
        numberField({ id: 'b', uid: 'skills.b', partsKeys: [{ id: 'career', label: 'Career' }] }),
      ],
    });
    const result = evaluateAnnotationRuntime(template, {
      'skills.a': { parts: { career: value } }, 'skills.b': { parts: { career: value } },
    });

    expect(result.sections[0].pools[0]).toEqual({
      sectionId: 'skills', poolId: 'career', consumed: value, status: 'ok', total: 0, remaining: -value,
      over: warning,
    });
    expect(result.warnings).toEqual(warning ? [{ code: 'pool-over', sectionId: 'skills', poolId: 'career' }] : []);
  });

  it('degrades a non-finite remaining value to error without emitting pool-over', () => {
    const template = skillsTemplate({
      pools: [{ id: 'career', label: 'Career', total: -Number.MAX_VALUE, partsKey: 'career' }],
      fields: [numberField({ partsKeys: [{ id: 'career', label: 'Career' }] })],
    });
    const result = evaluateAnnotationRuntime(template, {
      'skills.skill': { parts: { career: Number.MAX_VALUE } },
    });

    expect(result.sections[0].pools).toEqual([
      { sectionId: 'skills', poolId: 'career', consumed: Number.MAX_VALUE, status: 'error' },
    ]);
    expect(result.warnings).toEqual([]);
  });
});

describe('evaluateAnnotationRuntime effective limits', () => {
  it.each([
    { displayValue: 11, over: true, warnings: [
      { code: 'field-over-limit', sectionId: 'skills', fieldUid: 'skills.skill', blockId: undefined },
    ] },
    { displayValue: 10, over: false, warnings: [] },
  ])('marks display value $displayValue over a limit of 10 as $over', ({ displayValue, over, warnings }) => {
    const result = evaluateAnnotationRuntime(skillsTemplate({ fields: [numberField({ max: 10 })] }), {
      'skills.skill': displayValue,
    });

    expect(result.sections[0].limits).toEqual([{
      sectionId: 'skills', fieldUid: 'skills.skill', origin: 'field', status: 'ok', limit: 10, displayValue, over,
    }]);
    expect(result.warnings).toEqual(warnings);
  });

  it('uses each current section path when duplicate field UIDs appear in a draft', () => {
    const template = baseTemplate({ sections: [
      { id: 'first', label: 'First', fields: [numberField({ id: 'a', uid: 'dup', max: 0 })] },
      { id: 'second', label: 'Second', fields: [numberField({ id: 'b', uid: 'dup', max: 0 })] },
    ] });
    const result = evaluateAnnotationRuntime(template, { 'first.a': 1 });

    expect(result.sections[0].limits).toEqual([{
      sectionId: 'first', fieldUid: 'dup', origin: 'field', status: 'ok', limit: 0, displayValue: 1, over: true,
    }]);
    expect(result.warnings).toEqual([{
      code: 'field-over-limit', sectionId: 'first', fieldUid: 'dup', blockId: undefined,
    }]);
  });

  it('applies field max before block cap to parts display values and ignores nested annotations', () => {
    const template = baseTemplate({ sections: [
      { id: 'skills', label: 'Skills', blocks: [
        { id: 'core', label: 'Core', cap: 40 },
        { id: 'pending', label: 'Pending', cap: { formula: '{stats.base}' } },
        { id: 'broken', label: 'Broken', cap: { formula: '1 / 0' } },
      ], fields: [
        numberField({ id: 'override', uid: 'uid-override', blockId: 'core', max: 50 }),
        numberField({ id: 'capped', uid: 'uid-capped', blockId: 'core' }),
        numberField({ id: 'unentered', uid: 'uid-unentered', blockId: 'core' }),
        numberField({ id: 'pending', uid: 'uid-pending', blockId: 'pending' }),
        numberField({ id: 'broken', uid: 'uid-broken', blockId: 'broken' }),
        { type: 'list', id: 'list', uid: 'skills.list', label: 'List', itemFields: [
          numberField({ id: 'nested', uid: 'skills.list.nested', blockId: 'missing', max: 1 }),
        ] },
      ] },
      { id: 'stats', label: 'Stats', fields: [numberField({ id: 'base', uid: 'stats.base' })] },
    ] });
    const result = evaluateAnnotationRuntime(template, {
      'skills.override': { parts: { base: 30, bonus: 25 } }, capped: 41,
      'skills.unentered': null, 'uid-pending': 10, 'uid-broken': 10,
    });

    expect(result.sections[0].limits).toEqual([
      { sectionId: 'skills', fieldUid: 'uid-override', blockId: 'core', origin: 'field', status: 'ok', limit: 50, displayValue: 55, over: true },
      { sectionId: 'skills', fieldUid: 'uid-capped', blockId: 'core', origin: 'block', status: 'ok', limit: 40, displayValue: 41, over: true },
      { sectionId: 'skills', fieldUid: 'uid-unentered', blockId: 'core', origin: 'block', status: 'ok', limit: 40, over: false },
      { sectionId: 'skills', fieldUid: 'uid-pending', blockId: 'pending', origin: 'block', status: 'indeterminate' },
      { sectionId: 'skills', fieldUid: 'uid-broken', blockId: 'broken', origin: 'block', status: 'error' },
    ]);
    expect(result.warnings).toEqual([
      { code: 'field-over-limit', sectionId: 'skills', fieldUid: 'uid-override', blockId: 'core' },
      { code: 'field-over-limit', sectionId: 'skills', fieldUid: 'uid-capped', blockId: 'core' },
    ]);
  });

  it.each([
    { name: 'non-number part', raw: { parts: { career: 'x' } } },
    { name: 'non-finite part', raw: { parts: { career: Number.POSITIVE_INFINITY } } },
    { name: 'overflowing parts sum', raw: { parts: { left: Number.MAX_VALUE, right: Number.MAX_VALUE } } },
  ])('omits only the skewed display value for $name and continues later annotations', ({ raw }) => {
    const template = skillsTemplate({
      pools: [{ id: 'career', label: 'Career', total: 10, partsKey: 'career' }],
      fields: [
        numberField({ id: 'skewed', uid: 'skills.skewed', max: 10, partsKeys: [{ id: 'career', label: 'Career' }] }),
        numberField({ id: 'later', uid: 'skills.later', max: 10, partsKeys: [{ id: 'career', label: 'Career' }] }),
      ],
    });
    const result = evaluateAnnotationRuntime(template, {
      'skills.skewed': raw, 'skills.later': { parts: { base: 9, career: 3 } },
    });

    expect(result.sections[0].limits).toEqual([
      { sectionId: 'skills', fieldUid: 'skills.skewed', origin: 'field', status: 'ok', limit: 10, over: false },
      { sectionId: 'skills', fieldUid: 'skills.later', origin: 'field', status: 'ok', limit: 10, displayValue: 12, over: true },
    ]);
    expect([
      'displayValue' in result.sections[0].fieldBlocks[0],
      'displayValue' in result.sections[0].limits[0],
    ]).toEqual([false, false]);
    expect(result.sections[0].pools).toEqual([
      { sectionId: 'skills', poolId: 'career', consumed: 3, status: 'ok', total: 10, remaining: 7, over: false },
    ]);
    expect(result.warnings).toEqual([
      { code: 'field-over-limit', sectionId: 'skills', fieldUid: 'skills.later', blockId: undefined },
    ]);
  });
});
