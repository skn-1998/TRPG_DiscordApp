const { DEFAULT_STEP_LIMIT, estimateStaticEvaluationSteps, evaluateTemplate, validatePublishTemplate } = require('../dist');
const { LIST_ROW_LIMIT } = require('../dist/evaluator');

const FORMULA = '1+1+1+1+1+1';

function computedTemplate(fieldCount) {
  return {
    templateId: `h18-${fieldCount}`, name: `H-18 ${fieldCount}`, version: '1.0.0', schemaVersion: 3,
    tags: [], visibility: 'private', authorDiscordUserId: 'bench',
    settings: { rounding: 'floor' }, tables: [],
    sections: [{
      id: 'main', label: 'Main',
      fields: Array.from({ length: fieldCount }, (_, index) => ({
        type: 'computed', id: `f_${index}`, uid: `main.f_${index}`,
        label: `F ${index}`, resultType: 'number', formula: FORMULA,
      })),
    }],
  };
}

function listTemplate() {
  return {
    templateId: 'h18-list', name: 'H-18 list', version: '1.0.0', schemaVersion: 3,
    tags: [], visibility: 'private', authorDiscordUserId: 'bench',
    settings: { rounding: 'floor' }, tables: [],
    sections: [{
      id: 'main', label: 'Main', fields: [{
        type: 'list', id: 'items', uid: 'main.items', label: 'Items', itemFields: [{
          type: 'computed', id: 'cost', uid: 'items.cost', label: 'Cost', resultType: 'number', formula: FORMULA,
        }],
      }],
    }],
  };
}

function completesWithin(template, input, stepLimit) {
  try {
    evaluateTemplate(template, { ...input, evaluationStepLimit: stepLimit });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Evaluation step limit exceeded:')) return false;
    throw error;
  }
}

function measureEvaluationSteps(template, input = {}) {
  if (completesWithin(template, input, 0)) return 0;
  let lower = 0, upper = DEFAULT_STEP_LIMIT;
  while (!completesWithin(template, input, upper)) upper *= 2;
  while (lower + 1 < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (completesWithin(template, input, middle)) upper = middle;
    else lower = middle;
  }
  return upper;
}

const cases = [
  ['pass just within', computedTemplate(Math.floor(DEFAULT_STEP_LIMIT / 11)), {}],
  ['reject just over', computedTemplate(Math.floor(DEFAULT_STEP_LIMIT / 11) + 1), {}],
  ['1,024 x 11 AST', computedTemplate(1_024), {}],
  [`${LIST_ROW_LIMIT}-row list x 11 AST`, listTemplate(), {
    values: { 'main.items': Array.from({ length: LIST_ROW_LIMIT }, () => ({})) },
  }],
];

console.log('D-R3 裁定後: LIST_ROW_LIMIT × 行項を list ケースで実測する。');
console.table(cases.map(([name, template, input]) => {
  return {
    case: name, publish: validatePublishTemplate(template).ok ? 'pass' : 'reject',
    estimatedSteps: estimateStaticEvaluationSteps(template), measuredSteps: measureEvaluationSteps(template, input),
  };
}));
