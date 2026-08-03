import {
  PublishIssue,
  SheetField,
  validateStandaloneRollNotations,
} from '..';
import { baseTemplate } from './test-utils';

const STANDALONE_ROLL_EXPRESSION_MAX_LENGTH = 256;
const STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT = 100;
const STANDALONE_ROLL_DIE_MAX_SIDES = 1_000;

function standaloneIssues(notation: string): PublishIssue[] {
  return validateStandaloneRollNotations(baseTemplate({
    sections: [
      {
        id: 'main',
        label: 'Main',
        fields: [{ type: 'roll', id: 'roll', uid: 'main.roll', label: 'Roll', notation }],
      },
    ],
  }));
}

describe('standalone roll expression syntax', () => {
  it.each([
    'd6',
    '2d6+1d4',
    '1d6+1d6+2',
    '2d6+1',
    '3d6*5',
    '(2d6+6)*5',
    '1d8{derived.db}',
  ])('accepts %s', (notation) => {
    expect(standaloneIssues(notation)).toEqual([]);
  });

  it.each([
    '',
    '   ',
    '10',
    '{derived.db}',
    '1d6/2',
    '1d6+',
    '1d6;drop',
    '1d6{}',
  ])('rejects %j', (notation) => {
    expect(standaloneIssues(notation)).not.toEqual([]);
  });

  it('enforces expression length, literal dice count, and die-side limits', () => {
    const atLengthLimit = `1d6${' '.repeat(STANDALONE_ROLL_EXPRESSION_MAX_LENGTH - 3)}`;

    expect(atLengthLimit).toHaveLength(STANDALONE_ROLL_EXPRESSION_MAX_LENGTH);
    expect(standaloneIssues(atLengthLimit)).toEqual([]);
    expect(standaloneIssues(`${atLengthLimit} `)).not.toEqual([]);
    expect(standaloneIssues(`${STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT}d6`)).toEqual([]);
    expect(standaloneIssues(`50d6+${STANDALONE_ROLL_LITERAL_DICE_MAX_COUNT - 49}d6`)).not.toEqual([]);
    expect(standaloneIssues(`d${STANDALONE_ROLL_DIE_MAX_SIDES}`)).toEqual([]);
    expect(standaloneIssues(`d${STANDALONE_ROLL_DIE_MAX_SIDES + 1}`)).not.toEqual([]);
  });
});

describe('standalone roll template validation', () => {
  it('reports top-level, list itemField, and relation attr RollField paths without inspecting roles', () => {
    // 現行 RelationField.attrs は ScalarField 限定だが、契約上必要な再帰走査を将来の型拡張前にも固定する。
    const relationWithRollAttr = {
      type: 'relation',
      id: 'owner',
      uid: 'main.owner',
      label: 'Owner',
      attrs: [
        {
          type: 'roll',
          id: 'luck',
          uid: 'owner.luck',
          label: 'Luck',
          notation: `1d${STANDALONE_ROLL_DIE_MAX_SIDES + 1}`,
        },
      ],
    } as unknown as SheetField;
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            { type: 'roll', id: 'constant', uid: 'main.constant', label: 'Constant', notation: '10' },
            {
              type: 'list',
              id: 'items',
              uid: 'main.items',
              label: 'Items',
              rowRole: { kind: 'rollable', notation: '10' },
              itemFields: [
                { type: 'roll', id: 'broken', uid: 'items.broken', label: 'Broken', notation: '1d6/' },
              ],
            },
            relationWithRollAttr,
            {
              type: 'scalar',
              id: 'role_only',
              uid: 'main.role_only',
              label: 'Role only',
              valueType: 'number',
              role: { kind: 'rollable', notation: '10' },
            },
          ],
        },
      ],
    });

    expect(validateStandaloneRollNotations(template)).toEqual([
      {
        path: 'main.constant.notation',
        message: 'standalone roll expression must contain at least one literal dice term',
      },
      { path: 'main.items.broken.notation', message: 'invalid standalone roll expression' },
      {
        path: 'main.owner.luck.notation',
        message: `die side limit exceeded: ${STANDALONE_ROLL_DIE_MAX_SIDES + 1} > ${STANDALONE_ROLL_DIE_MAX_SIDES}`,
      },
    ]);
  });

  it('reports the aggregate literal dice count rather than only checking each term', () => {
    const template = baseTemplate({
      sections: [
        {
          id: 'main',
          label: 'Main',
          fields: [
            {
              type: 'roll',
              id: 'many',
              uid: 'main.many',
              label: 'Many',
              notation: '50d6+51d6',
            },
          ],
        },
      ],
    });

    expect(validateStandaloneRollNotations(template)).toEqual([
      {
        path: 'main.many.notation',
        message: 'literal dice count limit exceeded: 101 > 100',
      },
    ]);
  });
});
