import { evaluateTemplate, interpolateNotation, SheetTemplate, validatePublishTemplate } from '..';

function baseTemplate(overrides: Partial<SheetTemplate> = {}): SheetTemplate {
  return {
    templateId: 'tpl',
    name: 'Template',
    version: '1.0.0',
    schemaVersion: 3,
    tags: [],
    visibility: 'private',
    authorDiscordUserId: 'author',
    settings: { rounding: 'floor' },
    tables: [],
    sections: [],
    ...overrides,
  };
}

describe('sheet-engine', () => {
  it('evaluates the CoC touchstone values and dice fragment lookup', () => {
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
            { type: 'computed', id: 'db', uid: 'derived.db', label: 'DB', resultType: 'dice', formula: "lookup('db_table', {abilities.str} + {abilities.siz})" },
            { type: 'computed', id: 'dex_half', uid: 'derived.dex_half', label: 'DEX Half', resultType: 'number', formula: 'floor({abilities.dex} / 2)' },
            { type: 'computed', id: 'dex_fifth', uid: 'derived.dex_fifth', label: 'DEX Fifth', resultType: 'number', formula: 'floor({abilities.dex} / 5)' },
            { type: 'computed', id: 'hp', uid: 'derived.hp', label: 'HP', resultType: 'number', formula: 'floor(({abilities.con} + {abilities.siz}) / 10)' },
            { type: 'computed', id: 'mov', uid: 'derived.mov', label: 'MOV', resultType: 'number', formula: 'if({abilities.dex} < {abilities.str}, 7, if({abilities.dex} > {abilities.str}, 9, 8))' },
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
    expect(evaluated.values['derived.dex_half']).toEqual({ type: 'number', value: 25 });
    expect(evaluated.values['derived.dex_fifth']).toEqual({ type: 'number', value: 10 });
    expect(evaluated.values['derived.hp']).toEqual({ type: 'number', value: 7 });
    expect(evaluated.values['derived.mov']).toEqual({ type: 'number', value: 7 });

    expect(
      interpolateNotation({
        template,
        evaluated,
        notation: '1d8{derived.db}',
      }).notation,
    ).toBe('1d8+1d4');
  });

  it('mixes row formulas, global references, sum/count, and 0/1 indicator columns', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'header',
          label: 'Header',
          fields: [{ type: 'scalar', id: 'prof_bonus', uid: 'header.prof_bonus', label: 'Prof', valueType: 'number' }],
        },
        {
          id: 'abilities',
          label: 'Abilities',
          fields: [{ type: 'scalar', id: 'str_mod', uid: 'abilities.str_mod', label: 'STR mod', valueType: 'number' }],
        },
        {
          id: 'inventory',
          label: 'Inventory',
          fields: [
            {
              type: 'list',
              id: 'gear',
              uid: 'inventory.gear',
              label: 'Gear',
              itemFields: [
                { type: 'scalar', id: 'name', uid: 'gear.name', label: 'Name', valueType: 'text' },
                { type: 'scalar', id: 'carried', uid: 'gear.carried', label: 'Carried', valueType: 'boolean' },
                { type: 'scalar', id: 'weight', uid: 'gear.weight', label: 'Weight', valueType: 'number' },
                { type: 'scalar', id: 'qty', uid: 'gear.qty', label: 'Qty', valueType: 'number' },
                { type: 'scalar', id: 'magic_bonus', uid: 'gear.magic_bonus', label: 'Magic', valueType: 'number' },
                { type: 'computed', id: 'atk_bonus', uid: 'gear.atk_bonus', label: 'Attack', resultType: 'number', formula: '{row.magic_bonus} + {abilities.str_mod} + {header.prof_bonus}' },
                { type: 'computed', id: 'eff_weight', uid: 'gear.eff_weight', label: 'Eff weight', resultType: 'number', formula: 'if({row.carried}, {row.weight} * {row.qty}, 0)' },
                { type: 'computed', id: 'carried_count', uid: 'gear.carried_count', label: 'Count', resultType: 'number', formula: 'if({row.carried}, 1, 0)' },
              ],
              rowRole: { kind: 'rollable', notation: '1d20{+row.atk_bonus}' },
            },
          ],
        },
        {
          id: 'totals',
          label: 'Totals',
          fields: [
            { type: 'computed', id: 'weight', uid: 'totals.weight', label: 'Weight', resultType: 'number', formula: 'sum({inventory.gear.eff_weight})' },
            { type: 'computed', id: 'carried', uid: 'totals.carried', label: 'Carried', resultType: 'number', formula: 'sum({inventory.gear.carried_count})' },
            { type: 'computed', id: 'rows', uid: 'totals.rows', label: 'Rows', resultType: 'number', formula: 'count({inventory.gear.weight})' },
          ],
        },
      ],
    });

    const evaluated = evaluateTemplate(template, {
      values: {
        'header.prof_bonus': 2,
        'abilities.str_mod': 3,
        'inventory.gear': [
          { name: 'Sword', carried: true, weight: 3, qty: 1, magic_bonus: 1 },
          { name: 'Chest', carried: false, weight: 10, qty: 1, magic_bonus: 0 },
        ],
      },
    });

    expect(evaluated.rows['inventory.gear'][0]['gear.atk_bonus']).toEqual({ type: 'number', value: 6 });
    expect(evaluated.values['totals.weight']).toEqual({ type: 'number', value: 3 });
    expect(evaluated.values['totals.carried']).toEqual({ type: 'number', value: 1 });
    expect(evaluated.values['totals.rows']).toEqual({ type: 'number', value: 2 });
    expect(evaluated.evaluationOrder.indexOf('inventory.gear.atk_bonus')).toBeLessThan(evaluated.evaluationOrder.indexOf('totals.weight'));
  });

  it('detects circular references during publish validation and evaluation', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'derived',
          label: 'Derived',
          fields: [
            { type: 'computed', id: 'a', uid: 'derived.a', label: 'A', resultType: 'number', formula: '{derived.b} + 1' },
            { type: 'computed', id: 'b', uid: 'derived.b', label: 'B', resultType: 'number', formula: '{derived.a} + 1' },
          ],
        },
      ],
    });

    expect(validatePublishTemplate(template).issues.map((issue) => issue.message)).toContain('Circular reference detected');
    expect(() => evaluateTemplate(template)).toThrow(/Circular reference/);
  });

  it('interpolates notation with signed refs, dice count positions, negative modifiers, and escaped braces', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'derived',
          label: 'Derived',
          fields: [
            { type: 'computed', id: 'mod', uid: 'derived.mod', label: 'Mod', resultType: 'number', formula: '-1' },
            { type: 'computed', id: 'n', uid: 'derived.n', label: 'N', resultType: 'number', formula: '3' },
            { type: 'computed', id: 'frag', uid: 'derived.frag', label: 'Frag', resultType: 'dice', formula: "'-1d4'" },
          ],
        },
      ],
    });
    const evaluated = evaluateTemplate(template);

    expect(interpolateNotation({ template, evaluated, notation: '1d20{+derived.mod}{derived.frag}' }).notation).toBe('1d20-1-1d4');
    expect(interpolateNotation({ template, evaluated, notation: '({derived.n})d10' }).notation).toBe('(3)d10');
    expect(interpolateNotation({ template, evaluated, notation: '{{kept}}+{derived.n}' }).notation).toBe('{kept}+3');
  });

  it('rejects unsupported publish cases', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'scalar', id: 'hidden', uid: 'main.hidden', label: 'Hidden', valueType: 'number', visibleTo: 'gm' },
            { type: 'scalar', id: 'gated', uid: 'main.gated', label: 'Gated', valueType: 'number', when: '{main.hidden} > 0' },
            { type: 'scalar', id: 'free_text', uid: 'main.free_text', label: 'Free', valueType: 'text', role: { kind: 'rollable', notation: '1d20+{value}' } },
            {
              type: 'list',
              id: 'rows',
              uid: 'main.rows',
              label: 'Rows',
              itemFields: [{ type: 'roll', id: 'rolled', uid: 'rows.rolled', label: 'Rolled', notation: '1d6' }],
            },
          ],
        },
      ],
    });
    const issues = validatePublishTemplate(template).issues.map((issue) => issue.message);

    expect(issues).toEqual(
      expect.arrayContaining([
        'visibleTo other than public is 未対応',
        'when is 未対応',
        'notation reference {value} must be number or validated fragment',
        'RollField in itemFields is not supported in v1',
      ]),
    );

    expect(validatePublishTemplate({ ...template, sections: [{ id: 'main', label: 'Main', fields: [{ type: 'mystery', id: 'x', uid: 'x', label: 'X' }] }] }).ok).toBe(false);
  });

  it('normalizes epsilon before floor/ceil and number comparisons', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'derived',
          label: 'Derived',
          fields: [
            { type: 'computed', id: 'floorish', uid: 'derived.floorish', label: 'Floorish', resultType: 'number', formula: 'floor(3 - 0.0000000005)' },
            { type: 'computed', id: 'ceilish', uid: 'derived.ceilish', label: 'Ceilish', resultType: 'number', formula: 'ceil(2 + 0.0000000005)' },
            { type: 'computed', id: 'cmp', uid: 'derived.cmp', label: 'Cmp', resultType: 'boolean', formula: '(0.1 + 0.2) <= 0.3000000005' },
          ],
        },
      ],
    });

    const evaluated = evaluateTemplate(template);
    expect(evaluated.values['derived.floorish']).toEqual({ type: 'number', value: 3 });
    expect(evaluated.values['derived.ceilish']).toEqual({ type: 'number', value: 2 });
    expect(evaluated.values['derived.cmp']).toEqual({ type: 'boolean', value: true });
  });
});
