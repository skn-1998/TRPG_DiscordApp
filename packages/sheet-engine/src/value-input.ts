import { z } from 'zod';
import { EPSILON } from './evaluator';
import { isPartsValue } from './parts-value';
import { SheetField, SheetTemplate } from './types';

export interface PartsValueInput {
  parts: Record<string, number>;
}

export type SheetValueInput = number | string | boolean | PartsValueInput;

export const RESERVED_PARTS_KEY_IDS = Object.freeze(['base', 'other'] as const);
// publish.ts の UNSAFE_UID_KEYS と同じ prototype 汚染面を parts key 境界でも封止する。
export const UNSAFE_PARTS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const finiteNumberSchema = z.number().refine(Number.isFinite, 'must be a finite number');
const partsValueSchema = z.strictObject({
  parts: z.record(z.string(), finiteNumberSchema),
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

      if (isPartsValue(value) && !allowsParts(field)) {
        context.addIssue({
          code: 'custom',
          path: [uid, 'parts'],
          message: `field ${uid} does not allow parts`,
        });
        continue;
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

      const declaredPartsKeysValid = validateDeclaredPartsKeys(field, uid, value, context);
      const finitePartsSumValid = validateFinitePartsSum(uid, value, context);
      if (!declaredPartsKeysValid || !finitePartsSumValid) continue;

      const result = schema.safeParse(value);
      if (result.success) {
        validateTrackPartsRange(field, uid, result.data, context);
        continue;
      }
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
  if (!isPartsValue(value)) return true;
  const parts = value.parts;
  if (typeof parts !== 'object' || parts === null || Array.isArray(parts)) return true;

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
  if (!isPartsValue(value)) return true;
  const parts = value.parts;
  if (typeof parts !== 'object' || parts === null || Array.isArray(parts)) return true;

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

function validateTrackPartsRange(
  field: SheetField,
  uid: string,
  value: SheetValueInput,
  context: z.RefinementCtx,
): void {
  if (
    field.type !== 'track'
    || typeof field.max !== 'number'
    || !hasOutOfRangeNumericTrackParts(field, value)
  ) return;

  const min = field.min ?? 0;
  context.addIssue({
    code: 'custom',
    path: [uid, 'parts'],
    message: `field ${uid} parts total must be between ${min} and ${field.max}`,
  });
}

/**
 * 数値maxを持つtrack partsが範囲外かを判定する。
 * 数値maxは入力境界で早期検出し、永続化前にもservice層で同じ不変条件を確認する。
 * formula maxは他フィールドを含む評価文脈が必要なため、service層が解決・検査を担う。
 */
function hasOutOfRangeNumericTrackParts(
  field: SheetField,
  value: unknown,
): boolean {
  if (field.type !== 'track' || typeof field.max !== 'number' || !isPartsValue(value)) return false;
  const parts = (value as { parts: unknown }).parts;
  if (typeof parts !== 'object' || parts === null || Array.isArray(parts)) return false;

  const partValues = Object.values(parts);
  if (partValues.some((part) => typeof part !== 'number' || !Number.isFinite(part))) return false;
  const total = (partValues as number[]).reduce((sum, part) => sum + part, 0);
  return (field.min ?? 0) - total > EPSILON || total - field.max > EPSILON;
}

function inputSchemaFor(field: SheetField, value: unknown): z.ZodType<SheetValueInput> | undefined {
  // list 値の保存受理は v1 非対応（全拒否）。受理を導入する将来スライスで LIST_ROW_LIMIT の保存側 cap と行内容検証（itemFields 準拠・UNSAFE キー封止）をセットで設計する — D-R3-IMPL-R2 差し戻し
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
    const options = new Set((field.options ?? []).map((option) => option.value));
    return z.string().refine((value) => options.has(value), 'must be one of the field option values');
  }
  return z.string();
}

export function allowsParts(field: SheetField): field is Extract<SheetField, { type: 'track' | 'scalar' }> {
  return field.type === 'track'
    || (field.type === 'scalar'
      && field.valueType === 'number'
      && (field.parts === true || field.partsKeys !== undefined));
}
