import { AstNode, countAstNodes } from './ast';
import { parseExpression } from './parser';
import { buildTemplateIndex, isComputedField, refKey, resolveRefPath, TemplateIndex } from './template-index';
import {
  EvaluationInput,
  EvaluationResult,
  ListField,
  LookupRow,
  RuntimeValue,
  RuntimeValueInput,
  SheetField,
  SheetTemplate,
} from './types';

const DEFAULT_AST_NODE_LIMIT = 256;
const DEFAULT_STEP_LIMIT = 10_000;
export const EPSILON = 1e-9;

type RowState = {
  list: ListField;
  raw: Record<string, unknown>;
  values: Record<string, RuntimeValue>;
  evaluating: Set<string>;
};

type EvalState = {
  template: SheetTemplate;
  index: TemplateIndex;
  input: Record<string, unknown>;
  values: Record<string, RuntimeValue>;
  rows: Record<string, RowState[]>;
  evaluating: Set<string>;
  evaluated: Set<string>;
  order: string[];
  refs: Map<string, ReturnType<typeof resolveRefPath>>;
  steps: number;
  astNodeLimit: number;
  stepLimit: number;
};

export function evaluateTemplate(template: SheetTemplate, input: EvaluationInput = {}): EvaluationResult {
  const index = buildTemplateIndex(template);
  const state: EvalState = {
    template,
    index,
    input: input.values ?? {},
    values: {},
    rows: {},
    evaluating: new Set(),
    evaluated: new Set(),
    order: [],
    refs: new Map(),
    steps: 0,
    astNodeLimit: input.astNodeLimit ?? DEFAULT_AST_NODE_LIMIT,
    stepLimit: input.evaluationStepLimit ?? DEFAULT_STEP_LIMIT,
  };

  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.type === 'list') {
        state.rows[field.uid] = readListRows(state, field);
      } else if (!isComputedField(field)) {
        state.values[field.uid] = readFieldValue(state, field);
      }
    }
  }

  for (const listRows of Object.values(state.rows)) {
    for (const row of listRows) {
      for (const field of row.list.itemFields) {
        if (field.type === 'computed') {
          evaluateRowField(state, row, field.uid);
        }
      }
    }
  }

  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.type === 'computed') {
        evaluateGlobalComputed(state, field.uid);
      }
    }
  }

  return {
    values: state.values,
    rows: Object.fromEntries(
      Object.entries(state.rows).map(([listUid, rows]) => [listUid, rows.map((row) => row.values)]),
    ),
    evaluationOrder: state.order,
    resolvedRefs: Array.from(state.refs.values()),
  };
}

export function evaluateExpression(
  template: SheetTemplate,
  formula: string,
  input: EvaluationInput = {},
): RuntimeValue {
  const result = evaluateTemplate(
    {
      ...template,
      sections: [
        ...template.sections,
        {
          id: '__eval',
          label: 'eval',
          fields: [{ type: 'computed', id: 'value', uid: '__eval.value', label: 'value', resultType: 'number', formula }],
        },
      ],
    },
    input,
  );
  return result.values['__eval.value'];
}

function readListRows(state: EvalState, list: ListField): RowState[] {
  const raw = readRaw(state, list);
  const rows = Array.isArray(raw) ? raw : [];
  return rows.map((row) => {
    const rawRow = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    const rowState: RowState = { list, raw: rawRow, values: {}, evaluating: new Set() };
    for (const field of list.itemFields) {
      if (field.type !== 'computed') {
        rowState.values[field.uid] = readRowFieldValue(field, rawRow);
      }
    }
    return rowState;
  });
}

function readFieldValue(state: EvalState, field: SheetField): RuntimeValue {
  return coerceFieldValue(field, readRaw(state, field));
}

function readRowFieldValue(field: SheetField, rawRow: Record<string, unknown>): RuntimeValue {
  const raw = rawRow[field.uid] ?? rawRow[field.id];
  return coerceFieldValue(field, raw);
}

function readRaw(state: EvalState, field: SheetField): unknown {
  const locator = state.index.fieldsByUid.get(field.uid);
  return state.input[field.uid] ?? (locator ? state.input[locator.path] : undefined) ?? state.input[field.id];
}

function coerceFieldValue(field: SheetField, raw: unknown): RuntimeValue {
  if (field.type === 'scalar') {
    if (field.valueType === 'number') {
      return { type: 'number', value: resolveNumberValue(field.uid, raw) };
    }
    if (field.valueType === 'boolean') {
      return { type: 'boolean', value: Boolean(raw) };
    }
    return { type: 'text', value: raw == null ? '' : String(raw) };
  }
  if (field.type === 'track') {
    const min = field.min ?? 0;
    const max = typeof field.max === 'number' ? field.max : Number.POSITIVE_INFINITY;
    return { type: 'number', value: Math.min(max, Math.max(min, resolveNumberValue(field.uid, raw))) };
  }
  if (field.type === 'roll') {
    if (typeof raw === 'number') {
      return { type: 'number', value: raw };
    }
    return { type: 'dice', value: raw == null ? field.notation : String(raw) };
  }
  if (field.type === 'relation' || field.type === 'tag') {
    return { type: 'text', value: raw == null ? '' : String(raw) };
  }
  if (field.type === 'list') {
    return { type: 'text', value: '' };
  }
  return { type: 'text', value: raw == null ? '' : String(raw) };
}

function evaluateGlobalComputed(state: EvalState, uid: string): RuntimeValue {
  if (state.values[uid]) {
    return state.values[uid];
  }
  if (state.evaluating.has(uid)) {
    throw new Error(`Circular reference detected at ${uid}`);
  }
  const locator = state.index.fieldsByUid.get(uid);
  if (!locator || locator.field.type !== 'computed') {
    throw new Error(`Unknown computed field ${uid}`);
  }

  state.evaluating.add(uid);
  const ast = parseChecked(locator.field.formula, state.astNodeLimit);
  const value = castResult(locator.field.resultType, evalAst(state, ast));
  state.values[uid] = value;
  state.evaluating.delete(uid);
  state.evaluated.add(uid);
  state.order.push(locator.path);
  return value;
}

function evaluateRowField(state: EvalState, row: RowState, uid: string): RuntimeValue {
  if (row.values[uid]) {
    return row.values[uid];
  }
  if (row.evaluating.has(uid)) {
    throw new Error(`Circular row reference detected at ${uid}`);
  }
  const field = row.list.itemFields.find((item) => item.uid === uid);
  if (!field || field.type !== 'computed') {
    throw new Error(`Unknown row computed field ${uid}`);
  }

  row.evaluating.add(uid);
  const ast = parseChecked(field.formula, state.astNodeLimit);
  const value = castResult(field.resultType, evalAst(state, ast, row));
  row.values[uid] = value;
  row.evaluating.delete(uid);
  state.order.push(`${row.list.uid}.${field.id}`);
  return value;
}

function parseChecked(formula: string, limit: number): AstNode {
  const ast = parseExpression(formula);
  if (countAstNodes(ast) > limit) {
    throw new Error(`AST node limit exceeded: ${countAstNodes(ast)} > ${limit}`);
  }
  return ast;
}

function evalAst(state: EvalState, node: AstNode, row?: RowState): RuntimeValue {
  state.steps += 1;
  if (state.steps > state.stepLimit) {
    throw new Error(`Evaluation step limit exceeded: ${state.stepLimit}`);
  }

  switch (node.type) {
    case 'number':
      return { type: 'number', value: node.value };
    case 'string':
      return { type: 'text', value: node.value };
    case 'boolean':
      return { type: 'boolean', value: node.value };
    case 'tableName':
      return { type: 'text', value: node.name };
    case 'ref':
      return evaluateRef(state, node.path, row);
    case 'unary': {
      const value = expectNumber(evalAst(state, node.argument, row));
      return { type: 'number', value: node.operator === '-' ? -value : value };
    }
    case 'binary':
      return evalBinary(state, node, row);
    case 'call':
      return evalCall(state, node, row);
  }
}

function evaluateRef(state: EvalState, path: string, row?: RowState): RuntimeValue {
  const ref = resolveRefPath(state.index, path, row?.list);
  state.refs.set(refKey(ref), ref);

  if (ref.kind === 'listSubField') {
    throw new Error(`List subfield reference must be used through sum/count: ${path}`);
  }

  if (path.startsWith('row.')) {
    if (!row) {
      throw new Error(`Row reference outside list row: ${path}`);
    }
    const sub = row.list.itemFields.find((field) => field.uid === ref.uid);
    if (sub?.type === 'computed') {
      return evaluateRowField(state, row, sub.uid);
    }
    const value = row.values[ref.uid];
    if (!value) {
      throw new Error(`Missing row value for ${path}`);
    }
    return value;
  }

  const locator = state.index.fieldsByUid.get(ref.uid);
  if (locator?.field.type === 'computed') {
    return evaluateGlobalComputed(state, ref.uid);
  }
  const value = state.values[ref.uid];
  if (!value) {
    throw new Error(`Missing value for ${path}`);
  }
  return value;
}

function evalBinary(state: EvalState, node: Extract<AstNode, { type: 'binary' }>, row?: RowState): RuntimeValue {
  const left = evalAst(state, node.left, row);
  const right = evalAst(state, node.right, row);

  if (['+', '-', '*', '/'].includes(node.operator)) {
    return { type: 'number', value: arithmetic(node.operator, expectNumber(left), expectNumber(right)) };
  }

  if (node.operator === '==' || node.operator === '!=') {
    if (left.type !== right.type || left.type === 'dice') {
      throw new Error(`Equality requires same scalar types: ${left.type} ${node.operator} ${right.type}`);
    }
    const equal =
      left.type === 'number'
        ? numbersEqual(Number(left.value), Number(right.value))
        : left.value === right.value;
    return { type: 'boolean', value: node.operator === '==' ? equal : !equal };
  }

  return {
    type: 'boolean',
    value: compareNumbers(node.operator, expectNumber(left), expectNumber(right)),
  };
}

function evalCall(state: EvalState, node: Extract<AstNode, { type: 'call' }>, row?: RowState): RuntimeValue {
  const name = node.name;
  if (name === 'if') {
    assertArity(name, node.args, 3);
    return evalAst(state, node.args[0], row).value
      ? evalAst(state, node.args[1], row)
      : evalAst(state, node.args[2], row);
  }
  if (name === 'sum' || name === 'count') {
    assertArity(name, node.args, 1);
    const refNode = node.args[0];
    if (refNode.type !== 'ref') {
      throw new Error(`${name} expects a list subfield reference`);
    }
    return aggregateList(state, name, refNode.path);
  }
  if (name === 'lookup') {
    assertArity(name, node.args, 2);
    const first = evalAst(state, node.args[0], row);
    const second = evalAst(state, node.args[1], row);
    return lookup(state, first, second);
  }

  const args = node.args.map((arg) => evalAst(state, arg, row));
  if (name === 'floor') {
    assertArity(name, args, 1);
    return { type: 'number', value: Math.floor(normalizeEpsilon(expectNumber(args[0]))) };
  }
  if (name === 'ceil') {
    assertArity(name, args, 1);
    return { type: 'number', value: Math.ceil(normalizeEpsilon(expectNumber(args[0]))) };
  }
  if (name === 'round') {
    assertArity(name, args, 1);
    return { type: 'number', value: Math.round(normalizeEpsilon(expectNumber(args[0]))) };
  }
  if (name === 'max' || name === 'min') {
    assertArity(name, args, 2);
    const values = args.map(expectNumber);
    return { type: 'number', value: name === 'max' ? Math.max(values[0], values[1]) : Math.min(values[0], values[1]) };
  }

  throw new Error(`Unknown function: ${name}`);
}

function aggregateList(state: EvalState, name: string, path: string): RuntimeValue {
  const ref = resolveRefPath(state.index, path);
  if (ref.kind !== 'listSubField') {
    throw new Error(`${name} expects a list subfield reference`);
  }
  state.refs.set(refKey(ref), ref);
  const rows = state.rows[ref.listUid] ?? [];
  if (name === 'count') {
    return { type: 'number', value: rows.length };
  }
  let total = 0;
  for (const row of rows) {
    const field = row.list.itemFields.find((item) => item.uid === ref.subFieldUid);
    if (!field) {
      throw new Error(`Unknown list subfield: ${path}`);
    }
    const value = field.type === 'computed' ? evaluateRowField(state, row, field.uid) : row.values[field.uid];
    total += expectNumber(value);
  }
  return { type: 'number', value: total };
}

function lookup(state: EvalState, first: RuntimeValue, second: RuntimeValue): RuntimeValue {
  const firstTable = first.type === 'text' ? state.index.tablesById.get(String(first.value)) : undefined;
  const secondTable = second.type === 'text' ? state.index.tablesById.get(String(second.value)) : undefined;
  const table = firstTable ?? secondTable;
  const key = firstTable ? second : first;
  if (!table) {
    throw new Error('lookup requires one table id argument');
  }

  for (const row of table.rows) {
    const match = lookupRowMatches(row, key);
    if (!match.ok) {
      continue;
    }
    return coerceRuntime(match.result, match.resultType ?? table.resultType ?? inferRuntimeType(match.result));
  }
  throw new Error(`lookup did not match table ${table.id}`);
}

function lookupRowMatches(row: LookupRow, key: RuntimeValue): { ok: boolean; result: RuntimeValueInput; resultType?: string } {
  if (Array.isArray(row)) {
    if (row.length === 2) {
      return { ok: key.value === row[0], result: row[1] };
    }
    const numeric = expectNumber(key);
    return { ok: numeric >= row[0] && numeric <= row[1], result: row[2] };
  }
  if ('key' in row) {
    return { ok: key.value === row.key, result: row.result, resultType: row.resultType };
  }
  const numeric = expectNumber(key);
  return { ok: numeric >= row.min && numeric <= row.max, result: row.result, resultType: row.resultType };
}

function castResult(type: string, value: RuntimeValue): RuntimeValue {
  if (type === 'number') {
    return { type: 'number', value: expectNumber(value) };
  }
  if (type === 'boolean') {
    if (value.type !== 'boolean') {
      throw new Error(`Expected boolean result, got ${value.type}`);
    }
    return value;
  }
  if (type === 'dice') {
    if (value.type !== 'dice' && value.type !== 'text') {
      throw new Error(`Expected dice fragment result, got ${value.type}`);
    }
    return { type: 'dice', value: String(value.value) };
  }
  if (value.type === 'dice') {
    throw new Error('Dice value cannot be cast to text');
  }
  return { type: 'text', value: String(value.value) };
}

function coerceRuntime(value: RuntimeValueInput, type: string): RuntimeValue {
  if (typeof value === 'object' && value !== null && 'type' in value) {
    return value as RuntimeValue;
  }
  if (type === 'number') {
    return { type: 'number', value: numberOrZero(value) };
  }
  if (type === 'boolean') {
    return { type: 'boolean', value: Boolean(value) };
  }
  if (type === 'dice') {
    return { type: 'dice', value: String(value) };
  }
  return { type: 'text', value: String(value) };
}

function inferRuntimeType(value: RuntimeValueInput): string {
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'object' && value !== null && 'type' in value) {
    return value.type;
  }
  return 'text';
}

function expectNumber(value: RuntimeValue): number {
  if (value.type !== 'number') {
    throw new Error(`Expected number, got ${value.type}`);
  }
  return Number(value.value);
}

function arithmetic(operator: string, left: number, right: number): number {
  switch (operator) {
    case '+':
      return left + right;
    case '-':
      return left - right;
    case '*':
      return left * right;
    case '/':
      return left / right;
    default:
      throw new Error(`Unknown arithmetic operator ${operator}`);
  }
}

function compareNumbers(operator: string, left: number, right: number): boolean {
  const a = normalizeEpsilon(left);
  const b = normalizeEpsilon(right);
  switch (operator) {
    case '<':
      return a < b && !numbersEqual(a, b);
    case '<=':
      return a < b || numbersEqual(a, b);
    case '>':
      return a > b && !numbersEqual(a, b);
    case '>=':
      return a > b || numbersEqual(a, b);
    default:
      throw new Error(`Unknown comparison operator ${operator}`);
  }
}

function numbersEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= EPSILON;
}

function normalizeEpsilon(value: number): number {
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= EPSILON ? rounded : value;
}

function assertArity(name: string, args: { length: number }, expected: number): void {
  if (args.length !== expected) {
    throw new Error(`${name} expects ${expected} arguments`);
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function resolveNumberValue(fieldUid: string, value: unknown): number {
  if (!isPartsValue(value)) {
    return numberOrZero(value);
  }

  const parts = value.parts;
  if (!parts || typeof parts !== 'object' || Array.isArray(parts)) {
    throw new Error(`field ${fieldUid} parts must be a record of finite numbers`);
  }

  let total = 0;
  for (const [part, partValue] of Object.entries(parts)) {
    if (typeof partValue !== 'number' || !Number.isFinite(partValue)) {
      throw new Error(`field ${fieldUid} parts.${part} must be a finite number`);
    }
    total += partValue;
    if (!Number.isFinite(total)) {
      throw new Error(`field ${fieldUid} parts sum must be finite`);
    }
  }
  return total;
}

function isPartsValue(value: unknown): value is { parts: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'parts' in value;
}
