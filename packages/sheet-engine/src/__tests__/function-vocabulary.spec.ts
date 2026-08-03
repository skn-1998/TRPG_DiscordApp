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

const EXPECTED_KNOWN_FUNCTION_VALUES = [
  'ceil',
  'count',
  'floor',
  'if',
  'lookup',
  'max',
  'min',
  'round',
  'sum',
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
  // 下の it.each は production コーパスを自己参照するため、独立した正本コーパスとの集合等価で
  // 追加・削除・同数置換と design-v1.md の一覧 drift を可視化する。
  it('matches the exact design-v1 known-function corpus', () => {
    expect([...SHEET_KNOWN_FUNCTION_VALUES].sort()).toEqual(EXPECTED_KNOWN_FUNCTION_VALUES);
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
