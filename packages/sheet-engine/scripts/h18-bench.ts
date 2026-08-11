const { DEFAULT_STEP_LIMIT, estimateStaticEvaluationSteps, evaluateTemplate, validatePublishTemplate } = require('../dist');

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

function completesWithin(template, stepLimit) {
  try {
    evaluateTemplate(template, { evaluationStepLimit: stepLimit });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Evaluation step limit exceeded:')) return false;
    throw error;
  }
}

function measureEvaluationSteps(template) {
  if (completesWithin(template, 0)) return 0;
  let lower = 0, upper = DEFAULT_STEP_LIMIT;
  while (!completesWithin(template, upper)) upper *= 2;
  while (lower + 1 < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (completesWithin(template, middle)) upper = middle;
    else lower = middle;
  }
  return upper;
}

const cases = [
  ['pass just within', Math.floor(DEFAULT_STEP_LIMIT / 11)],
  ['reject just over', Math.floor(DEFAULT_STEP_LIMIT / 11) + 1],
  ['1,024 x 11 AST', 1_024],
];

console.table(cases.map(([name, fieldCount]) => {
  const template = computedTemplate(fieldCount);
  return {
    case: name, publish: validatePublishTemplate(template).ok ? 'pass' : 'reject',
    estimatedSteps: estimateStaticEvaluationSteps(template), measuredSteps: measureEvaluationSteps(template),
  };
}));
console.log('list ケース: D-R3 裁定待ちのため対象外（design-ledger §5-2）');
