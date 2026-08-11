import { AstNode } from './ast';
import { evaluateExpression } from './evaluator';
import { parseExpression } from './parser';
import {
  buildTemplateIndex,
  fieldCandidateKeys,
  readAliasedValue,
  resolveRefPath,
} from './template-index';
import { ConstraintSource, ListField, SheetField, SheetTemplate } from './types';

export type ConstraintEvaluationResult =
  | {
      status: 'ok';
      /** Display/comparison only; never map, persist, or write this value through computedCache, materialize, or DiscordProjectionViewModel. */
      value: number;
    }
  | { status: 'indeterminate' }
  | { status: 'error' };

type RawNumberDependency =
  | { kind: 'field'; keys: string[] }
  | { kind: 'listSubField'; listKeys: string[]; subFieldKeys: string[] };

type ConstraintDependencyClosure = {
  fieldUids: Set<string>;
  listSubFieldUids: Map<string, Set<string>>;
  rawNumberDependencies: RawNumberDependency[];
};

/**
 * Evaluates a display-only constraint after checking its raw number dependencies for missing entries.
 * Number scalars and tracks require an own, non-nullish raw entry. Roll and boolean fields are
 * intentionally excluded: a missing roll degrades to error, while a missing boolean selects the falsy branch.
 * Parse or reference-resolution failures degrade to error; incomplete closures do not guarantee
 * indeterminate precedence. Formula semantics otherwise remain owned by the shared evaluator.
 */
export function evaluateConstraint(
  source: unknown,
  template: SheetTemplate,
  rawValues: Record<string, unknown>,
): ConstraintEvaluationResult {
  if (typeof source === 'number') {
    return Number.isFinite(source) ? { status: 'ok', value: source } : { status: 'error' };
  }
  if (!isFormulaConstraintSource(source)) return { status: 'error' };

  try {
    const closure = buildConstraintDependencyClosure(template, source.formula);
    if (closure.rawNumberDependencies.some((dependency) => isRawNumberDependencyMissing(dependency, rawValues))) {
      return { status: 'indeterminate' };
    }
    const value = evaluateExpression(buildEvaluationTemplate(template, closure), source.formula, {
      values: rawValues,
    });
    if (value.type !== 'number' || typeof value.value !== 'number' || !Number.isFinite(value.value)) {
      return { status: 'error' };
    }
    return { status: 'ok', value: value.value };
  } catch {
    return { status: 'error' };
  }
}

function buildConstraintDependencyClosure(template: SheetTemplate, formula: string): ConstraintDependencyClosure {
  const closure: ConstraintDependencyClosure = {
    fieldUids: new Set(),
    listSubFieldUids: new Map(),
    rawNumberDependencies: [],
  };
  const index = buildTemplateIndex(template);
  const rawDependencyKeys = new Set<string>();
  const visitedComputedKeys = new Set<string>();

  function visitFormula(currentFormula: string, parentList?: ListField): void {
    visitAst(parseExpression(currentFormula), parentList);
  }

  function visitAst(node: AstNode, parentList?: ListField, tracksRawValue = true): void {
    if (node.type === 'ref') {
      visitReference(node.path, parentList, tracksRawValue);
      return;
    }
    if (node.type === 'unary') {
      visitAst(node.argument, parentList, tracksRawValue);
      return;
    }
    if (node.type === 'binary') {
      visitAst(node.left, parentList, tracksRawValue);
      visitAst(node.right, parentList, tracksRawValue);
      return;
    }
    if (node.type === 'call') {
      // Non-selected if branches stay dependencies; count keeps its subfield only for reference resolution.
      const argumentTracksRawValue = tracksRawValue && node.name !== 'count';
      node.args.forEach((argument) => visitAst(argument, parentList, argumentTracksRawValue));
    }
  }

  function visitReference(path: string, parentList?: ListField, tracksRawValue = true): void {
    const ref = resolveRefPath(index, path, parentList);

    if (ref.kind === 'listSubField') {
      const list = index.listsByUid.get(ref.listUid)?.field;
      const field = list?.itemFields.find((candidate) => candidate.uid === ref.subFieldUid);
      if (list && field) visitListSubField(list, field, tracksRawValue);
      return;
    }

    const rowField = parentList?.itemFields.find((candidate) => candidate.uid === ref.uid);
    if (parentList && rowField) {
      visitListSubField(parentList, rowField, tracksRawValue);
      return;
    }

    const locator = index.fieldsByUid.get(ref.uid);
    if (!locator) return;
    closure.fieldUids.add(locator.field.uid);
    if (!tracksRawValue) return;
    if (locator.field.type === 'computed') {
      visitComputed(`field:${locator.field.uid}`, locator.field.formula);
    } else if (isRawNumberInputField(locator.field)) {
      addRawDependency(`field:${locator.field.uid}`, {
        kind: 'field',
        keys: fieldCandidateKeys(locator.field.uid, locator.path, locator.field.id),
      });
    }
  }

  function visitListSubField(list: ListField, field: SheetField, tracksRawValue: boolean): void {
    closure.fieldUids.add(list.uid);
    const selectedSubFields = closure.listSubFieldUids.get(list.uid) ?? new Set<string>();
    selectedSubFields.add(field.uid);
    closure.listSubFieldUids.set(list.uid, selectedSubFields);

    if (!tracksRawValue) return;
    if (field.type === 'computed') {
      visitComputed(`row:${list.uid}:${field.uid}`, field.formula, list);
    } else if (isRawNumberInputField(field)) {
      const locator = index.fieldsByUid.get(list.uid);
      addRawDependency(`row:${list.uid}:${field.uid}`, {
        kind: 'listSubField',
        listKeys: fieldCandidateKeys(list.uid, locator?.path ?? list.id, list.id),
        subFieldKeys: [field.uid, field.id],
      });
    }
  }

  function visitComputed(key: string, computedFormula: string, parentList?: ListField): void {
    if (visitedComputedKeys.has(key)) return;
    visitedComputedKeys.add(key);
    visitFormula(computedFormula, parentList);
  }

  function addRawDependency(key: string, dependency: RawNumberDependency): void {
    if (rawDependencyKeys.has(key)) return;
    rawDependencyKeys.add(key);
    closure.rawNumberDependencies.push(dependency);
  }

  visitFormula(formula);
  return closure;
}

function isFormulaConstraintSource(source: unknown): source is Extract<ConstraintSource, { formula: string }> {
  return isRecord(source) && typeof source.formula === 'string';
}

// superset 等価 spec（field-predicates.spec）の deep import 用 default export。barrel（export *）非公開を保つため named export 化しない・削除不可。
export default function isRawNumberInputField(field: SheetField): boolean {
  // H-7 生入力欠落判定対象 = number scalar＋track（H-6 適用対象の superset — 意図差。片側だけの変更禁止）。
  return field.type === 'track' || (field.type === 'scalar' && field.valueType === 'number');
}

function isRawNumberDependencyMissing(
  dependency: RawNumberDependency,
  rawValues: Record<string, unknown>,
): boolean {
  if (dependency.kind === 'field') return readAliasedValue(rawValues, dependency.keys) === undefined;

  const rawRows = readAliasedValue(rawValues, dependency.listKeys);
  // Nullish or non-array list containers mean zero rows, matching the shared evaluator contract.
  const rows = Array.isArray(rawRows) ? rawRows : [];
  return rows.some((row) =>
    !isRecord(row) || readAliasedValue(row, dependency.subFieldKeys) === undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildEvaluationTemplate(
  template: SheetTemplate,
  closure: ConstraintDependencyClosure,
): SheetTemplate {
  return {
    ...template,
    sections: template.sections.map((section) => ({
      ...section,
      fields: section.fields
        .filter((field) => closure.fieldUids.has(field.uid))
        .map((field) => field.type === 'list'
          ? { ...field, itemFields: field.itemFields.filter((item) => closure.listSubFieldUids.get(field.uid)?.has(item.uid)) }
          : field),
    })),
  };
}
