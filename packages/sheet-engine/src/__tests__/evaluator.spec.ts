import { evaluateTemplate, validatePublishTemplate } from '..';
import { baseTemplate } from './test-utils';

describe('evaluator row formulas and aggregates', () => {
  const inventoryTemplate = baseTemplate({
    sections: [
      {
        id: 'main',
        label: 'Main',
        fields: [
          { type: 'scalar', id: 'bonus', uid: 'main.bonus', label: 'Bonus', valueType: 'number' },
          {
            type: 'list',
            id: 'items',
            uid: 'main.items',
            label: 'Items',
            itemFields: [
              { type: 'scalar', id: 'name', uid: 'items.name', label: 'Name', valueType: 'text' },
              { type: 'scalar', id: 'carried', uid: 'items.carried', label: 'Carried', valueType: 'boolean' },
              { type: 'scalar', id: 'weight', uid: 'items.weight', label: 'Weight', valueType: 'number' },
              { type: 'computed', id: 'line', uid: 'items.line', label: 'Line', resultType: 'number', formula: '{row.weight} + {main.bonus}' },
              { type: 'computed', id: 'is_carried', uid: 'items.is_carried', label: 'Is carried', resultType: 'number', formula: 'if({row.carried}, 1, 0)' },
            ],
          },
        ],
      },
      {
        id: 'totals',
        label: 'Totals',
        fields: [
          { type: 'computed', id: 'weight', uid: 'totals.weight', label: 'Weight', resultType: 'number', formula: 'sum({main.items.line})' },
          { type: 'computed', id: 'carried', uid: 'totals.carried', label: 'Carried', resultType: 'number', formula: 'sum({main.items.is_carried})' },
          { type: 'computed', id: 'rows', uid: 'totals.rows', label: 'Rows', resultType: 'number', formula: 'count({main.items.weight})' },
        ],
      },
    ],
  });

  it('mixes {row.subFieldId} and {sectionId.fieldId}, including computed row columns', () => {
    const evaluated = evaluateTemplate(inventoryTemplate, {
      values: {
        'main.bonus': 2,
        'main.items': [
          { name: 'Rope', carried: true, weight: 3 },
          { name: 'Chest', carried: false, weight: 10 },
        ],
      },
    });

    expect(evaluated.rows['main.items'][0]['items.line']).toEqual({ type: 'number', value: 5 });
    expect(evaluated.rows['main.items'][1]['items.line']).toEqual({ type: 'number', value: 12 });
    expect(evaluated.values['totals.weight']).toEqual({ type: 'number', value: 17 });
    expect(evaluated.values['totals.carried']).toEqual({ type: 'number', value: 1 });
    expect(evaluated.values['totals.rows']).toEqual({ type: 'number', value: 2 });
  });

  it('rejects external formulas that try to reference an individual row value', () => {
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
              itemFields: [{ type: 'scalar', id: 'weight', uid: 'items.weight', label: 'Weight', valueType: 'number' }],
            },
            { type: 'computed', id: 'bad', uid: 'main.bad', label: 'Bad', resultType: 'number', formula: '{row.weight} + 1' },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues.map((issue) => issue.message)).toContain('Row reference is not available: row.weight');
    expect(() => evaluateTemplate(template)).toThrow(/Row reference is not available/);
  });

  it('evaluates dependencies in topological order even when fields are declared in reverse order', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'derived',
          label: 'Derived',
          fields: [
            { type: 'computed', id: 'c', uid: 'derived.c', label: 'C', resultType: 'number', formula: '{derived.b} + 1' },
            { type: 'computed', id: 'b', uid: 'derived.b', label: 'B', resultType: 'number', formula: '{derived.a} + 1' },
            { type: 'computed', id: 'a', uid: 'derived.a', label: 'A', resultType: 'number', formula: '1' },
          ],
        },
      ],
    });

    const evaluated = evaluateTemplate(template);
    expect(evaluated.values['derived.c']).toEqual({ type: 'number', value: 3 });
    expect(evaluated.evaluationOrder).toEqual(['derived.a', 'derived.b', 'derived.c']);
  });

  it('treats track references as the current numeric value supplied by the caller', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', min: 0, max: 10, style: 'gauge' },
            { type: 'computed', id: 'boosted', uid: 'main.boosted', label: 'Boosted', resultType: 'number', formula: '{main.hp} + 2' },
          ],
        },
      ],
    });

    expect(evaluateTemplate(template, { values: { 'main.hp': 4 } }).values['main.boosted']).toEqual({ type: 'number', value: 6 });
  });
});

describe('evaluator aliased raw-value ownership', () => {
  const scalarTemplate = baseTemplate({
    sections: [{
      id: 'main',
      label: 'Main',
      fields: [{ type: 'scalar', id: 'score', uid: 'score-uid', label: 'Score', valueType: 'number' }],
    }],
  });
  const rowTemplate = baseTemplate({
    sections: [{
      id: 'main',
      label: 'Main',
      fields: [{
        type: 'list',
        id: 'items',
        uid: 'items-uid',
        label: 'Items',
        itemFields: [
          { type: 'scalar', id: 'amount', uid: 'amount-uid', label: 'Amount', valueType: 'number' },
        ],
      }],
    }],
  });

  it('intentionally ignores inherited aliases after BIG6-S3 introduced own-value checks', () => {
    const values = Object.create({ 'score-uid': 5 }) as Record<string, unknown>;

    expect(evaluateTemplate(scalarTemplate, { values }).values['score-uid'])
      .toEqual({ type: 'number', value: 0 });
  });

  it('ignores an inherited path alias after BIG6-S3 introduced own-value checks', () => {
    const values = Object.create({ 'main.score': 5 }) as Record<string, unknown>;

    expect(evaluateTemplate(scalarTemplate, { values }).values['score-uid'])
      .toEqual({ type: 'number', value: 0 });
  });

  it('uses a later own path instead of an earlier inherited uid after BIG6-S3', () => {
    const values = Object.assign(Object.create({ 'score-uid': 5 }), { 'main.score': 7 });

    expect(evaluateTemplate(scalarTemplate, { values }).values['score-uid'])
      .toEqual({ type: 'number', value: 7 });
  });

  it('ignores numeric properties added to Object.prototype during BIG6-S3 evaluation', () => {
    const key = 'score-uid';
    const originalDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, key);
    Object.defineProperty(Object.prototype, key, { configurable: true, value: 5, writable: true });

    try {
      expect(evaluateTemplate(scalarTemplate).values['score-uid'])
        .toEqual({ type: 'number', value: 0 });
    } finally {
      if (originalDescriptor === undefined) Reflect.deleteProperty(Object.prototype, key);
      else Object.defineProperty(Object.prototype, key, originalDescriptor);
    }
  });

  it.each([null, undefined])('skips an own nullish uid value %p and reads the next alias', (uidValue) => {
    expect(evaluateTemplate(scalarTemplate, {
      values: { 'score-uid': uidValue, 'main.score': 7, score: 9 },
    }).values['score-uid']).toEqual({ type: 'number', value: 7 });
  });

  it('keeps own non-nullish falsy values as first-win aliases', () => {
    const template = baseTemplate({
      sections: [{
        id: 'main',
        label: 'Main',
        fields: [
          { type: 'scalar', id: 'score', uid: 'score-uid', label: 'Score', valueType: 'number' },
          { type: 'scalar', id: 'name', uid: 'name-uid', label: 'Name', valueType: 'text' },
          { type: 'scalar', id: 'active', uid: 'active-uid', label: 'Active', valueType: 'boolean' },
        ],
      }],
    });
    const evaluated = evaluateTemplate(template, {
      values: {
        'score-uid': 0,
        'main.score': 1,
        'name-uid': '',
        'main.name': 'fallback',
        'active-uid': false,
        'main.active': true,
      },
    });

    expect(evaluated.values['score-uid']).toEqual({ type: 'number', value: 0 });
    expect(evaluated.values['name-uid']).toEqual({ type: 'text', value: '' });
    expect(evaluated.values['active-uid']).toEqual({ type: 'boolean', value: false });
  });

  it('intentionally ignores an inherited row alias after BIG6-S3 introduced own-value checks', () => {
    const inheritedRow = Object.create({ 'amount-uid': 5 }) as Record<string, unknown>;

    expect(evaluateTemplate(rowTemplate, { values: { 'items-uid': [inheritedRow] } }).rows['items-uid'][0]['amount-uid'])
      .toEqual({ type: 'number', value: 0 });
  });

  it('keeps the own row uid as first-win when the own id is also present', () => {
    const row = { 'amount-uid': 1, amount: 2 };

    expect(evaluateTemplate(rowTemplate, { values: { 'items-uid': [row] } }).rows['items-uid'][0]['amount-uid'])
      .toEqual({ type: 'number', value: 1 });
  });

  it('falls back from an own null row uid to a non-nullish own id', () => {
    const row = { 'amount-uid': null, amount: 2 };

    expect(evaluateTemplate(rowTemplate, { values: { 'items-uid': [row] } }).rows['items-uid'][0]['amount-uid'])
      .toEqual({ type: 'number', value: 2 });
  });
});

describe('evaluator cycle detection', () => {
  it('detects direct and indirect computed cycles', () => {
    const direct = baseTemplate({
      sections: [{ id: 'd', label: 'D', fields: [{ type: 'computed', id: 'a', uid: 'd.a', label: 'A', resultType: 'number', formula: '{d.a} + 1' }] }],
    });
    const indirect = baseTemplate({
      sections: [
        {
          id: 'd',
          label: 'D',
          fields: [
            { type: 'computed', id: 'a', uid: 'd.a', label: 'A', resultType: 'number', formula: '{d.b} + 1' },
            { type: 'computed', id: 'b', uid: 'd.b', label: 'B', resultType: 'number', formula: '{d.a} + 1' },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(direct).issues.map((issue) => issue.message)).toContain('Circular reference detected');
    expect(validatePublishTemplate(indirect).issues.map((issue) => issue.message)).toContain('Circular reference detected');
    expect(() => evaluateTemplate(direct)).toThrow(/Circular reference/);
    expect(() => evaluateTemplate(indirect)).toThrow(/Circular reference/);
  });

  it('detects row computed to aggregate to row computed reverse cycles', () => {
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
              itemFields: [{ type: 'computed', id: 'line', uid: 'items.line', label: 'Line', resultType: 'number', formula: '{totals.total} + 1' }],
            },
          ],
        },
        {
          id: 'totals',
          label: 'Totals',
          fields: [{ type: 'computed', id: 'total', uid: 'totals.total', label: 'Total', resultType: 'number', formula: 'sum({main.items.line})' }],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues.map((issue) => issue.message)).toContain('Circular reference detected');
    expect(() => evaluateTemplate(template, { values: { 'main.items': [{}] } })).toThrow(/Circular row reference/);
  });
});

describe('evaluator numeric typing and epsilon', () => {
  it('rejects dice arithmetic, heterogeneous equality, and text ordering during publish validation', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'n', uid: 'main.n', label: 'N', valueType: 'number' },
            { type: 'scalar', id: 'name', uid: 'main.name', label: 'Name', valueType: 'text' },
            { type: 'computed', id: 'frag', uid: 'main.frag', label: 'Frag', resultType: 'dice', formula: "'+1d4'" },
            { type: 'computed', id: 'bad_dice', uid: 'main.bad_dice', label: 'Bad dice', resultType: 'number', formula: '{main.frag} + 1' },
            { type: 'computed', id: 'bad_eq', uid: 'main.bad_eq', label: 'Bad eq', resultType: 'boolean', formula: '{main.n} == "1"' },
            { type: 'computed', id: 'bad_cmp', uid: 'main.bad_cmp', label: 'Bad cmp', resultType: 'boolean', formula: '{main.name} > 1' },
          ],
        },
      ],
    });

    const messages = validatePublishTemplate(template).issues.map((issue) => issue.message);
    expect(messages).toEqual(expect.arrayContaining([
      'Arithmetic requires number operands, got dice + number',
      'Equality requires same scalar types, got number == text',
      'Comparison requires number operands, got text > number',
    ]));
  });

  it('normalizes epsilon for floating comparison and just-before-integer floor', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'd',
          label: 'D',
          fields: [
            { type: 'computed', id: 'cmp', uid: 'd.cmp', label: 'Cmp', resultType: 'boolean', formula: '(0.1 + 0.2) == 0.3' },
            { type: 'computed', id: 'lte', uid: 'd.lte', label: 'Lte', resultType: 'boolean', formula: '(0.1 + 0.2) <= 0.3' },
            { type: 'computed', id: 'floorish', uid: 'd.floorish', label: 'Floorish', resultType: 'number', formula: 'floor(3 - 0.0000000005)' },
          ],
        },
      ],
    });

    const evaluated = evaluateTemplate(template);
    expect(evaluated.values['d.cmp']).toEqual({ type: 'boolean', value: true });
    expect(evaluated.values['d.lte']).toEqual({ type: 'boolean', value: true });
    expect(evaluated.values['d.floorish']).toEqual({ type: 'number', value: 3 });
  });
});
