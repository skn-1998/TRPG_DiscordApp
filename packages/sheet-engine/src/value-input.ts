import { z } from 'zod';
import { SheetField, SheetTemplate } from './types';

export interface PartsValueInput {
  parts: Record<string, number>;
}

export type SheetValueInput = number | string | boolean | PartsValueInput;

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

      const result = schema.safeParse(value);
      if (result.success) {
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

function inputSchemaFor(field: SheetField, value: unknown): z.ZodType<SheetValueInput> | undefined {
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

function allowsParts(field: SheetField): boolean {
  return field.type === 'track'
    || (field.type === 'scalar' && field.valueType === 'number' && field.parts === true);
}

function isPartsValue(value: unknown): value is { parts: unknown } {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'parts' in value;
}
