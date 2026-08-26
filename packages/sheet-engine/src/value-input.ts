import { z } from 'zod';
import { LIST_ROW_LIMIT } from './evaluator';
import { isPartsRecordValue, isPartsValue } from './parts-value';
import { SheetField, SheetTemplate } from './types';

export interface PartsValueInput {
  parts: Record<string, number>;
}

export interface ListRowInput {
  rowId: string;
  [itemFieldUid: string]: unknown;
}

export type SheetValueInput = number | string | boolean | PartsValueInput | ListRowInput[];

export const RESERVED_PARTS_KEY_IDS = Object.freeze(['base', 'other'] as const);
const RESERVED_PARTS_KEY_ID_SET = new Set<string>(RESERVED_PARTS_KEY_IDS);
// parts キー・list 行キー・rowId の 3 入力面が共有する prototype 汚染面を封止する。
export const UNSAFE_PARTS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
// Discord button label の 80 字上限に対し、palette の現行書式「名前 (値)」は区切り 3 字を使う。
// 値表示と将来の書式余白を含めて保守的に 16 字を予約し、保存値は 64 字に制限する。
// 実際の label 全体が上限内かは S6 の hub backstop で検証する。
export const LIST_ROW_TEXT_MAX_LENGTH = 64;
// list 行 ID の保存検査の正本。S7 の front 採番もこの正規表現を参照し、形式の drift を防ぐ予定。
export const LIST_ROW_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const finiteNumberSchema = z.number().refine(Number.isFinite, 'must be a finite number');
// section 直下の負 parts は既存互換として残すが、行の負寄与は共有 pool の残量を全行まとめて偽るため行だけ閉じる。
const nonNegativeListPartSchema = finiteNumberSchema.refine((value) => value >= 0, 'must be greater than or equal to 0');
const partsValueSchema = z.strictObject({
  parts: z.record(z.string(), finiteNumberSchema),
});
const listPartsValueSchema = z.strictObject({
  parts: z.record(z.string(), nonNegativeListPartSchema),
}).refine(({ parts }) => {
  let total = 0;
  for (const part of Object.values(parts)) {
    total += part;
    if (!Number.isFinite(total)) return false;
  }
  return true;
}, {
  path: ['parts'],
  message: 'parts sum must be finite',
});
export function buildValueInputSchema(
  template: SheetTemplate,
): z.ZodType<Record<string, SheetValueInput>> {
  const fieldsByUid = new Map<string, SheetField>();
  for (const section of template.sections) {
    for (const field of section.fields) {
      fieldsByUid.set(field.uid, field);
    }
  }

  return z.record(z.string(), z.unknown()).superRefine((values, context) => {
    for (const [uid, value] of Object.entries(values)) {
      const field = fieldsByUid.get(uid);
      if (!field) {
        context.addIssue({
          code: 'custom',
          path: [uid],
          message: `field ${uid} is not defined by the template`,
        });
        continue;
      }

      // list 行は itemField schema が検査を所有するため、section 直下値向けの parts 系検査へ流さない。
      if (field.type !== 'list') {
        if (isPartsValue(value) && !allowsParts(field)) {
          context.addIssue({
            code: 'custom',
            path: [uid, 'parts'],
            message: `field ${uid} does not allow parts`,
          });
          continue;
        }

        const declaredPartsKeysValid = validateDeclaredPartsKeys(field, uid, value, context);
        const finitePartsSumValid = validateFinitePartsSum(uid, value, context);
        if (!declaredPartsKeysValid || !finitePartsSumValid) continue;
      }

      const schema = inputSchemaFor(field, value);
      if (!schema) {
        context.addIssue({
          code: 'custom',
          path: [uid],
          message: `field ${uid} is not an input field (${field.type})`,
        });
        continue;
      }

      const result = schema.safeParse(value);
      if (result.success) continue;
      for (const issue of result.error.issues) {
        context.addIssue({
          code: 'custom',
          path: [uid, ...issue.path],
          message: `field ${uid}: ${issue.message}`,
        });
      }
    }
  }) as z.ZodType<Record<string, SheetValueInput>>;
}

function validateDeclaredPartsKeys(
  field: SheetField,
  uid: string,
  value: unknown,
  context: z.RefinementCtx,
): boolean {
  if (!isPartsRecordValue(value)) return true;
  const parts = value.parts;

  let valid = true;
  const declaredKeys = field.type === 'scalar' && field.parts !== true && field.partsKeys !== undefined
    ? new Set([...RESERVED_PARTS_KEY_IDS, ...field.partsKeys.map(({ id }) => id)])
    : undefined;
  for (const key of Object.keys(parts)) {
    if (UNSAFE_PARTS_KEYS.has(key)) {
      context.addIssue({
        code: 'custom',
        path: [uid, 'parts', key],
        message: `field ${uid} parts.${key} is reserved`,
      });
      valid = false;
      continue;
    }
    if (declaredKeys === undefined || declaredKeys.has(key)) continue;
    context.addIssue({
      code: 'custom',
      path: [uid, 'parts', key],
      message: `field ${uid} parts.${key} is not declared`,
    });
    valid = false;
  }
  return valid;
}

function validateFinitePartsSum(
  uid: string,
  value: unknown,
  context: z.RefinementCtx,
): boolean {
  if (!isPartsRecordValue(value)) return true;
  const parts = value.parts;

  let total = 0;
  // evaluator.ts:543 と同じく、宣言拒否済みキーも含む全 own entry を逐次加算し、非有限化時に打ち切る。
  for (const part of Object.values(parts)) {
    // 個別値の型・有限性は後続 schema に任せ、キー単位 issue を維持する。
    if (typeof part !== 'number' || !Number.isFinite(part)) return true;
    total += part;
    if (Number.isFinite(total)) continue;
    context.addIssue({
      code: 'custom',
      path: [uid, 'parts'],
      message: `field ${uid} parts sum must be finite`,
    });
    return false;
  }
  return true;
}

function inputSchemaFor(field: SheetField, value: unknown): z.ZodType<SheetValueInput> | undefined {
  // list itemField 版は listItemInputSchemaFor。valueType 追加時は両関数の分岐順を揃える。
  // list は上限内の object 行配列に限定し、rowId・itemField uid・各 itemField の入力契約を行単位で検査する。
  if (field.type === 'list') {
    return listInputSchemaFor(field);
  }
  if (field.type === 'track') {
    return isPartsValue(value) ? partsValueSchema : finiteNumberSchema;
  }
  if (field.type !== 'scalar') {
    return undefined;
  }
  if (field.valueType === 'number') {
    return isPartsValue(value) ? partsValueSchema : finiteNumberSchema;
  }
  if (field.valueType === 'boolean') {
    return z.boolean();
  }
  if (field.valueType === 'select') {
    return selectInputSchemaFor(field);
  }
  return z.string();
}

function listInputSchemaFor(field: Extract<SheetField, { type: 'list' }>): z.ZodType<SheetValueInput> {
  const itemFieldsByUid = new Map(field.itemFields.map((itemField) => [itemField.uid, itemField]));

  return z.unknown().superRefine((value, context) => {
    if (!Array.isArray(value)) {
      context.addIssue({
        code: 'custom',
        message: `list ${field.uid} must be an array`,
      });
      return;
    }
    // evaluator は超過行を切って非 object 行を空行化し、annotation-runtime は非 object 行を除去する。保存境界だけは両者を拒否する。
    if (value.length > LIST_ROW_LIMIT) {
      context.addIssue({
        code: 'custom',
        path: ['length'],
        message: `list ${field.uid} must contain at most ${LIST_ROW_LIMIT} rows`,
      });
      return;
    }

    const seenRowIds = new Set<string>();
    value.forEach((candidate, rowIndex) => {
      if (!isListRowObject(candidate)) {
        // `$row` は wire に露出する診断マーカーであり、特定キーではなく行そのものの不正を指す。
        context.addIssue({
          code: 'custom',
          path: [rowIndex, '$row'],
          message: `list ${field.uid} row ${rowIndex} must be an object`,
        });
        return;
      }

      validateListRowId(field.uid, candidate, rowIndex, seenRowIds, context);
      for (const key of Object.keys(candidate)) {
        if (key === 'rowId') continue;

        // evaluator の uid -> id fallback を保存形へ持ち込むと、uid の null クリア後に id 値が復活するため uid だけを引く。
        const itemField = itemFieldsByUid.get(key);
        if (!itemField || UNSAFE_PARTS_KEYS.has(key)) {
          context.addIssue({
            code: 'custom',
            path: [rowIndex, key],
            message: `list ${field.uid} row key ${key} is not declared`,
          });
          continue;
        }

        const itemValue = candidate[key];
        if (!validateListItemDeclaredPartsKeys(field.uid, itemField, itemValue, rowIndex, context)) continue;
        const itemSchema = listItemInputSchemaFor(itemField, itemValue);
        if (!itemSchema) {
          context.addIssue({
            code: 'custom',
            path: [rowIndex, key],
            message: `list ${field.uid} row field ${key} is not an input field (${itemField.type})`,
          });
          continue;
        }

        const result = itemSchema.safeParse(itemValue);
        if (result.success) continue;
        for (const issue of result.error.issues) {
          context.addIssue({
            code: 'custom',
            path: [rowIndex, key, ...issue.path],
            message: `list ${field.uid} row field ${key}: ${issue.message}`,
          });
        }
      }
    });
  }) as z.ZodType<SheetValueInput>;
}

function validateListItemDeclaredPartsKeys(
  listUid: string,
  field: SheetField,
  value: unknown,
  rowIndex: number,
  context: z.RefinementCtx,
): boolean {
  if (field.type !== 'scalar' || field.valueType !== 'number' || field.partsKeys === undefined) return true;
  if (!isPartsRecordValue(value)) return true;

  let valid = true;
  const declaredKeys = new Set(field.partsKeys.map(({ id }) => id));
  for (const key of Object.keys(value.parts)) {
    // base / other の無宣言受理は section 直下専用。行に Discord resource 経路がない v1 では
    // other が死んだ語彙になるため、行は宣言済み pool キーだけに限定する。
    if (UNSAFE_PARTS_KEYS.has(key) || RESERVED_PARTS_KEY_ID_SET.has(key)) {
      context.addIssue({
        code: 'custom',
        path: [rowIndex, field.uid, 'parts', key],
        message: `list ${listUid} row field ${field.uid} parts.${key} is reserved`,
      });
      valid = false;
      continue;
    }
    if (declaredKeys.has(key)) continue;
    context.addIssue({
      code: 'custom',
      path: [rowIndex, field.uid, 'parts', key],
      message: `list ${listUid} row field ${field.uid} parts.${key} is not declared`,
    });
    valid = false;
  }
  return valid;
}

function isListRowObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateListRowId(
  listUid: string,
  row: Record<string, unknown>,
  rowIndex: number,
  seenRowIds: Set<string>,
  context: z.RefinementCtx,
): void {
  if (!Object.prototype.hasOwnProperty.call(row, 'rowId')) {
    context.addIssue({
      code: 'custom',
      path: [rowIndex, 'rowId'],
      message: `list ${listUid} row ${rowIndex} requires rowId`,
    });
    return;
  }

  const rowId = row.rowId;
  if (typeof rowId !== 'string' || !LIST_ROW_ID_PATTERN.test(rowId)) {
    context.addIssue({
      code: 'custom',
      path: [rowIndex, 'rowId'],
      message: `list ${listUid} rowId must match ${LIST_ROW_ID_PATTERN}`,
    });
    return;
  }
  if (UNSAFE_PARTS_KEYS.has(rowId)) {
    context.addIssue({
      code: 'custom',
      path: [rowIndex, 'rowId'],
      message: `list ${listUid} rowId ${rowId} is reserved`,
    });
  }
  if (seenRowIds.has(rowId)) {
    context.addIssue({
      code: 'custom',
      path: [rowIndex, 'rowId'],
      message: `list ${listUid} rowId ${rowId} must be unique`,
    });
  }
  seenRowIds.add(rowId);
}

function listItemInputSchemaFor(field: SheetField, value: unknown): z.ZodTypeAny | undefined {
  // section 直下版は inputSchemaFor。valueType 追加時は両関数の分岐順を揃える。
  if (field.type === 'track') {
    // 行 track に Discord +/- は到達しない設計裁定なので、意味を持たない parts 形へ保存面を広げない。
    return finiteNumberSchema;
  }
  if (field.type !== 'scalar') return undefined;
  if (field.valueType === 'number') {
    // evaluator の numberOrZero は保存済み skew への防御退化であり、入力値を 0 へ畳んで受理する根拠にはしない。
    return field.partsKeys !== undefined && isPartsValue(value) ? listPartsValueSchema : finiteNumberSchema;
  }
  if (field.valueType === 'boolean') return z.boolean();
  if (field.valueType === 'select') return selectInputSchemaFor(field);
  return z.string().max(LIST_ROW_TEXT_MAX_LENGTH);
}

function selectInputSchemaFor(field: Extract<SheetField, { type: 'scalar' }>): z.ZodType<string> {
  const options = new Set((field.options ?? []).map((option) => option.value));
  return z.string().refine((value) => options.has(value), 'must be one of the field option values');
}

export function allowsParts(field: SheetField): field is Extract<SheetField, { type: 'track' | 'scalar' }> {
  return field.type === 'track'
    || (field.type === 'scalar'
      && field.valueType === 'number'
      && (field.parts === true || field.partsKeys !== undefined));
}
