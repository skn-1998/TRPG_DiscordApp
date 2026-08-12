/**
 * 注釈式（block cap / pool total / scalar max の ConstraintSource {formula}）1 本あたりの
 * 実 step を、publish が受理する範囲の最悪ケースで実測する。
 *
 * 合格基準 = 式 1 本 ≤ DEFAULT_STEP_LIMIT。D-R3（2026-08-12）裁定により注釈式は
 * evaluateConstraint 呼び出しごとに既定予算を独立に得る一方、publish の静的見積もり
 * （estimateStaticEvaluationSteps）は注釈式を加算しない。予算を与える側と静的に見積もる側で
 * 数える対象が違うため、超過は publish を通り抜けて runtime の status='error' としてだけ現れる。
 * この乖離を数値で押さえるのがこのベンチの目的。
 */
const { DEFAULT_AST_NODE_LIMIT, DEFAULT_STEP_LIMIT, estimateStaticEvaluationSteps, evaluateAnnotationRuntime, evaluateConstraint, evaluateExpression, validatePublishTemplate } = require('../dist');
const { LIST_ROW_LIMIT } = require('../dist/evaluator');

function benchTemplate(templateId, sections) {
  return {
    templateId, name: templateId, version: '1.0.0', schemaVersion: 3,
    tags: [], visibility: 'private', authorDiscordUserId: 'bench',
    settings: { rounding: 'floor' }, tables: [], sections,
  };
}

// 加算連鎖の AST node 数 = 2 × 項数 - 1。以下の定数はこの式から逆算した最大長で、
// 変更すると publish 受理（AST node ≤ 256 / 静的見積もり ≤ 10,000）を跨いで結果の意味が変わる。
function additiveChain(head, ones) {
  return [head, ...Array.from({ length: ones }, () => '1')].join(' + ');
}

// 19 node。行 computed は LIST_ROW_LIMIT 倍で見積もられるため、512 × 19 = 9,728 が
// 静的予算 10,000 に収まる最長の行式（20 node なら 10,240 で publish reject）。
const ROW_FORMULA = additiveChain('{row.amount}', 9);
// 255 node。DEFAULT_AST_NODE_LIMIT 直下まで使い切った section computed。
const SECTION_CHAIN_FORMULA = additiveChain('{main.seed}', 127);
// 17 node。255 + 17 + 9,728 = 10,000 ちょうどで静的見積もりを使い切るための埋め合わせ。
const SECTION_PAD_FORMULA = additiveChain('{main.seed}', 8);
// 256 node（DEFAULT_AST_NODE_LIMIT ちょうど）。この式自体は静的見積もりに一切加算されないため、
// 閉包コストが予算満杯の template ではそのまま超過分になる。
const WORST_ANNOTATION_FORMULA = additiveChain('{main.big} + sum({main.items.total}) + {main.pad}', 125);
// 45 閉包 × 201 node の深い computed 連鎖。constraint-evaluator.spec.ts の同型ベクタと突き合わせる。
const CHAIN_TERMS = Array.from({ length: 100 }, () => '1').join(' + ');
const CHAIN_DEPTH = 45;

function fullRows() {
  // 行 computed の実 step は「実際に読めた行数」で決まる。LIST_ROW_LIMIT を下回る入力では
  // 最悪ケースにならないため、amount を全行に置いて slice 上限まで埋める。
  // amount を欠くと evaluateConstraint が生入力欠落で indeterminate に落ち、評価自体が起きない。
  return Array.from({ length: LIST_ROW_LIMIT }, () => ({ amount: 1 }));
}

function poolSection(items, totalFormula) {
  return {
    id: 'main', label: 'Main',
    blocks: [{ id: 'core', label: 'Core' }],
    pools: [{ id: 'career', label: 'Career', total: { formula: totalFormula }, partsKey: 'career' }],
    fields: [
      // pool.partsKey は scope 内 field の宣言が publish 要件なので、budget を宣言元に置く。
      { type: 'scalar', id: 'budget', uid: 'main.budget', label: 'Budget', valueType: 'number', blockId: 'core', partsKeys: [{ id: 'career', label: 'Career' }] },
      { type: 'list', id: 'items', uid: 'main.items', label: 'Items', itemFields: items },
    ],
  };
}

const AMOUNT_FIELD = { type: 'scalar', id: 'amount', uid: 'items.amount', label: 'Amount', valueType: 'number' };
const ROW_TOTAL_FIELD = {
  type: 'computed', id: 'total', uid: 'items.total', label: 'Total', resultType: 'number', formula: ROW_FORMULA,
};

const rawRowSumTemplate = benchTemplate('bench-pool-raw', [poolSection([AMOUNT_FIELD], 'sum({main.items.amount})')]);
const computedRowSumTemplate = benchTemplate('bench-pool-computed', [
  poolSection([AMOUNT_FIELD, ROW_TOTAL_FIELD], 'sum({main.items.total})'),
]);

const chainTemplate = benchTemplate('bench-block-chain', [{
  id: 'derived', label: 'Derived',
  blocks: [{ id: 'chain', label: 'Chain', cap: { formula: `{derived.c${CHAIN_DEPTH - 1}}` } }],
  fields: [
    { type: 'scalar', id: 'focus', uid: 'derived.focus', label: 'Focus', valueType: 'number', blockId: 'chain' },
    ...Array.from({ length: CHAIN_DEPTH }, (_, index) => ({
      type: 'computed', id: `c${index}`, uid: `derived.c${index}`, label: `C${index}`, resultType: 'number',
      formula: index === 0 ? CHAIN_TERMS : `{derived.c${index - 1}} + ${CHAIN_TERMS}`,
    })),
  ],
}]);

const worstTemplate = benchTemplate('bench-scalar-max-worst', [{
  id: 'main', label: 'Main',
  fields: [
    { type: 'scalar', id: 'seed', uid: 'main.seed', label: 'Seed', valueType: 'number' },
    { type: 'computed', id: 'big', uid: 'main.big', label: 'Big', resultType: 'number', formula: SECTION_CHAIN_FORMULA },
    { type: 'computed', id: 'pad', uid: 'main.pad', label: 'Pad', resultType: 'number', formula: SECTION_PAD_FORMULA },
    { type: 'list', id: 'items', uid: 'main.items', label: 'Items', itemFields: [AMOUNT_FIELD, ROW_TOTAL_FIELD] },
    {
      type: 'scalar', id: 'cap_target', uid: 'main.cap_target', label: 'Cap', valueType: 'number',
      max: { formula: WORST_ANNOTATION_FORMULA },
    },
  ],
}]);

function completesWithin(template, formula, values, stepLimit) {
  try {
    evaluateExpression(template, formula, { values, evaluationStepLimit: stepLimit });
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Evaluation step limit exceeded:')) return false;
    throw error;
  }
}

/**
 * 注釈式 1 本の実 step を二分探索で確定する。
 *
 * evaluateConstraint は step limit を引数に取らない（既定予算固定）ため直接は測れない。
 * constraint-evaluator.ts:53 で evaluateConstraint が同じ evaluateExpression を呼んでおり、
 * 評価器も予算計上も共有するのでここでの実測値が注釈 1 本の実コストに一致する。
 *
 * 境界: evaluateConstraint は閉包で刈った template（buildEvaluationTemplate）を渡すのに対し
 * ここは template 全体を渡す。step を刻むのは computed の evalAst だけで scalar/track/roll/list 容器は
 * 0 step なので、「全 computed が注釈式の閉包に入っている」template に限り両者は同値。
 * 本ファイルの各 case はその条件を満たすよう構成してあり、閉包外の computed を足すと過大計上になる。
 */
function measureEvaluationSteps(template, formula, values) {
  if (completesWithin(template, formula, values, 0)) return 0;
  let lower = 0;
  let upper = DEFAULT_STEP_LIMIT;
  while (!completesWithin(template, formula, values, upper)) upper *= 2;
  while (lower + 1 < upper) {
    const middle = Math.floor((lower + upper) / 2);
    if (completesWithin(template, formula, values, middle)) upper = middle;
    else lower = middle;
  }
  return upper;
}

function summarizeAnnotationStatuses(runtime) {
  const entries = runtime.sections.flatMap((section) => [
    ...section.blocks.map((block) => `block.${block.blockId}=${block.status}`),
    ...section.pools.map((pool) => `pool.${pool.poolId}=${pool.status}`),
    ...section.limits.map((limit) => `limit.${limit.fieldUid}=${limit.status}`),
  ]);
  return entries.length === 0 ? 'none' : entries.join(' ');
}

function summarizeAnnotationWarnings(runtime) {
  const counts = new Map();
  for (const warning of runtime.warnings) counts.set(warning.code, (counts.get(warning.code) ?? 0) + 1);
  return counts.size === 0 ? 'none' : [...counts].map(([code, count]) => `${code}x${count}`).join(' ');
}

const cases = [
  {
    name: 'pool total: sum(512 raw rows)',
    template: rawRowSumTemplate,
    formula: 'sum({main.items.amount})',
    // consumed(600) > total(512 行 × 1) にして pool-over 警告経路も一緒に通す。
    // step 実測は total 式の評価だけで決まり consumed には依存しないので、計量は変わらない。
    values: { 'main.budget': { parts: { career: 600 } }, 'main.items': fullRows() },
  },
  {
    name: 'pool total: sum(512 rows x 19-node computed)',
    template: computedRowSumTemplate,
    formula: 'sum({main.items.total})',
    values: { 'main.budget': { parts: { career: 3 } }, 'main.items': fullRows() },
  },
  {
    name: `block cap: ${CHAIN_DEPTH}-deep computed chain`,
    template: chainTemplate,
    formula: `{derived.c${CHAIN_DEPTH - 1}}`,
    values: {},
  },
  {
    name: 'scalar max: 256-node formula over a full static budget',
    template: worstTemplate,
    formula: WORST_ANNOTATION_FORMULA,
    values: { 'main.seed': 1, 'main.cap_target': 2, 'main.items': fullRows() },
  },
];

console.log(`AST node limit=${DEFAULT_AST_NODE_LIMIT} / step budget=${DEFAULT_STEP_LIMIT} / LIST_ROW_LIMIT=${LIST_ROW_LIMIT}`);

const rows = cases.map(({ name, template, formula, values }) => {
  const measuredSteps = measureEvaluationSteps(template, formula, values);
  return {
    case: name,
    publish: validatePublishTemplate(template).ok ? 'pass' : 'reject',
    estimatedSteps: estimateStaticEvaluationSteps(template),
    measuredSteps,
    budget: DEFAULT_STEP_LIMIT,
    pass: measuredSteps <= DEFAULT_STEP_LIMIT ? 'pass' : 'OVER',
    // 予算超過が実際に注釈の表示結果を落とすことまで見るため、同じ入力で本番経路も呼ぶ。
    constraint: evaluateConstraint({ formula }, template, values).status,
  };
});
console.table(rows);

console.table(cases.map(({ name, template, values }) => {
  const startedAt = process.hrtime.bigint();
  const runtime = evaluateAnnotationRuntime(template, values);
  return {
    case: name,
    // 時間は環境依存の参考値で、判定には使わない（判定軸は step のみ）。
    ms: Number(process.hrtime.bigint() - startedAt) / 1e6,
    annotations: summarizeAnnotationStatuses(runtime),
    warnings: summarizeAnnotationWarnings(runtime),
  };
}));

const over = rows.filter((row) => row.pass === 'OVER');
// 超過は裁定材料として持ち帰る対象であり、ここで異常終了させると受入コマンドの出力が欠ける。
console.log(over.length === 0
  ? `all ${rows.length} cases within budget ${DEFAULT_STEP_LIMIT}`
  : `BUDGET VIOLATION: ${over.map((row) => `${row.case} = ${row.measuredSteps}`).join(' / ')}`);
