import { z } from 'zod';
import { AstNode, countAstNodes } from './ast';
import { assertArity } from './arity';
import { DEFAULT_AST_NODE_LIMIT, DEFAULT_STEP_LIMIT, LIST_ROW_LIMIT } from './evaluator';
import { isNotationFragment } from './notation';
import { parseExpression } from './parser';
import { buildTemplateIndex, canonicalFieldPath, refKey, resolveRefPath } from './template-index';
import { isSimpleField, resolveGridSpan, resolveSectionLayout } from './layout-resolver';
// publish の uid / partsKey 宣言と value-input の入力キー検査は同じ prototype 汚染面を持つ。
// 両境界を UNSAFE_PARTS_KEYS で封止し、許可語彙の drift を防ぐ。
import { RESERVED_PARTS_KEY_IDS, UNSAFE_PARTS_KEYS } from './value-input';
import {
  ExpressionValueType,
  FieldRole,
  ListField,
  LookupTable,
  LookupRow,
  PublishIssue,
  PublishWarning,
  PublishValidationOptions,
  PublishValidationResult,
  ResolvedRef,
  RuntimeValueInput,
  SHEET_FIELD_LAYOUT_SPANS,
  SHEET_SECTION_GRID_COLUMNS,
  SHEET_SECTION_LAYOUT_PRESETS,
  SheetField,
  SheetSection,
  SheetTemplate,
} from './types';

// evaluator.ts の LIST_ROW_LIMIT も現在 512 だが、lookup table と入力 list は別予算なので統合しない。
const DEFAULT_TABLE_ROW_LIMIT = 512;
// publish 境界で診断増幅（実測 100KB〜1.2MB 応答）を発生源で止める上限。裸の z.string() に戻さないこと。
// 根拠: エディタ生成 uid は最大45文字（section.id 最大32 + '_' + random 12）・canonical path 写し規約は最大131文字（4セグメント: section.list.relation.attr）・応答封筒予算 4,096 bytes
const MAX_UID_LENGTH = 128;
const MAX_LABEL_LENGTH = 128;
const MAX_ID_LENGTH = 32;
const MAX_CANONICAL_FIELD_PATH_LENGTH = MAX_ID_LENGTH * 4 + 3;
// 各発行元で切り詰めた echo の合成や将来の発行漏れを出口で封止する backstop。入力断片の上限とは分けて維持する。
// 他の 512 定数との値一致は偶然であり、診断文字数予算なので統合しない。
const MAX_ISSUE_MESSAGE_LENGTH = 512;
const SECTION_LAYOUT_PRESETS = new Set<unknown>(SHEET_SECTION_LAYOUT_PRESETS);
const SECTION_GRID_COLUMNS = new Set<unknown>(SHEET_SECTION_GRID_COLUMNS);
const FIELD_LAYOUT_SPANS = new Set<unknown>(SHEET_FIELD_LAYOUT_SPANS);

const ID_PATTERN = new RegExp(`^[a-z][a-z0-9_]{0,${MAX_ID_LENGTH - 1}}$`);
const KNOWN_FUNCTIONS = new Set(['floor', 'ceil', 'round', 'max', 'min', 'lookup', 'if', 'sum', 'count']);
// engine 内の runtime 参照は無いが削除不可。関数語彙の drift 等価テスト（src/__tests__/function-vocabulary.spec.ts）が唯一の consumer。
export const SHEET_KNOWN_FUNCTION_VALUES: readonly string[] = Object.freeze([...KNOWN_FUNCTIONS]);
const RESERVED_IDS = new Set([
  'row',
  'values',
  'parts',
  // `constructor` は prototype 汚染面を publish 境界で封止するため予約する。
  'constructor',
  ...RESERVED_PARTS_KEY_IDS,
  ...KNOWN_FUNCTIONS,
]);
// engine 内の runtime 参照は無いが削除不可。front の ID 規則複製の drift 等価テスト（trpg-next-app/app/features/characterTemplate/utils/v3Template.spec.ts）が唯一の consumer。
export const SHEET_RESERVED_ID_VALUES: readonly string[] = Object.freeze([...RESERVED_IDS]);
// 未知 function・max/min arity の診断は validateFunctionCalls だけが発行する。
// inferCallType は二重発行防止の停止マーカーを投げ、catch は前段発行済みの場合だけ握る（fail closed）。
const FUNCTION_CALL_ISSUE_ALREADY_REPORTED = new Error('function call issue already reported (internal sentinel)');
const uidSchema = z.string()
  .min(1, 'uid must not be empty')
  .max(MAX_UID_LENGTH, `uid must be ${MAX_UID_LENGTH} characters or fewer`)
  .refine((uid) => !UNSAFE_PARTS_KEYS.has(uid), {
    error: (issue) => `uid is reserved: ${String(issue.input)}`,
  });
const labelSchema = z.string().max(MAX_LABEL_LENGTH, `label must be ${MAX_LABEL_LENGTH} characters or fewer`);
const nonBlankLabelSchema = labelSchema.refine((label) => label.trim().length > 0, {
  message: 'label must not be empty',
});

const roleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rollable'), notation: z.string(), group: z.string().optional(), secret: z.boolean().optional() }).passthrough(),
  z.object({ kind: z.literal('resource'), deltas: z.array(z.number()).min(1, 'deltas must contain at least one entry'), secret: z.boolean().optional() }).passthrough(),
  z.object({ kind: z.literal('profile'), secret: z.boolean().optional() }).passthrough(),
]);

const fieldBaseSchema = {
  id: z.string(),
  uid: uidSchema,
  label: nonBlankLabelSchema,
  description: z.string().optional(),
  role: roleSchema.optional(),
  visibleTo: z.enum(['public', 'owner', 'gm']).optional(),
  when: z.string().optional(),
  blockId: z.string().optional(),
};

const numberOrFormulaSchema = z.union([z.number(), z.object({ formula: z.string() })]);
const partsKeySchema = z.object({ id: z.string(), label: nonBlankLabelSchema }).passthrough();
const scalarFieldSchema = z.object({
  ...fieldBaseSchema,
  type: z.literal('scalar'),
  valueType: z.enum(['number', 'text', 'boolean', 'select']),
  parts: z.boolean().optional(),
  max: numberOrFormulaSchema.optional(),
  partsKeys: z.array(partsKeySchema).min(1, 'partsKeys must contain at least one entry').optional(),
  options: z.array(z.object({ label: labelSchema, value: z.string() })).optional(),
}).passthrough();

const fieldSchema: z.ZodType<SheetField> = z.lazy(() =>
  z.discriminatedUnion('type', [
    scalarFieldSchema,
    z.object({ ...fieldBaseSchema, type: z.literal('computed'), resultType: z.enum(['number', 'text', 'boolean', 'dice']), formula: z.string() }).passthrough(),
    z.object({ ...fieldBaseSchema, type: z.literal('roll'), notation: z.string(), rerollable: z.boolean().optional() }).passthrough(),
    z.object({ ...fieldBaseSchema, type: z.literal('track'), min: z.number().optional(), max: numberOrFormulaSchema, style: z.enum(['gauge', 'checkboxes']), thresholds: z.array(z.object({ at: z.number(), label: labelSchema })).optional(), resetOn: z.enum(['scene', 'session', 'rest']).optional(), resetTo: z.union([z.literal('zero'), z.literal('max'), z.object({ formula: z.string() })]).optional() }).passthrough(),
    z.object({ ...fieldBaseSchema, type: z.literal('list'), itemFields: z.array(fieldSchema), rowRole: roleSchema.optional() }).passthrough(),
    z.object({ ...fieldBaseSchema, type: z.literal('relation'), targetKind: z.enum(['character', 'freeText']).optional(), attrs: z.array(scalarFieldSchema).optional() }).passthrough(),
    z.object({ ...fieldBaseSchema, type: z.literal('tag'), catalog: z.array(z.string()).optional(), allowFreeInput: z.boolean().optional() }).passthrough(),
  ]),
);

const sectionBlockSchema = z.object({
  id: z.string(),
  label: nonBlankLabelSchema,
  cap: numberOrFormulaSchema.optional(),
}).passthrough();
const sectionPoolSchema = z.object({
  id: z.string(),
  label: nonBlankLabelSchema,
  total: numberOrFormulaSchema,
  partsKey: z.string(),
  scope: z.array(z.string()).optional(),
}).passthrough();

const templateSchema: z.ZodType<SheetTemplate> = z.object({
  templateId: z.string(),
  name: z.string(),
  version: z.string(),
  schemaVersion: z.literal(3),
  gameSystemId: z.string().optional(),
  tags: z.array(z.string()),
  visibility: z.enum(['private', 'unlisted', 'public']),
  authorDiscordUserId: z.string(),
  forkedFrom: z.object({ templateId: z.string(), version: z.string() }).optional(),
  license: z.string().optional(),
  sections: z.array(z.object({
    id: z.string(),
    label: nonBlankLabelSchema,
    fields: z.array(fieldSchema),
    layout: z.unknown().optional(),
    blocks: z.array(sectionBlockSchema).optional(),
    pools: z.array(sectionPoolSchema).optional(),
  }).passthrough()),
  tables: z.array(z.object({ id: z.string(), uid: uidSchema.optional(), resultType: z.enum(['number', 'text', 'boolean', 'dice']).optional(), rows: z.array(z.any()) }).passthrough()),
  settings: z.object({ rounding: z.enum(['floor', 'ceil', 'round']) }),
}).passthrough();

function normalizeLimitOption(requested: number | undefined, max: number): number {
  // 上方指定は publish 通過⇔runtime 完走の対応を壊すため既定値で cap する。
  return requested !== undefined && Number.isFinite(requested) && requested > 0 ? Math.min(requested, max) : max;
}

/**
 * Validates a template for publishing.
 *
 * `resolvedRefs` are returned only for a valid template. Invalid templates always return an empty
 * array so callers never receive references derived from an unpublishable shape.
 */
export function validatePublishTemplate(
  template: unknown,
  options: PublishValidationOptions = {},
): PublishValidationResult {
  // --- 1. 構造検証を先に確定し、後段を SheetTemplate 前提に限定する ---
  const issues: PublishIssue[] = [];
  const warnings: PublishWarning[] = [];
  const resolvedRefs = new Map<string, ResolvedRef>();
  const parsed = templateSchema.safeParse(template);

  if (parsed.success) {
    // --- 2. runtime と共有する上限・横断一意性の状態を初期化する ---
    const sheet = parsed.data;
    const tableRowLimit = options.tableRowLimit ?? DEFAULT_TABLE_ROW_LIMIT;
    const astNodeLimit = normalizeLimitOption(options.astNodeLimit, DEFAULT_AST_NODE_LIMIT);
    const evaluationStepLimit = normalizeLimitOption(options.evaluationStepLimit, DEFAULT_STEP_LIMIT);
    const uids = new Set<string>();
    // フロント v3Template.ts の editor uid/id 検査と重ねる多層防御。サーバ projection-key-validation.ts は
    // canonical path ではなく投影先ごとの field id 衝突を担保する（canonical path 検査は同一関数内の field id 検査に厳密支配されるため OV8-a で削除済み）。
    // buildTemplateIndex で索引されず runtime 参照不能な relation attr も、親を含む canonical path で誤衝突しないため一意性集合の superset に含める。
    const canonicalFieldPaths = new Set<string>();

    // --- 3. 表と section 配下を宣言順に検証する ---
    validateTables(sheet.tables, tableRowLimit, issues);

    for (const section of sheet.sections) {
      validateId(`sections.${section.id}.id`, section.id, issues);
      validateSectionLayout(section, warnings);
      validateSectionReferences(section, issues);
      validateSectionFormulaAnnotations(sheet, section, issues, resolvedRefs, astNodeLimit);
      for (const field of section.fields) {
        const path = canonicalFieldPath(section.id, field.id);
        validateField(sheet, field, issues, warnings, resolvedRefs, uids, canonicalFieldPaths, astNodeLimit, path);
        validateNumericAnnotationTarget(field, issues, path, true);
      }
      validateEmptyContentWarnings(section, warnings);
    }

    // --- 4. template 横断の実行量・循環を検証して結果を確定する ---
    // 保存境界は list 値を全拒否し、見積もりだけが評価境界の先頭 LIST_ROW_LIMIT 行と一致する。
    validateStaticEvaluationStepLimit(sheet, evaluationStepLimit, issues);
    detectCycles(sheet, issues);
  } else {
    for (const issue of parsed.error.issues) {
      issues.push({ path: issue.path.join('.') || '$', message: issue.message });
    }
  }

  // 全発行サイトの path/message をこの出口で封止し、新しい診断も各上限へ自動的に収める。
  for (const diagnostic of [...issues, ...warnings]) {
    diagnostic.path = truncateIssueInput(diagnostic.path);
    diagnostic.message = truncateIssueMessage(diagnostic.message);
  }

  const ok = issues.length === 0;
  return { ok, issues, warnings, resolvedRefs: ok ? Array.from(resolvedRefs.values()) : [] };
}

function validateStaticEvaluationStepLimit(
  template: SheetTemplate,
  evaluationStepLimit: number,
  issues: PublishIssue[],
): void {
  const estimatedSteps = estimateStaticEvaluationSteps(template);
  if (estimatedSteps > evaluationStepLimit) {
    issues.push({
      path: '$',
      message: `Static evaluation step limit exceeded: ${estimatedSteps} > ${evaluationStepLimit}`,
    });
  }
}

/**
 * Estimates the conservative step upper bound for formulas evaluated by evaluateTemplate.
 *
 * evalAst increments once per visited AST node. Global computed fields are memoized, and row
 * computed fields are evaluated once per imported row. Each list therefore contributes its row
 * formula cost multiplied by LIST_ROW_LIMIT. if evaluates only one branch and sum/count skip their
 * ref argument in evalAst; countAstNodes includes those skipped nodes, so this remains an upper bound.
 * LIST_ROW_LIMIT（512）倍が上界なのは readListRows の slice に依存し、evaluator.spec.ts:58 が固定する。
 * 保存境界では value-input が list 値そのものを受理せず、この倍率は skewed stored input への防御上限である。
 *
 * D-R3（2026-08-12）により max / cap / pool total 等の注釈式は evaluateConstraint の
 * 呼び出しごとに既定 10,000 の独立予算を得る仕様であり、共有見積もりには加算しない。
 * track.max は server の TrackRangePolicy が別呼び出しで評価し、track.resetTo の評価系は未実装（C-1）。
 */
// engine 内 runtime 参照は validateStaticEvaluationStepLimit の 1 件のみだが export は削除不可。publish spec と scripts/h18-bench.ts が直接 consume する。
export function estimateStaticEvaluationSteps(template: SheetTemplate): number {
  let steps = 0;
  for (const section of template.sections) {
    for (const field of section.fields) {
      steps += estimateStaticFieldSteps(field);
    }
  }
  return steps;
}

function estimateStaticFieldSteps(field: SheetField): number {
  if (field.type === 'list') {
    const rowSteps = field.itemFields.reduce(
      (sum, itemField) => sum + estimateStaticFieldSteps(itemField),
      0,
    );
    return LIST_ROW_LIMIT * rowSteps;
  }
  if (field.type === 'computed') return countFormulaSteps({ formula: field.formula });
  return 0;
}

function countFormulaSteps(value: unknown): number {
  if (!isRecord(value) || typeof value.formula !== 'string') return 0;
  try {
    return countAstNodes(parseExpression(value.formula));
  } catch {
    // Formula validation reports the parse issue; an invalid template cannot pass publish.
    return 0;
  }
}

function validateTables(tables: SheetTemplate['tables'], tableRowLimit: number, issues: PublishIssue[]): void {
  const tableIds = new Set<string>();

  for (const table of tables) {
    validateId(`tables.${table.id}.id`, table.id, issues);
    validateUniqueReferenceKey(table.id, tableIds, issues, `tables.${table.id}.id`, 'table id');
    if (table.rows.length > tableRowLimit) {
      issues.push({ path: `tables.${table.id}.rows`, message: `Lookup table row limit exceeded: ${table.rows.length} > ${tableRowLimit}` });
    }
  }
}

function validateSectionReferences(section: SheetSection, issues: PublishIssue[]): void {
  const blockIds = new Set<string>();
  for (const [index, block] of (section.blocks ?? []).entries()) {
    const path = `sections.${section.id}.blocks.${index}.id`;
    validateId(path, block.id, issues);
    validateUniqueReferenceKey(block.id, blockIds, issues, path, 'block id');
  }

  const poolIds = new Set<string>();
  for (const [index, pool] of (section.pools ?? []).entries()) {
    const path = `sections.${section.id}.pools.${index}.id`;
    validateId(path, pool.id, issues);
    validateUniqueReferenceKey(pool.id, poolIds, issues, path, 'pool id');
  }

  for (const field of section.fields) {
    validateFieldBlockReferences(field, blockIds, issues, canonicalFieldPath(section.id, field.id));
  }

  for (const [poolIndex, pool] of (section.pools ?? []).entries()) {
    for (const [scopeIndex, blockId] of (pool.scope ?? []).entries()) {
      if (!blockIds.has(blockId)) {
        issues.push({
          path: `sections.${section.id}.pools.${poolIndex}.scope.${scopeIndex}`,
          message: `pool scope must reference a declared block: ${truncateIssueInput(blockId)}`,
        });
      }
    }

    const scopedBlockIds = pool.scope === undefined ? undefined : new Set(pool.scope);
    const hasDeclaredPartsKey = section.fields.some((field) =>
      field.type === 'scalar'
      && (scopedBlockIds === undefined || (field.blockId !== undefined && scopedBlockIds.has(field.blockId)))
      && field.partsKeys?.some((partsKey) => partsKey.id === pool.partsKey),
    );
    if (!hasDeclaredPartsKey) {
      issues.push({
        path: `sections.${section.id}.pools.${poolIndex}.partsKey`,
        message: `pool partsKey must be declared by a field in scope: ${truncateIssueInput(pool.partsKey)}`,
      });
    }
  }

  validateConsistentPartsKeyLabels(section, issues);
}

function validateConsistentPartsKeyLabels(section: SheetSection, issues: PublishIssue[]): void {
  const declarationsByBlock = new Map<
    string | undefined,
    Map<string, { field: SheetField; label: string }>
  >();

  for (const field of section.fields) {
    if (field.type !== 'scalar' || field.valueType !== 'number' || field.partsKeys === undefined) continue;
    const declarationsById = declarationsByBlock.get(field.blockId) ?? new Map();
    declarationsByBlock.set(field.blockId, declarationsById);

    for (const [index, partsKey] of field.partsKeys.entries()) {
      const existing = declarationsById.get(partsKey.id);
      if (existing === undefined) {
        declarationsById.set(partsKey.id, { field, label: partsKey.label });
      } else if (existing.field !== field && existing.label !== partsKey.label) {
        issues.push({
          path: `${section.id}.${field.id}.partsKeys.${index}.label`,
          message: `partsKey label must be consistent within block for id: ${truncateIssueInput(partsKey.id)}`,
        });
      }
    }
  }
}

function validateFieldBlockReferences(
  field: SheetField,
  blockIds: ReadonlySet<string>,
  issues: PublishIssue[],
  path: string,
): void {
  if (field.blockId !== undefined && !blockIds.has(field.blockId)) {
    issues.push({
      path: `${path}.blockId`,
      message: `field blockId must reference a declared block: ${truncateIssueInput(field.blockId)}`,
    });
  }

  if (field.type === 'relation') {
    for (const attr of field.attrs ?? []) {
      validateFieldBlockReferences(attr, blockIds, issues, `${path}.${attr.id}`);
    }
  }
  if (field.type === 'list') {
    for (const itemField of field.itemFields) {
      validateFieldBlockReferences(itemField, blockIds, issues, `${path}.${itemField.id}`);
    }
  }
}

function validateSectionFormulaAnnotations(
  template: SheetTemplate,
  section: SheetSection,
  issues: PublishIssue[],
  refs: Map<string, ResolvedRef>,
  astNodeLimit: number,
): void {
  for (const field of section.fields) {
    if (field.type === 'scalar' && field.valueType === 'number' && typeof field.max === 'object') {
      validateNumberFormulaAnnotation(
        template, field.max.formula, field.id, issues, refs, astNodeLimit, `${section.id}.${field.id}.max.formula`,
      );
    }
  }

  for (const [index, block] of (section.blocks ?? []).entries()) {
    if (typeof block.cap === 'object') {
      validateNumberFormulaAnnotation(
        template, block.cap.formula, block.id, issues, refs, astNodeLimit,
        `sections.${section.id}.blocks.${index}.cap.formula`,
      );
    }
  }

  for (const [index, pool] of (section.pools ?? []).entries()) {
    if (typeof pool.total === 'object') {
      validateNumberFormulaAnnotation(
        template, pool.total.formula, pool.id, issues, refs, astNodeLimit,
        `sections.${section.id}.pools.${index}.total.formula`,
      );
    }
  }
}

function validateNumberFormulaAnnotation(
  template: SheetTemplate,
  formula: string,
  targetId: string,
  issues: PublishIssue[],
  refs: Map<string, ResolvedRef>,
  astNodeLimit: number,
  path: string,
): void {
  const actual = validateFormula(template, formula, issues, refs, astNodeLimit, path);
  validateExpectedFormulaType(targetId, 'number', actual, issues, path);
}

function validateNumericAnnotationTarget(
  field: SheetField,
  issues: PublishIssue[],
  path: string,
  isSectionField: boolean,
): void {
  if (field.type === 'scalar') {
    if (isSectionField && field.valueType === 'number') return;
    if (field.max !== undefined) {
      issues.push({ path: `${path}.max`, message: 'scalar max is only supported on section-level number scalar fields' });
    }
    if (field.partsKeys !== undefined) {
      issues.push({ path: `${path}.partsKeys`, message: 'scalar partsKeys are only supported on section-level number scalar fields' });
    }
    return;
  }

  if (isSectionField) {
    if (field.type !== 'track' && Object.prototype.hasOwnProperty.call(field, 'max')) {
      issues.push({
        path: `${path}.max`,
        message: 'max is only supported on section-level number scalar and track fields',
      });
    }
    if (Object.prototype.hasOwnProperty.call(field, 'partsKeys')) {
      issues.push({
        path: `${path}.partsKeys`,
        message: 'partsKeys are only supported on section-level number scalar fields',
      });
    }
  }

  if (field.type === 'relation') {
    for (const attr of field.attrs ?? []) {
      validateNumericAnnotationTarget(attr, issues, `${path}.${attr.id}`, false);
    }
  }
  if (field.type === 'list') {
    for (const itemField of field.itemFields) {
      validateNumericAnnotationTarget(itemField, issues, `${path}.${itemField.id}`, false);
    }
  }
}

function validateEmptyContentWarnings(section: SheetSection, warnings: PublishWarning[]): void {
  if (section.fields.length === 0) {
    warnings.push({
      code: 'section-empty',
      path: `sections.${section.id}.fields`,
      message: 'section has no fields',
    });
  }

  for (const [index, block] of (section.blocks ?? []).entries()) {
    if (!section.fields.some((field) => field.blockId === block.id)) {
      warnings.push({
        code: 'block-empty',
        path: `sections.${section.id}.blocks.${index}`,
        message: `declared block has no fields: ${truncateIssueInput(block.id)}`,
      });
    }
  }
}

function validateField(
  template: SheetTemplate,
  field: SheetField,
  issues: PublishIssue[],
  warnings: PublishWarning[],
  refs: Map<string, ResolvedRef>,
  uids: Set<string>,
  canonicalFieldPaths: Set<string>,
  astNodeLimit: number,
  path: string,
  parentList?: ListField,
): void {
  validateId(`${path}.id`, field.id, issues);
  validateFieldLayout(field.layout, warnings, `${path}.layout`);
  validateUniqueReferenceKey(
    path,
    canonicalFieldPaths,
    issues,
    path,
    'canonical path',
  );
  validateUniqueReferenceKey(field.uid, uids, issues, path, 'uid');

  if (field.visibleTo && field.visibleTo !== 'public') {
    issues.push({ path, message: 'visibleTo other than public is 未対応' });
  }
  if (field.when !== undefined) {
    issues.push({ path, message: 'when is 未対応' });
  }
  validateRole(template, field.role, field, issues, refs, path, parentList, false);

  if (field.type === 'scalar') {
    validateScalarPartsKeys(field, issues, path);
  }
  if (field.type === 'computed') {
    const actual = validateFormula(template, field.formula, issues, refs, astNodeLimit, `${path}.formula`, parentList);
    const diceSourceOk = field.resultType === 'dice'
      ? validateDiceFormulaSource(template, field.formula, field.id, issues, `${path}.formula`, parentList)
      : false;
    const effectiveActual = field.resultType === 'dice' && actual === 'text' && diceSourceOk ? 'dice' : actual;
    validateExpectedFormulaType(field.id, field.resultType, effectiveActual, issues, `${path}.formula`);
  }
  if (field.type === 'roll') {
    validateNotation(template, field.notation, field, issues, refs, `${path}.notation`, parentList, false);
  }
  if (field.type === 'track') {
    validateTrack(template, field, issues, refs, astNodeLimit, path, parentList);
  }
  if (field.type === 'relation') {
    for (const attr of field.attrs ?? []) {
      validateField(template, attr, issues, warnings, refs, uids, canonicalFieldPaths, astNodeLimit, `${path}.${attr.id}`, parentList);
    }
  }
  if (field.type === 'list') {
    validateRole(template, field.rowRole, field, issues, refs, `${path}.rowRole`, field, true);
    for (const subField of field.itemFields) {
      if (subField.type === 'roll') {
        issues.push({ path: `${path}.${subField.id}`, message: 'RollField in itemFields is not supported in v1' });
      }
      if (subField.type === 'list') {
        issues.push({ path: `${path}.${subField.id}`, message: 'list inside list is not supported' });
      }
      validateField(template, subField, issues, warnings, refs, uids, canonicalFieldPaths, astNodeLimit, `${path}.${subField.id}`, field);
    }
  }
}

function validateScalarPartsKeys(
  field: Extract<SheetField, { type: 'scalar' }>,
  issues: PublishIssue[],
  path: string,
): void {
  if (field.partsKeys === undefined) return;
  if (field.parts === true) {
    issues.push({ path: `${path}.partsKeys`, message: 'parts and partsKeys must not be specified together' });
  }

  const seenIds = new Set<string>();
  for (const [index, partsKey] of field.partsKeys.entries()) {
    const idPath = `${path}.partsKeys.${index}.id`;
    validateId(idPath, partsKey.id, issues);
    if (UNSAFE_PARTS_KEYS.has(partsKey.id)) {
      issues.push({ path: idPath, message: `partsKey id is reserved: ${truncateIssueInput(partsKey.id)}` });
    }
    if (seenIds.has(partsKey.id)) {
      issues.push({ path: idPath, message: `partsKey id must be unique within field: ${truncateIssueInput(partsKey.id)}` });
    }
    seenIds.add(partsKey.id);
  }
}

function validateSectionLayout(section: SheetSection, warnings: PublishWarning[]): void {
  const layout = section.layout;
  const layoutPath = `sections.${section.id}.layout`;
  if (layout !== undefined) {
    if (!isRecord(layout) || !Object.prototype.hasOwnProperty.call(layout, 'preset')) {
      warnings.push({ code: 'layout-legacy-ignored', path: layoutPath, message: 'section layout without preset is ignored' });
    } else {
      if (!SECTION_LAYOUT_PRESETS.has(layout.preset)) {
        warnings.push({ code: 'layout-invalid-ignored', path: `${layoutPath}.preset`, message: 'invalid section layout preset is ignored' });
      }
      const columns = layout.columns;
      const hasInvalidColumns = columns !== undefined && !SECTION_GRID_COLUMNS.has(columns);
      if (hasInvalidColumns) {
        warnings.push({
          code: 'layout-invalid-ignored',
          path: `${layoutPath}.columns`,
          message: `section layout columns must be an integer from ${Math.min(...SHEET_SECTION_GRID_COLUMNS)} to ${Math.max(...SHEET_SECTION_GRID_COLUMNS)}`,
        });
      }
    }
  }

  const resolved = resolveSectionLayout(layout);
  for (const field of section.fields) {
    const path = canonicalFieldPath(section.id, field.id);
    const span = isRecord(field.layout) ? field.layout.span : undefined;
    const hasValidSpan = FIELD_LAYOUT_SPANS.has(span);
    const simple = isSimpleField(field);

    if (resolved.mode !== 'grid' && hasValidSpan) {
      warnings.push({
        code: 'layout-span-outside-grid',
        path: `${path}.layout.span`,
        message: 'field layout span is ignored outside grid',
      });
    }
    if (
      resolved.mode === 'grid'
      && simple
      && typeof span === 'number'
      && hasValidSpan
      && resolveGridSpan(field, resolved.columns) === 'full'
    ) {
      warnings.push({
        code: 'layout-span-clamped',
        path: `${path}.layout.span`,
        message: 'field layout span is clamped to full because it is not smaller than grid columns',
      });
    }
    if (resolved.mode === 'table' && !simple) {
      warnings.push({
        code: 'layout-table-complex-demoted',
        path,
        message: 'complex field is demoted to a full-width table row',
      });
    }
  }
}

function validateFieldLayout(layout: unknown, warnings: PublishWarning[], path: string): void {
  if (layout === undefined) return;
  if (!isRecord(layout)) {
    warnings.push({ code: 'layout-invalid-ignored', path, message: 'invalid field layout is ignored' });
    return;
  }
  if (layout.span !== undefined && !FIELD_LAYOUT_SPANS.has(layout.span)) {
    warnings.push({ code: 'layout-invalid-ignored', path: `${path}.span`, message: 'invalid field layout span is ignored' });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateUniqueReferenceKey(
  key: string,
  seen: Set<string>,
  issues: PublishIssue[],
  path: string,
  keyName: 'block id' | 'canonical path' | 'pool id' | 'table id' | 'uid',
): void {
  if (seen.has(key)) {
    issues.push({
      // uid の issue path は HEAD 挙動保存のため従来表示を維持し、message 内の key だけを切り詰める。新しい keyName 追加時は path の切り詰め要否を判断すること。
      path: keyName === 'uid' ? path : truncateIssueInput(path),
      message: `${keyName} must be unique: ${truncateIssueInput(key)}`,
    });
  }
  seen.add(key);
}

function truncateIssueInput(value: string): string {
  return truncateIssueText(value, MAX_CANONICAL_FIELD_PATH_LENGTH);
}

function truncateIssueMessage(value: string): string {
  return truncateIssueText(value, MAX_ISSUE_MESSAGE_LENGTH);
}

function truncateIssueText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  let sliceEnd = maxLength - 1;
  const lastCodeUnit = value.charCodeAt(sliceEnd - 1);
  if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF) {
    sliceEnd -= 1;
  }
  return `${value.slice(0, sliceEnd)}…`;
}

function validateTrack(
  template: SheetTemplate,
  field: Extract<SheetField, { type: 'track' }>,
  issues: PublishIssue[],
  refs: Map<string, ResolvedRef>,
  astNodeLimit: number,
  path: string,
  parentList?: ListField,
): void {
  const min = field.min ?? 0;
  if (typeof field.max === 'number' && field.max < min) {
    issues.push({ path, message: 'track max must be greater than or equal to min' });
  }
  for (const threshold of field.thresholds ?? []) {
    if (threshold.at < min || (typeof field.max === 'number' && threshold.at > field.max)) {
      issues.push({ path: `${path}.thresholds`, message: 'threshold at must be within track min/max' });
    }
  }
  if (field.resetTo === 'zero' && min > 0) {
    issues.push({ path: `${path}.resetTo`, message: 'resetTo zero is outside track range' });
  }
  if (typeof field.max !== 'number') {
    const actual = validateFormula(template, field.max.formula, issues, refs, astNodeLimit, `${path}.max.formula`, parentList);
    validateExpectedFormulaType(field.id, 'number', actual, issues, `${path}.max.formula`);
  }
  if (typeof field.resetTo === 'object') {
    const actual = validateFormula(template, field.resetTo.formula, issues, refs, astNodeLimit, `${path}.resetTo.formula`, parentList);
    validateExpectedFormulaType(field.id, 'number', actual, issues, `${path}.resetTo.formula`);
    if (referencesPath(field.resetTo.formula, path.split('.').slice(-1)[0])) {
      issues.push({ path: `${path}.resetTo.formula`, message: 'resetTo formula must not reference its own track value' });
    }
  }
}

function validateRole(
  template: SheetTemplate,
  role: FieldRole | undefined,
  owner: SheetField,
  issues: PublishIssue[],
  refs: Map<string, ResolvedRef>,
  path: string,
  parentList: ListField | undefined,
  isRowRole: boolean,
): void {
  if (!role) {
    return;
  }
  if ('secret' in role && role.secret) {
    issues.push({ path, message: 'secret role is 未対応' });
  }
  if ('when' in role && role.when !== undefined) {
    issues.push({ path, message: 'role.when is 未対応' });
  }
  if (role.kind !== 'rollable') {
    return;
  }
  validateNotation(template, role.notation, owner, issues, refs, path, parentList, isRowRole);
}

function validateFormula(
  template: SheetTemplate,
  formula: string,
  issues: PublishIssue[],
  refs: Map<string, ResolvedRef>,
  astNodeLimit: number,
  path: string,
  parentList?: ListField,
): ExpressionValueType | undefined {
  let hasReportedFunctionCallIssue = false;
  try {
    const ast = parseExpression(formula);
    if (countAstNodes(ast) > astNodeLimit) {
      issues.push({ path, message: `AST node limit exceeded: ${countAstNodes(ast)} > ${astNodeLimit}` });
    }
    collectRefs(template, ast, issues, refs, path, parentList);
    const issueCountBeforeFunctionCallValidation = issues.length;
    validateFunctionCalls(ast, issues, path);
    hasReportedFunctionCallIssue = issues.length > issueCountBeforeFunctionCallValidation;
    return inferExpressionType(template, ast, parentList);
  } catch (error) {
    if (error === FUNCTION_CALL_ISSUE_ALREADY_REPORTED && hasReportedFunctionCallIssue) {
      return undefined;
    }
    issues.push({ path, message: truncateIssueInput(error instanceof Error ? error.message : String(error)) });
    return undefined;
  }
}

function validateExpectedFormulaType(
  fieldId: string,
  expected: ExpressionValueType,
  actual: ExpressionValueType | undefined,
  issues: PublishIssue[],
  path: string,
): void {
  if (actual && actual !== expected) {
    issues.push({ path, message: `field ${truncateIssueInput(fieldId)} expected ${expected}, got ${actual}` });
  }
}

function validateNotation(
  template: SheetTemplate,
  notation: string,
  owner: SheetField,
  issues: PublishIssue[],
  refs: Map<string, ResolvedRef>,
  path: string,
  parentList: ListField | undefined,
  isRowRole: boolean,
): void {
  let tokens: Array<{ path: string }>;
  try {
    tokens = extractNotationTokens(notation);
  } catch {
    issues.push({ path, message: 'unclosed notation token' });
    return;
  }

  for (const token of tokens) {
    if (token.path === 'value') {
      if (isRowRole) {
        issues.push({ path, message: 'rowRole cannot use {value}; use {row.subFieldId}' });
      } else if (!isNotationTypeAllowed(owner)) {
        issues.push({ path, message: `notation reference {value} must be number or validated fragment` });
      }
      continue;
    }

    try {
      const index = buildTemplateIndex(template);
      const ref = resolveRefPath(index, token.path, parentList);
      refs.set(refKey(ref), ref);
      const field = resolveFieldByRef(template, ref);
      if (!field || !isNotationTypeAllowed(field)) {
        issues.push({ path, message: `notation reference {${truncateIssueInput(token.path)}} must be number or validated fragment` });
      }
    } catch (error) {
      issues.push({ path, message: truncateIssueInput(error instanceof Error ? error.message : String(error)) });
    }
  }
}

function collectRefs(
  template: SheetTemplate,
  ast: AstNode,
  issues: PublishIssue[],
  refs: Map<string, ResolvedRef>,
  path: string,
  parentList?: ListField,
  insideAggregate = false,
): void {
  const index = buildTemplateIndex(template);
  if (ast.type === 'ref') {
    try {
      const ref = resolveRefPath(index, ast.path, parentList);
      if (ref.kind === 'listSubField' && !insideAggregate) {
        issues.push({ path, message: `list subfield reference must be inside sum/count: ${truncateIssueInput(ast.path)}` });
      }
      refs.set(refKey(ref), ref);
    } catch (error) {
      issues.push({ path, message: truncateIssueInput(error instanceof Error ? error.message : String(error)) });
    }
    return;
  }
  if (ast.type === 'call') {
    const aggregate = ast.name === 'sum' || ast.name === 'count';
    for (const arg of ast.args) {
      collectRefs(template, arg, issues, refs, path, parentList, aggregate);
    }
    return;
  }
  if (ast.type === 'unary') {
    collectRefs(template, ast.argument, issues, refs, path, parentList, insideAggregate);
  }
  if (ast.type === 'binary') {
    collectRefs(template, ast.left, issues, refs, path, parentList, insideAggregate);
    collectRefs(template, ast.right, issues, refs, path, parentList, insideAggregate);
  }
}

function validateFunctionCalls(ast: AstNode, issues: PublishIssue[], path: string): void {
  if (ast.type === 'call') {
    if (!KNOWN_FUNCTIONS.has(ast.name)) {
      issues.push({ path, message: `Unknown function: ${truncateIssueInput(ast.name)}` });
    }
    if ((ast.name === 'max' || ast.name === 'min') && ast.args.length !== 2) {
      issues.push({ path, message: `${truncateIssueInput(ast.name)} is a binary function` });
    }
    for (const arg of ast.args) {
      validateFunctionCalls(arg, issues, path);
    }
  } else if (ast.type === 'unary') {
    validateFunctionCalls(ast.argument, issues, path);
  } else if (ast.type === 'binary') {
    validateFunctionCalls(ast.left, issues, path);
    validateFunctionCalls(ast.right, issues, path);
  }
}

function inferExpressionType(template: SheetTemplate, ast: AstNode, parentList?: ListField): ExpressionValueType {
  const index = buildTemplateIndex(template);
  switch (ast.type) {
    case 'number':
      return 'number';
    case 'string':
      return 'text';
    case 'tableName':
      return 'text';
    case 'boolean':
      return 'boolean';
    case 'ref': {
      const ref = resolveRefPath(index, ast.path, parentList);
      if (ref.kind === 'listSubField') {
        throw new Error(`list subfield reference must be inside sum/count: ${truncateIssueInput(ast.path)}`);
      }
      const field = resolveFieldByRef(template, ref);
      if (!field) {
        throw new Error(`Unknown field reference: ${truncateIssueInput(ast.path)}`);
      }
      return fieldExpressionType(field, ast.path);
    }
    case 'unary': {
      const type = inferExpressionType(template, ast.argument, parentList);
      if (type !== 'number') {
        throw new Error(`Unary ${ast.operator} requires number, got ${type}`);
      }
      return 'number';
    }
    case 'binary':
      return inferBinaryType(template, ast, parentList);
    case 'call':
      return inferCallType(template, ast, parentList);
  }
}

function inferBinaryType(
  template: SheetTemplate,
  ast: Extract<AstNode, { type: 'binary' }>,
  parentList?: ListField,
): ExpressionValueType {
  const left = inferExpressionType(template, ast.left, parentList);
  const right = inferExpressionType(template, ast.right, parentList);
  if (ast.operator === '+') {
    if (isDiceExpressionCandidate(template, ast.left, parentList) && isDiceExpressionCandidate(template, ast.right, parentList)) {
      return 'dice';
    }
    if (left !== 'number' || right !== 'number') {
      throw new Error(`Arithmetic requires number operands, got ${left} ${ast.operator} ${right}`);
    }
    return 'number';
  }
  if (['-', '*', '/'].includes(ast.operator)) {
    if (left !== 'number' || right !== 'number') {
      throw new Error(`Arithmetic requires number operands, got ${left} ${ast.operator} ${right}`);
    }
    return 'number';
  }
  if (ast.operator === '==' || ast.operator === '!=') {
    if (left !== right || left === 'dice') {
      throw new Error(`Equality requires same scalar types, got ${left} ${ast.operator} ${right}`);
    }
    return 'boolean';
  }
  if (left !== 'number' || right !== 'number') {
    throw new Error(`Comparison requires number operands, got ${left} ${ast.operator} ${right}`);
  }
  return 'boolean';
}

function inferCallType(template: SheetTemplate, ast: Extract<AstNode, { type: 'call' }>, parentList?: ListField): ExpressionValueType {
  if (ast.name === 'if') {
    assertArity(ast.name, ast.args, 3);
    const condition = inferExpressionType(template, ast.args[0], parentList);
    if (condition !== 'boolean') {
      throw new Error(`if condition must be boolean, got ${condition}`);
    }
    const thenType = inferExpressionType(template, ast.args[1], parentList);
    const elseType = inferExpressionType(template, ast.args[2], parentList);
    if (thenType !== elseType) {
      throw new Error(`if branches must have the same type, got ${thenType} and ${elseType}`);
    }
    return thenType;
  }

  if (ast.name === 'sum' || ast.name === 'count') {
    assertArity(ast.name, ast.args, 1);
    const refNode = ast.args[0];
    if (refNode.type !== 'ref') {
      throw new Error(`${truncateIssueInput(ast.name)} expects a list subfield reference`);
    }
    const ref = resolveRefPath(buildTemplateIndex(template), refNode.path, parentList);
    if (ref.kind !== 'listSubField') {
      throw new Error(`${truncateIssueInput(ast.name)} expects a list subfield reference`);
    }
    if (ast.name === 'sum') {
      const field = resolveFieldByRef(template, ref);
      const type = field ? fieldExpressionType(field, refNode.path) : undefined;
      if (type !== 'number') {
        throw new Error(`sum requires number list subfield, got ${type ?? 'unknown'}`);
      }
    }
    return 'number';
  }

  if (ast.name === 'lookup') {
    assertArity(ast.name, ast.args, 2);
    return inferLookupType(template, ast.args, parentList);
  }

  if (ast.name === 'floor' || ast.name === 'ceil' || ast.name === 'round') {
    assertArity(ast.name, ast.args, 1);
    const type = inferExpressionType(template, ast.args[0], parentList);
    if (type !== 'number') {
      throw new Error(`${truncateIssueInput(ast.name)} requires number, got ${type}`);
    }
    return 'number';
  }

  if (ast.name === 'max' || ast.name === 'min') {
    if (ast.args.length !== 2) {
      throw FUNCTION_CALL_ISSUE_ALREADY_REPORTED;
    }
    const left = inferExpressionType(template, ast.args[0], parentList);
    const right = inferExpressionType(template, ast.args[1], parentList);
    if (left !== 'number' || right !== 'number') {
      throw new Error(`${truncateIssueInput(ast.name)} requires number arguments, got ${left} and ${right}`);
    }
    return 'number';
  }

  throw FUNCTION_CALL_ISSUE_ALREADY_REPORTED;
}

function inferLookupType(template: SheetTemplate, args: AstNode[], parentList?: ListField): ExpressionValueType {
  const table = resolveLookupTable(template, args);
  if (!table) {
    const tableId = literalTableId(args[0]) ?? literalTableId(args[1]);
    if (!tableId) {
      throw new Error('lookup requires one table id argument');
    }
    throw new Error(`Unknown lookup table: ${truncateIssueInput(tableId)}`);
  }
  const tableArgumentIndex = args.findIndex((arg) => literalTableId(arg) === table.id);
  inferExpressionType(template, args[tableArgumentIndex === 0 ? 1 : 0], parentList);
  return inferLookupTableType(table);
}

function literalTableId(ast: AstNode): string | undefined {
  if (ast.type === 'tableName') {
    return ast.name;
  }
  if (ast.type === 'string') {
    return ast.value;
  }
  return undefined;
}

function inferLookupTableType(table: LookupTable): ExpressionValueType {
  if (table.resultType) {
    return table.resultType;
  }
  const first = table.rows[0];
  if (!first) {
    return 'text';
  }
  if (!Array.isArray(first) && 'resultType' in first && first.resultType) {
    return first.resultType;
  }
  const { result } = lookupRowResult(first);
  // isNotationFragment は非 string を String 強制するため、['1d6'] を dice と誤判定せず旧実装の text fallback を保つ。
  // この否定条件は inferRuntimeInputType が扱う値種別の補集合を維持すること。
  if (
    typeof result !== 'number' &&
    typeof result !== 'boolean' &&
    typeof result !== 'string' &&
    (typeof result !== 'object' || result === null || !('type' in result))
  ) {
    return 'text';
  }
  return inferRuntimeInputType(result);
}

function validateDiceFormulaSource(
  template: SheetTemplate,
  formula: string,
  fieldId: string,
  issues: PublishIssue[],
  path: string,
  parentList?: ListField,
): boolean {
  try {
    return validateDiceSourceAst(template, parseExpression(formula), fieldId, issues, path, parentList);
  } catch {
    return false;
  }
}

function validateDiceSourceAst(
  template: SheetTemplate,
  ast: AstNode,
  fieldId: string,
  issues: PublishIssue[],
  path: string,
  parentList?: ListField,
): boolean {
  if (ast.type === 'string') {
    if (!isNotationFragment(ast.value)) {
      issues.push({
        path,
        message: `field ${truncateIssueInput(fieldId)} dice literal must be notation fragment: ${truncateIssueInput(ast.value)}`,
      });
      return false;
    }
    return true;
  }

  if (ast.type === 'call' && ast.name === 'lookup') {
    const table = resolveLookupTable(template, ast.args);
    if (!table) {
      return false;
    }
    validateLookupTableDiceFragments(table, fieldId, issues, path);
    return true;
  }

  if (ast.type === 'binary' && ast.operator === '+') {
    const left = validateDiceSourceAst(template, ast.left, fieldId, issues, path, parentList);
    const right = validateDiceSourceAst(template, ast.right, fieldId, issues, path, parentList);
    return left && right;
  }

  if (ast.type === 'ref') {
    try {
      const ref = resolveRefPath(buildTemplateIndex(template), ast.path, parentList);
      const field = resolveFieldByRef(template, ref);
      if (field?.type === 'computed' && field.resultType === 'dice') {
        return validateDiceSourceAst(template, parseExpression(field.formula), field.id, issues, path, parentList);
      }
    } catch {
      return false;
    }
  }

  issues.push({
    path,
    message: `field ${truncateIssueInput(fieldId)} dice formula must be lookup-derived or dice literal concatenation`,
  });
  return false;
}

function isDiceExpressionCandidate(template: SheetTemplate, ast: AstNode, parentList?: ListField): boolean {
  if (ast.type === 'string') {
    return isNotationFragment(ast.value);
  }
  if (ast.type === 'call' && ast.name === 'lookup') {
    const table = resolveLookupTable(template, ast.args);
    return table ? inferLookupTableType(table) === 'dice' : false;
  }
  if (ast.type === 'binary' && ast.operator === '+') {
    return isDiceExpressionCandidate(template, ast.left, parentList) && isDiceExpressionCandidate(template, ast.right, parentList);
  }
  if (ast.type === 'ref') {
    try {
      const ref = resolveRefPath(buildTemplateIndex(template), ast.path, parentList);
      const field = resolveFieldByRef(template, ref);
      return field?.type === 'computed' && field.resultType === 'dice';
    } catch {
      return false;
    }
  }
  return false;
}

function resolveLookupTable(template: SheetTemplate, args: AstNode[]): LookupTable | undefined {
  const tableId = literalTableId(args[0]) ?? literalTableId(args[1]);
  return tableId ? template.tables.find((candidate) => candidate.id === tableId) : undefined;
}

function validateLookupTableDiceFragments(
  table: LookupTable,
  fieldId: string,
  issues: PublishIssue[],
  path: string,
): void {
  table.rows.forEach((row, index) => {
    const { result, resultType } = lookupRowResult(row);
    const actual = resultType ?? table.resultType ?? inferRuntimeInputType(result);
    if (actual !== 'dice') {
      issues.push({
        path,
        message: `field ${truncateIssueInput(fieldId)} lookup table ${truncateIssueInput(table.id)} row ${index} expected dice, got ${actual}`,
      });
      return;
    }
    const literal = runtimeInputValue(result);
    if (!isNotationFragment(String(literal))) {
      issues.push({
        path,
        message: `field ${truncateIssueInput(fieldId)} lookup table ${truncateIssueInput(table.id)} row ${index} result must be notation fragment: ${truncateIssueInput(String(literal))}`,
      });
    }
  });
}

function lookupRowResult(row: LookupRow): { result: RuntimeValueInput; resultType?: ExpressionValueType } {
  if (Array.isArray(row)) {
    return { result: row[row.length - 1] };
  }
  return { result: row.result, resultType: row.resultType };
}

function runtimeInputValue(value: RuntimeValueInput): number | string | boolean {
  if (typeof value === 'object' && value !== null && 'type' in value) {
    return value.value;
  }
  return value;
}

function inferRuntimeInputType(value: RuntimeValueInput): ExpressionValueType {
  if (typeof value === 'number') {
    return 'number';
  }
  if (typeof value === 'boolean') {
    return 'boolean';
  }
  if (typeof value === 'object' && value !== null && 'type' in value) {
    return value.type;
  }
  return isNotationFragment(value) ? 'dice' : 'text';
}

function fieldExpressionType(field: SheetField, referencePath: string): ExpressionValueType {
  if (field.type === 'list') {
    // evaluator は list を値空間に持たないため、コンテナの直接参照は評価不能。
    throw new Error(`list field cannot be referenced directly: ${truncateIssueInput(referencePath)}`);
  }
  if (field.type === 'scalar') {
    if (field.valueType === 'number' || field.valueType === 'boolean') {
      return field.valueType;
    }
    return 'text';
  }
  if (field.type === 'computed') {
    return field.resultType;
  }
  if (field.type === 'track') {
    return 'number';
  }
  if (field.type === 'roll') {
    return 'dice';
  }
  return 'text';
}

function detectCycles(template: SheetTemplate, issues: PublishIssue[]): void {
  const graph = new Map<string, Set<string>>();
  const index = buildTemplateIndex(template);

  for (const section of template.sections) {
    for (const field of section.fields) {
      if (field.type === 'computed') {
        const deps = safeFormulaDeps(template, field.formula);
        if (deps) {
          graph.set(field.uid, deps);
        }
      }
      if (field.type === 'list') {
        for (const subField of field.itemFields) {
          if (subField.type === 'computed') {
            const deps = safeFormulaDeps(template, subField.formula, field);
            if (deps) {
              graph.set(subField.uid, deps);
            }
          }
        }
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (uid: string): boolean => {
    if (visiting.has(uid)) {
      return true;
    }
    if (visited.has(uid)) {
      return false;
    }
    visiting.add(uid);
    for (const dep of graph.get(uid) ?? []) {
      if (graph.has(dep) && visit(dep)) {
        return true;
      }
    }
    visiting.delete(uid);
    visited.add(uid);
    return false;
  };

  for (const uid of graph.keys()) {
    if (visit(uid)) {
      const locator = index.fieldsByUid.get(uid);
      issues.push({ path: locator?.path ?? uid, message: 'Circular reference detected' });
      return;
    }
  }
}

function safeFormulaDeps(template: SheetTemplate, formula: string, parentList?: ListField): Set<string> | undefined {
  try {
    return formulaDeps(template, formula, parentList);
  } catch {
    return undefined;
  }
}

function formulaDeps(template: SheetTemplate, formula: string, parentList?: ListField): Set<string> {
  const deps = new Set<string>();
  const index = buildTemplateIndex(template);
  const ast = parseExpression(formula);
  walk(ast, (node) => {
    if (node.type !== 'ref') {
      return;
    }
    const ref = resolveRefPath(index, node.path, parentList);
    if (ref.kind === 'field') {
      deps.add(ref.uid);
    }
    if (ref.kind === 'listSubField') {
      deps.add(ref.subFieldUid);
    }
  });
  return deps;
}

function walk(ast: AstNode, visitor: (node: AstNode) => void): void {
  visitor(ast);
  if (ast.type === 'unary') {
    walk(ast.argument, visitor);
  } else if (ast.type === 'binary') {
    walk(ast.left, visitor);
    walk(ast.right, visitor);
  } else if (ast.type === 'call') {
    for (const arg of ast.args) {
      walk(arg, visitor);
    }
  }
}

function resolveFieldByRef(template: SheetTemplate, ref: ResolvedRef): SheetField | undefined {
  for (const section of template.sections) {
    for (const field of section.fields) {
      if (ref.kind === 'field' && field.uid === ref.uid) {
        return field;
      }
      if (field.type === 'list') {
        const sub = field.itemFields.find((item) => ref.kind === 'field' ? item.uid === ref.uid : item.uid === ref.subFieldUid);
        if (sub) {
          return sub;
        }
      }
    }
  }
  return undefined;
}

function isNotationTypeAllowed(field: SheetField): boolean {
  if (field.type === 'scalar') {
    return field.valueType === 'number';
  }
  if (field.type === 'track') {
    return true;
  }
  if (field.type === 'computed') {
    return field.resultType === 'number' || field.resultType === 'dice';
  }
  return false;
}

function extractNotationTokens(notation: string): Array<{ path: string }> {
  const tokens: Array<{ path: string }> = [];
  for (let i = 0; i < notation.length; i += 1) {
    if (notation[i] === '{' && notation[i + 1] === '{') {
      i += 1;
      continue;
    }
    if (notation[i] !== '{') {
      continue;
    }
    const end = notation.indexOf('}', i + 1);
    if (end < 0) {
      throw new Error('Unclosed notation token');
    }
    const raw = notation.slice(i + 1, end).trim();
    const path = raw.startsWith('+') || raw.startsWith('-') ? raw.slice(1).trim() : raw;
    tokens.push({ path });
    i = end;
  }
  return tokens;
}

function validateId(path: string, id: string, issues: PublishIssue[]): void {
  if (!ID_PATTERN.test(id)) {
    issues.push({ path, message: `id must match ${ID_PATTERN}` });
  }
  if (RESERVED_IDS.has(id)) {
    issues.push({ path, message: `id is reserved: ${truncateIssueInput(id)}` });
  }
}

function referencesPath(formula: string, fieldId: string): boolean {
  return formula.includes(`.${fieldId}}`) || formula.includes(`{row.${fieldId}}`);
}
