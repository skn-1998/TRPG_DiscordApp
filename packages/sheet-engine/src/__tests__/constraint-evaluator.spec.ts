import {
  ConstraintEvaluationResult,
  ConstraintSource,
  evaluateAnnotationRuntime,
  evaluateConstraint,
  SheetTemplate,
} from '..';
import { baseTemplate } from './test-utils';

type ConstraintFixture = {
  name: string;
  template: SheetTemplate;
  rawValues: Record<string, unknown>;
  source?: ConstraintSource | null;
  sourceRaw?: 'Infinity';
  expected: ConstraintEvaluationResult;
};

const fixtures = jest.requireActual('../../fixtures/constraint-evaluation.json') as ConstraintFixture[];

function fixtureSource(fixture: ConstraintFixture): ConstraintSource | null | undefined {
  return fixture.sourceRaw === 'Infinity' ? Number.POSITIVE_INFINITY : fixture.source;
}

const aliasTemplate = baseTemplate({ sections: [{ id: 'section', label: 'Section', fields: [
  { type: 'scalar', id: 'score', uid: 'scalar-uid', label: 'Score', valueType: 'number' },
  { type: 'list', id: 'items', uid: 'list-uid', label: 'Items', itemFields: [
    { type: 'scalar', id: 'amount', uid: 'amount-uid', label: 'Amount', valueType: 'number' },
  ] },
] }] });
const scalarAliases = [
  { alias: 'uid', key: 'scalar-uid' },
  { alias: 'path', key: 'section.score' },
  { alias: 'id', key: 'score' },
];
const listAliases = [
  { alias: 'uid', key: 'list-uid' },
  { alias: 'path', key: 'section.items' },
  { alias: 'id', key: 'items' },
];
const rowAliases = [
  { alias: 'uid', key: 'amount-uid' },
  { alias: 'id', key: 'amount' },
];
const nullishAndPresent = [
  { input: 'null', value: null, expected: { status: 'indeterminate' } },
  { input: 'undefined', value: undefined, expected: { status: 'indeterminate' } },
  { input: 'present', value: 4, expected: { status: 'ok', value: 4 } },
];

describe('evaluateConstraint shared vectors', () => {
  it.each(fixtures)('$name', (fixture) => {
    expect(evaluateConstraint(fixtureSource(fixture), fixture.template, fixture.rawValues))
      .toEqual(fixture.expected);
  });

  it('is stable through a JSON serialization round trip', () => {
    expect(JSON.parse(JSON.stringify(fixtures))).toEqual(fixtures);
  });
});

describe('evaluateConstraint dependency closure boundaries', () => {
  it('BIG6-S3 treats an inherited-only boolean dependency as absent', () => {
    const template = baseTemplate({ sections: [{ id: 'status', label: 'Status', fields: [
      { type: 'scalar', id: 'enabled', uid: 'enabled-uid', label: 'Enabled', valueType: 'boolean' },
    ] }] });
    const rawValues = Object.create({ 'enabled-uid': true }) as Record<string, unknown>;

    expect(evaluateConstraint({ formula: 'if({status.enabled}, 1, 1 / 0)' }, template, rawValues))
      .toEqual({ status: 'error' });
  });

  it('BIG6-S3 lets an own path beat an inherited uid through constraint limits and warnings', () => {
    const max = { formula: '{main.source}' };
    const template = baseTemplate({ sections: [{ id: 'main', label: 'Main', fields: [
      { type: 'scalar', id: 'source', uid: 'source-uid', label: 'Source', valueType: 'number' },
      { type: 'scalar', id: 'target', uid: 'target-uid', label: 'Target', valueType: 'number', max },
    ] }] });
    const rawValues = Object.assign(Object.create({ 'source-uid': 100 }), {
      'main.source': 1,
      'main.target': 50,
    });

    expect(evaluateConstraint(max, template, rawValues)).toEqual({ status: 'ok', value: 1 });
    const annotations = evaluateAnnotationRuntime(template, rawValues);
    expect(annotations.sections[0].limits).toEqual([{
      sectionId: 'main', fieldUid: 'target-uid', origin: 'field', status: 'ok', limit: 1, displayValue: 50, over: true,
    }]);
    expect(annotations.warnings).toEqual([{
      code: 'field-over-limit', sectionId: 'main', fieldUid: 'target-uid', blockId: undefined,
    }]);
  });

  it.each(scalarAliases.flatMap(({ alias, key }) =>
    nullishAndPresent.map((testCase) => ({ alias, key, ...testCase }))))(
    'resolves distinct scalar $alias input with $input presence',
    ({ key, value, expected }) => {
      expect(evaluateConstraint({ formula: '{section.score}' }, aliasTemplate, { [key]: value }))
        .toEqual(expected);
    },
  );

  it.each(listAliases.flatMap(({ alias: listAlias, key: listKey }) =>
    rowAliases.flatMap(({ alias: rowAlias, key: rowKey }) =>
      nullishAndPresent.map((testCase) => ({ listAlias, listKey, rowAlias, rowKey, ...testCase })))))(
    'resolves distinct list $listAlias and row $rowAlias aliases with $input presence',
    ({ listKey, rowKey, value, expected }) => {
      expect(evaluateConstraint({ formula: 'sum({section.items.amount})' }, aliasTemplate, {
        [listKey]: [{ [rowKey]: value }],
      })).toEqual(expected);
    },
  );

  it.each(listAliases.flatMap(({ alias, key }) => nullishAndPresent.slice(0, 2).map(({ input, value }) => ({
    alias, key, input, value,
  }))))('allows a $input $alias list container as zero rows', ({ key, value }) => {
    expect(evaluateConstraint({ formula: 'sum({section.items.amount})' }, aliasTemplate, {
      [key]: value,
    })).toEqual({ status: 'ok', value: 0 });
  });

  it.each(listAliases)('keeps a null row under the $alias list alias indeterminate', ({ key }) => {
    expect(evaluateConstraint({ formula: 'sum({section.items.amount})' }, aliasTemplate, {
      [key]: [null],
    })).toEqual({ status: 'indeterminate' });
  });

  it('treats an inherited list container as zero rows like the shared evaluator', () => {
    const rawValues = Object.create({
      'list-uid': [{ 'amount-uid': 5 }],
    }) as Record<string, unknown>;

    expect(evaluateConstraint({ formula: 'sum({section.items.amount})' }, aliasTemplate, rawValues))
      .toEqual({ status: 'ok', value: 0 });
  });

  it('does not inspect missing rows in an inherited list container', () => {
    const rawValues = Object.create({ 'list-uid': [{}] }) as Record<string, unknown>;

    expect(evaluateConstraint({ formula: 'sum({section.items.amount})' }, aliasTemplate, rawValues))
      .toEqual({ status: 'ok', value: 0 });
  });

  it('keeps an inherited row subfield absent when the list container is own', () => {
    const row = Object.create({ 'amount-uid': 5 }) as Record<string, unknown>;

    expect(evaluateConstraint({ formula: 'sum({section.items.amount})' }, aliasTemplate, {
      'list-uid': [row],
    })).toEqual({ status: 'indeterminate' });
  });

  it('treats a scalar max self-reference as the current raw value without special handling', () => {
    const template = baseTemplate({ sections: [{ id: 'stats', label: 'Stats', fields: [
      {
        type: 'scalar', id: 'hp', uid: 'stats.hp', label: 'HP', valueType: 'number',
        max: { formula: '{stats.hp} + 5' },
      },
    ] }] });
    const source = template.sections[0].fields[0];
    if (source.type !== 'scalar' || typeof source.max !== 'object') throw new Error('invalid test setup');

    expect(evaluateConstraint(source.max, template, { 'stats.hp': 7 })).toEqual({ status: 'ok', value: 12 });
    expect(evaluateConstraint(source.max, template, {})).toEqual({ status: 'indeterminate' });
  });

  it('follows cross-section refs and sum(list subfield) row inputs', () => {
    const template = baseTemplate({ sections: [
      { id: 'stats', label: 'Stats', fields: [
        { type: 'scalar', id: 'bonus', uid: 'stats.bonus', label: 'Bonus', valueType: 'number' },
      ] },
      { id: 'inventory', label: 'Inventory', fields: [{
        type: 'list', id: 'items', uid: 'inventory.items', label: 'Items', itemFields: [
          { type: 'scalar', id: 'amount', uid: 'items.amount', label: 'Amount', valueType: 'number' },
        ],
      }] },
    ] });
    const source = { formula: '{stats.bonus} + sum({inventory.items.amount})' };

    expect(evaluateConstraint(source, template, {
      'stats.bonus': 2,
      'inventory.items': [{ amount: 3 }, { 'items.amount': 4 }],
    })).toEqual({ status: 'ok', value: 9 });
    expect(evaluateConstraint(source, template, {
      'stats.bonus': 2,
      'inventory.items': [{ amount: 3 }, {}],
    })).toEqual({ status: 'indeterminate' });
  });

  it('counts rows without requiring subfield values while sum still requires them', () => {
    const rows = [{ amount: 1 }, {}];
    expect(evaluateConstraint({ formula: 'count({section.items.amount})' }, aliasTemplate, {
      'list-uid': rows,
    })).toEqual({ status: 'ok', value: 2 });
    expect(evaluateConstraint({ formula: 'sum({section.items.amount})' }, aliasTemplate, {
      'list-uid': rows,
    })).toEqual({ status: 'indeterminate' });
    expect(evaluateConstraint({ formula: 'count({section.items.amount})' }, aliasTemplate, {
      'list-uid': [],
    })).toEqual({ status: 'ok', value: 0 });
  });

  it('requires track and number-scalar inputs independently', () => {
    const template = baseTemplate({ sections: [{ id: 'status', label: 'Status', fields: [
      { type: 'track', id: 'hp', uid: 'status.hp', label: 'HP', max: 10, style: 'gauge' },
      { type: 'scalar', id: 'bonus', uid: 'status.bonus', label: 'Bonus', valueType: 'number' },
    ] }] });
    const source = { formula: '{status.hp} + {status.bonus}' };

    expect(evaluateConstraint(source, template, { 'status.hp': 4, 'status.bonus': 2 }))
      .toEqual({ status: 'ok', value: 6 });
    expect(evaluateConstraint(source, template, { 'status.bonus': 2 }))
      .toEqual({ status: 'indeterminate' });
    expect(evaluateConstraint(source, template, { 'status.hp': 4 }))
      .toEqual({ status: 'indeterminate' });
  });

  it('keeps scalar max indeterminate when its referenced track has no new-sheet input', () => {
    const template = baseTemplate({ sections: [{ id: 'status', label: 'Status', fields: [
      { type: 'track', id: 'hp', uid: 'status.hp', label: 'HP', max: 10, style: 'gauge' },
      {
        type: 'scalar', id: 'mp', uid: 'status.mp', label: 'MP', valueType: 'number',
        max: { formula: '{status.hp}' },
      },
    ] }] });
    const field = template.sections[0].fields[1];
    if (field.type !== 'scalar' || typeof field.max !== 'object') throw new Error('invalid test setup');

    expect(evaluateConstraint(field.max, template, {})).toEqual({ status: 'indeterminate' });
  });

  it('follows row-scoped computed dependencies before summing', () => {
    const template = baseTemplate({ sections: [{ id: 'inventory', label: 'Inventory', fields: [{
      type: 'list', id: 'items', uid: 'inventory.items', label: 'Items', itemFields: [
        { type: 'scalar', id: 'amount', uid: 'items.amount', label: 'Amount', valueType: 'number' },
        {
          type: 'computed', id: 'double', uid: 'items.double', label: 'Double',
          resultType: 'number', formula: '{row.amount} * 2',
        },
      ],
    }] }] });
    const source = { formula: 'sum({inventory.items.double})' };

    expect(evaluateConstraint(source, template, { 'inventory.items': [{ amount: 2 }] }))
      .toEqual({ status: 'ok', value: 4 });
    expect(evaluateConstraint(source, template, { 'inventory.items': [{}] }))
      .toEqual({ status: 'indeterminate' });
  });

  it('stops mutually-referential computed fields with error', () => {
    const template = baseTemplate({ sections: [{ id: 'derived', label: 'Derived', fields: [
      { type: 'computed', id: 'a', uid: 'derived.a', label: 'A', resultType: 'number', formula: '{derived.b}' },
      { type: 'computed', id: 'b', uid: 'derived.b', label: 'B', resultType: 'number', formula: '{derived.a}' },
    ] }] });
    expect(evaluateConstraint({ formula: '{derived.a}' }, template, {})).toEqual({ status: 'error' });
  });

  it('keeps missing roll and boolean evaluator degradation rules', () => {
    const template = baseTemplate({ sections: [{ id: 'status', label: 'Status', fields: [
      { type: 'roll', id: 'attack', uid: 'status.attack', label: 'Attack', notation: '1d20' },
      { type: 'scalar', id: 'enabled', uid: 'status.enabled', label: 'Enabled', valueType: 'boolean' },
    ] }] });

    expect(evaluateConstraint({ formula: '{status.attack}' }, template, {})).toEqual({ status: 'error' });
    expect(evaluateConstraint({ formula: 'if({status.enabled}, 1, 2)' }, template, {}))
      .toEqual({ status: 'ok', value: 2 });
  });

  it('treats explicit empty parts as present', () => {
    const template = fixtures[0].template;
    expect(evaluateConstraint({ formula: '{stats.base}' }, template, {
      'stats.base': { parts: {} },
    })).toEqual({ status: 'ok', value: 0 });
  });

  it('returns indeterminate before a non-finite evaluation error', () => {
    const template = fixtures[0].template;
    expect(evaluateConstraint({ formula: '{stats.base} / 0' }, template, {}))
      .toEqual({ status: 'indeterminate' });
  });

  it('includes raw dependencies from the unselected if branch', () => {
    expect(evaluateConstraint({ formula: 'if(1, 5, {section.score})' }, aliasTemplate, {}))
      .toEqual({ status: 'indeterminate' });
  });

  it('maps non-finite results and the evaluator default step-limit failure to error', () => {
    expect(evaluateConstraint({ formula: '1 / 0' }, baseTemplate(), {})).toEqual({ status: 'error' });

    const terms = Array.from({ length: 100 }, () => '1').join(' + ');
    const fields = Array.from({ length: 60 }, (_, index) => ({
      type: 'computed' as const,
      id: `c${index}`,
      uid: `derived.c${index}`,
      label: `C${index}`,
      resultType: 'number' as const,
      formula: index === 0 ? terms : `{derived.c${index - 1}} + ${terms}`,
    }));
    const template = baseTemplate({ sections: [{ id: 'derived', label: 'Derived', fields }] });
    expect(evaluateConstraint({ formula: '{derived.c59}' }, template, {})).toEqual({ status: 'error' });
  });

  it.each([
    { source: Number.NaN, expected: { status: 'error' } },
    { source: Number.POSITIVE_INFINITY, expected: { status: 'error' } },
    { source: Number.NEGATIVE_INFINITY, expected: { status: 'error' } },
    { source: 1.25, expected: { status: 'ok', value: 1.25 } },
  ])('validates number literal source $source', ({ source, expected }) => {
    expect(evaluateConstraint(source, baseTemplate(), {})).toEqual(expected);
  });

  it.each([undefined, {}, { formula: 1 }, '1'])('maps invalid source %p to error', (source) => {
    expect(evaluateConstraint(source, baseTemplate(), {})).toEqual({ status: 'error' });
  });

  it('does not apply template rounding automatically', () => {
    const template = baseTemplate({ settings: { rounding: 'floor' } });
    expect(evaluateConstraint(1.9, template, {})).toEqual({ status: 'ok', value: 1.9 });
    expect(evaluateConstraint({ formula: '1.9' }, template, {})).toEqual({ status: 'ok', value: 1.9 });
    expect(evaluateConstraint({ formula: 'floor(1.9)' }, template, {})).toEqual({ status: 'ok', value: 1 });
  });

  it('does not evaluate computed fields outside the constraint closure', () => {
    const template = baseTemplate({ sections: [{ id: 'unrelated', label: 'Unrelated', fields: [{
      type: 'computed', id: 'broken', uid: 'unrelated.broken', label: 'Broken',
      resultType: 'number', formula: '{missing.field}',
    }] }] });
    expect(evaluateConstraint({ formula: '2' }, template, {})).toEqual({ status: 'ok', value: 2 });
  });
});
