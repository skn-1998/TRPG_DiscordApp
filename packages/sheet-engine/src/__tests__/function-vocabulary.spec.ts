import {
  evaluateTemplate,
  SHEET_KNOWN_FUNCTION_VALUES,
  SheetTemplate,
  validatePublishTemplate,
} from '..';
import { baseTemplate } from './test-utils';

const VALID_ARGUMENT_CANDIDATES = [
  '1',
  '1, 2',
  'true, 1, 0',
  '{main.items.value}',
  'numbers, 1',
] as const;

function functionTemplate(functionName: string, argumentsSource: string): SheetTemplate {
  return baseTemplate({
    tables: [{ id: 'numbers', resultType: 'number', rows: [[1, 10]] }],
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
              {
                type: 'scalar',
                id: 'value',
                uid: 'items.value',
                label: 'Value',
                valueType: 'number',
              },
            ],
          },
          {
            type: 'computed',
            id: 'result',
            uid: 'main.result',
            label: 'Result',
            resultType: 'number',
            formula: `${functionName}(${argumentsSource})`,
          },
        ],
      },
    ],
  });
}

function findValidArguments(functionName: string): string | undefined {
  return VALID_ARGUMENT_CANDIDATES.find((argumentsSource) =>
    validatePublishTemplate(functionTemplate(functionName, argumentsSource)).ok,
  );
}

describe('function vocabulary and arity equivalence', () => {
  // 下の it.each(SHEET_KNOWN_FUNCTION_VALUES) は語が減るとそのテスト行ごと消えて緑のままになる（コーパス自己参照の罠）ため、総数を固定して増減の両方向を可視化する。
  // 語彙を意図的に変えたときはこの数値を更新すること。
  it('pins the known-function corpus size so additions and removals both surface', () => {
    expect(SHEET_KNOWN_FUNCTION_VALUES).toHaveLength(9);
  });

  it.each(SHEET_KNOWN_FUNCTION_VALUES)('%s has a publish-valid call', (functionName) => {
    expect(findValidArguments(functionName)).toBeDefined();
  });

  it.each(SHEET_KNOWN_FUNCTION_VALUES)('%s has an evaluator implementation', (functionName) => {
    const validArguments = findValidArguments(functionName);

    expect(validArguments).toBeDefined();
    if (validArguments === undefined) return;

    expect(() => evaluateTemplate(functionTemplate(functionName, validArguments))).not.toThrow();
  });

  it.each(SHEET_KNOWN_FUNCTION_VALUES)('%s rejects the same invalid arity in publish and evaluate', (functionName) => {
    const validArguments = findValidArguments(functionName);

    expect(validArguments).toBeDefined();
    if (validArguments === undefined) return;

    const invalidArityTemplate = functionTemplate(functionName, `${validArguments}, 0`);
    const publishIssues = validatePublishTemplate(invalidArityTemplate).issues;

    expect(publishIssues).toContainEqual(expect.objectContaining({
      message: expect.stringMatching(new RegExp(`^${functionName} (?:expects \\d+ arguments|is a binary function)$`)),
    }));
    expect(() => evaluateTemplate(invalidArityTemplate)).toThrow(
      new RegExp(`^${functionName} expects \\d+ arguments$`),
    );
  });
});
