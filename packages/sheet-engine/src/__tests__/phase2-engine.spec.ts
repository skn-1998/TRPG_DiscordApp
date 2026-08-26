import {
  buildValueInputSchema,
  evaluateTemplate,
  RESERVED_PARTS_KEY_IDS,
  UNSAFE_PARTS_KEYS,
  validatePublishTemplate,
} from '..';
import { baseTemplate } from './test-utils';

describe('parts-aware value resolution', () => {
  const template = baseTemplate({
    sections: [
      {
        id: 'main',
        label: 'Main',
        fields: [
          { type: 'scalar', id: 'score', uid: 'main.score', label: 'Score', valueType: 'number', parts: true },
          { type: 'track', id: 'hp', uid: 'main.hp', label: 'HP', min: 0, max: 10, style: 'gauge' },
          {
            type: 'computed',
            id: 'total',
            uid: 'main.total',
            label: 'Total',
            resultType: 'number',
            formula: '{main.score} + {main.hp}',
          },
        ],
      },
    ],
  });

  it('sums finite parts for scalar and track values without capping the track', () => {
    const evaluated = evaluateTemplate(template, {
      values: {
        'main.score': { parts: { base: 5, buff: 2, temp: -1 } },
        'main.hp': { parts: { base: 8, buff: 5 } },
      },
    });

    expect(evaluated.values['main.score']).toEqual({ type: 'number', value: 6 });
    expect(evaluated.values['main.hp']).toEqual({ type: 'number', value: 13 });
    expect(evaluated.values['main.total']).toEqual({ type: 'number', value: 19 });
  });

  it('keeps accepting plain numbers', () => {
    expect(evaluateTemplate(template, {
      values: { 'main.score': 4, 'main.hp': 3 },
    }).values['main.total']).toEqual({ type: 'number', value: 7 });
  });

  it.each([
    [{ parts: { base: Number.NaN } }, 'main.score', 'parts.base'],
    [{ parts: { base: Number.POSITIVE_INFINITY } }, 'main.hp', 'parts.base'],
    [{ parts: { base: '5' } }, 'main.score', 'parts.base'],
  ])('rejects invalid part values instead of coercing them to zero', (value, uid, partPath) => {
    expect(() => evaluateTemplate(template, { values: { [uid]: value } })).toThrow(
      `field ${uid} ${partPath} must be a finite number`,
    );
  });
});

describe('buildValueInputSchema', () => {
  const template = baseTemplate({
    sections: [
      {
        id: 'main',
        label: 'Main',
        fields: [
          { type: 'scalar', id: 'score', uid: 'uid_score', label: 'Score', valueType: 'number', parts: true },
          {
            type: 'scalar', id: 'declared', uid: 'uid_declared', label: 'Declared', valueType: 'number',
            partsKeys: [{ id: 'career', label: 'Career' }],
          },
          { type: 'scalar', id: 'plain', uid: 'uid_plain', label: 'Plain', valueType: 'number' },
          { type: 'scalar', id: 'name', uid: 'uid_name', label: 'Name', valueType: 'text' },
          { type: 'scalar', id: 'active', uid: 'uid_active', label: 'Active', valueType: 'boolean' },
          {
            type: 'scalar',
            id: 'rank',
            uid: 'uid_rank',
            label: 'Rank',
            valueType: 'select',
            options: [
              { label: 'A', value: 'a' },
              { label: 'B', value: 'b' },
            ],
          },
          { type: 'track', id: 'hp', uid: 'uid_hp', label: 'HP', max: 10, style: 'gauge' },
          {
            type: 'list', id: 'items', uid: 'uid_items', label: 'Items',
            itemFields: [{ type: 'scalar', id: 'name', uid: 'item_name', label: 'Name', valueType: 'text' }],
          },
          { type: 'computed', id: 'total', uid: 'uid_total', label: 'Total', resultType: 'number', formula: '1' },
        ],
      },
    ],
  });
  const schema = buildValueInputSchema(template);
  const coexistingDraftSchema = buildValueInputSchema(baseTemplate({
    sections: [{
      id: 'main',
      label: 'Main',
      fields: [{
        type: 'scalar', id: 'both', uid: 'uid_both', label: 'Both', valueType: 'number',
        parts: true, partsKeys: [{ id: 'career', label: 'Career' }],
      }],
    }],
  }));
  const unsafePartsVectors = [
    { mode: 'declared', inputSchema: schema, uid: 'uid_declared' },
    { mode: 'free', inputSchema: schema, uid: 'uid_score' },
    { mode: 'track', inputSchema: schema, uid: 'uid_hp' },
    { mode: 'coexisting draft', inputSchema: coexistingDraftSchema, uid: 'uid_both' },
  ].flatMap(({ mode, inputSchema, uid }) =>
    ['__proto__', 'constructor', 'prototype'].flatMap((key) => [
      { mode, inputSchema, uid, key, valueKind: 'number', partValue: 7 },
      { mode, inputSchema, uid, key, valueKind: 'non-number', partValue: 'x' },
    ]),
  );

  it('accepts field-matching scalar, parts, track, text, boolean, and select values', () => {
    expect(schema.safeParse({
      uid_score: { parts: { base: 5, buff: 2 } },
      uid_plain: 3,
      uid_name: 'Alice',
      uid_active: true,
      uid_rank: 'b',
      uid_hp: 8,
    }).success).toBe(true);
  });

  it('keeps rejecting non-array list values at the input boundary', () => {
    // Test intent: list 受理の追加後も、旧境界が拒否していた非配列値へ受理面を広げない。
    for (const value of [null, 1, 'row', { 0: { rowId: 'row-0' }, length: 1 }]) {
      expect(schema.safeParse({ uid_items: value }).success).toBe(false);
    }
  });

  it.each([
    ['uid_unknown', 1, 'field uid_unknown is not defined by the template'],
    ['uid_total', 1, 'field uid_total is not an input field (computed)'],
  ])('rejects unknown and computed field uids with the uid in the issue', (uid, value, message) => {
    const result = schema.safeParse({ [uid]: value });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: [uid], message }),
      ]));
    }
  });

  it('rejects values that do not match the field type or select options', () => {
    const result = schema.safeParse({ uid_name: 1, uid_active: 'true', uid_rank: 'c' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['uid_name', 'uid_active', 'uid_rank']),
      );
    }
  });

  it('rejects parts when the field definition does not enable them', () => {
    const result = schema.safeParse({ uid_plain: { parts: { base: 1 } } });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: ['uid_plain', 'parts'], message: 'field uid_plain does not allow parts' }),
      ]));
    }
  });

  it.each([
    ['declared keys plus base and other', 'uid_declared', { base: 1, other: 2, career: 3 }],
    ['an arbitrary key when parts is true', 'uid_score', { base: 1, custom: 2 }],
  ])('accepts %s', (_case, uid, parts) => {
    expect(schema.safeParse({ [uid]: { parts } }).success).toBe(true);
  });

  it('rejects an undeclared key in declaration mode', () => {
    const result = schema.safeParse({ uid_declared: { parts: { base: 1, career: 2, unknown: 3 } } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toContainEqual(expect.objectContaining({
        path: ['uid_declared', 'parts', 'unknown'],
        message: 'field uid_declared parts.unknown is not declared',
      }));
    }
  });

  it.each(unsafePartsVectors)(
    'rejects own $key with a $valueKind value in $mode parts mode using a key-level issue',
    ({ inputSchema, uid, key, partValue }) => {
      const parts = JSON.parse(`{"${key}":${JSON.stringify(partValue)}}`) as Record<string, unknown>;
      const result = inputSchema.safeParse({ [uid]: { parts } });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toContainEqual(expect.objectContaining({
          path: [uid, 'parts', key],
          message: `field ${uid} parts.${key} is reserved`,
        }));
        expect(result.error.issues.some((issue) => issue.message.includes('expected record'))).toBe(false);
      }
    },
  );

  it('rejects a JSON-parsed own __proto__ key that zod record parsing used to drop', () => {
    const parts = JSON.parse('{"__proto__":7}') as Record<string, unknown>;

    expect(Object.keys(parts)).toEqual(['__proto__']);
    expect(schema.safeParse({ uid_score: { parts } }).success).toBe(false);
  });

  it('checks finite sum across declaration-rejected own keys', () => {
    const max = Number.MAX_VALUE;
    const parts = JSON.parse(`{"__proto__":${max},"a":${max}}`) as Record<string, unknown>;
    const result = schema.safeParse({ uid_declared: { parts } });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ path: ['uid_declared', 'parts', '__proto__'] }),
        expect.objectContaining({ path: ['uid_declared', 'parts', 'a'] }),
        expect.objectContaining({
          path: ['uid_declared', 'parts'],
          message: 'field uid_declared parts sum must be finite',
        }),
      ]));
    }
  });

  it('keeps publish acceptance and declared-parts input acceptance aligned', () => {
    expect(validatePublishTemplate(template).ok).toBe(true);
    expect(schema.safeParse({ uid_declared: { parts: { base: 1, career: 2 } } }).success).toBe(true);
  });

  it('keeps publish and value-input acceptance aligned for declared, built-in, and unsafe parts keys', () => {
    const declaredIds = ['career', 'hobby', 'skill_bonus'];
    const publishedTemplate = baseTemplate({
      sections: [{
        id: 'matrix',
        label: 'Matrix',
        fields: [{
          type: 'scalar',
          id: 'score',
          uid: 'uid_matrix_score',
          label: 'Score',
          valueType: 'number',
          partsKeys: declaredIds.map((id) => ({ id, label: id })),
        }],
      }],
    });
    const publishResult = validatePublishTemplate(publishedTemplate);
    const publishedSchema = buildValueInputSchema(publishedTemplate);
    const rejectedAcceptedKeys = [...declaredIds, ...RESERVED_PARTS_KEY_IDS].filter((key) => {
      const parts = JSON.parse(`{"${key}":1}`) as Record<string, unknown>;
      return !publishedSchema.safeParse({ uid_matrix_score: { parts } }).success;
    });

    expect(publishResult.issues).toEqual([]);
    expect(rejectedAcceptedKeys).toEqual([]);

    const unsafeBoundaryResults = [...UNSAFE_PARTS_KEYS].map((id) => {
      const unsafeTemplate = baseTemplate({
        sections: [{
          id: 'matrix',
          label: 'Matrix',
          fields: [{
            type: 'scalar',
            id: 'score',
            uid: 'uid_matrix_score',
            label: 'Score',
            valueType: 'number',
            partsKeys: [{ id, label: 'Unsafe' }],
          }],
        }],
      });
      const publishIssues = validatePublishTemplate(unsafeTemplate).issues;
      const parts = JSON.parse(`{"${id}":1}`) as Record<string, unknown>;
      const inputResult = buildValueInputSchema(unsafeTemplate).safeParse({ uid_matrix_score: { parts } });

      return {
        id,
        publishRejected: publishIssues.some((issue) => issue.path === 'matrix.score.partsKeys.0.id'
          && issue.message === `partsKey id is reserved: ${id}`),
        inputRejected: !inputResult.success && inputResult.error.issues.some((issue) =>
          issue.path.join('.') === `uid_matrix_score.parts.${id}`
          && issue.message === `field uid_matrix_score parts.${id} is reserved`),
      };
    });

    expect(unsafeBoundaryResults).toEqual([...UNSAFE_PARTS_KEYS].map((id) => ({
      id,
      publishRejected: true,
      inputRejected: true,
    })));
  });

  it('rejects the same overflowing parts sum that the evaluator rejects', () => {
    const value = { parts: { left: Number.MAX_VALUE, right: Number.MAX_VALUE } };

    expect(schema.safeParse({ uid_score: value }).success).toBe(false);
    expect(() => evaluateTemplate(template, { values: { uid_score: value } }))
      .toThrow('field uid_score parts sum must be finite');
  });

  it.each([
    { base: 8, buff: 3 },
    { base: 1, damage: -2 },
  ])('accepts track parts totals outside numeric min/max as advisory: %o', (parts) => {
    expect(schema.safeParse({ uid_hp: { parts } }).success).toBe(true);
  });

  it('accepts track parts totals at numeric min/max', () => {
    expect(schema.safeParse({ uid_hp: { parts: { base: 10, buff: 0 } } }).success).toBe(true);
    expect(schema.safeParse({ uid_hp: { parts: { base: 1, damage: -1 } } }).success).toBe(true);
  });

  it('accepts formula max track totals without range enforcement at the input boundary', () => {
    const formulaMaxSchema = buildValueInputSchema(baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'limit', uid: 'uid_limit', label: 'Limit', valueType: 'number' },
            {
              type: 'track',
              id: 'hp',
              uid: 'uid_formula_hp',
              label: 'HP',
              max: { formula: '{main.limit}' },
              style: 'gauge',
            },
          ],
        },
      ],
    }));

    expect(formulaMaxSchema.safeParse({
      uid_limit: 10,
      uid_formula_hp: { parts: { base: 999 } },
    }).success).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects a non-finite parts value: %s',
    (invalid) => {
      const result = schema.safeParse({ uid_score: { parts: { base: invalid } } });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['uid_score', 'parts', 'base']);
      }
    },
  );
});
