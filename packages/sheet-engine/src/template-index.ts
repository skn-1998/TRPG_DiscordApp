import {
  ComputedField,
  ListField,
  ResolvedFieldRef,
  ResolvedListSubFieldRef,
  ResolvedRef,
  SheetField,
  SheetSection,
  SheetTemplate,
} from './types';

interface FieldLocator {
  section: SheetSection;
  field: SheetField;
  path: string;
  parentList?: ListField;
}

export interface TemplateIndex {
  fieldsByUid: Map<string, FieldLocator>;
  fieldsByPath: Map<string, FieldLocator>;
  listsByUid: Map<string, FieldLocator & { field: ListField }>;
  listSubFieldsByPath: Map<string, { list: ListField; field: SheetField; path: string; listPath: string }>;
  tablesById: Map<string, SheetTemplate['tables'][number]>;
}

export function fieldCandidateKeys(uid: string, path: string, id: string): string[] {
  return [uid, path, id];
}

export function canonicalFieldPath(sectionId: string, fieldId: string): string {
  return `${sectionId}.${fieldId}`;
}

export function readAliasedValue(record: Record<string, unknown>, keys: readonly string[]): unknown {
  // Inputs must be plain/JSON objects. Exotic objects such as Proxy are unsupported because
  // own-property checks depend on getOwnPropertyDescriptor semantics.
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    const value = record[key];
    if (value != null) return value;
  }
  return undefined;
}

export function buildTemplateIndex(template: SheetTemplate): TemplateIndex {
  const index: TemplateIndex = {
    fieldsByUid: new Map(),
    fieldsByPath: new Map(),
    listsByUid: new Map(),
    listSubFieldsByPath: new Map(),
    tablesById: new Map(template.tables.map((table) => [table.id, table])),
  };

  for (const section of template.sections) {
    for (const field of section.fields) {
      const path = canonicalFieldPath(section.id, field.id);
      const locator: FieldLocator = { section, field, path };
      index.fieldsByUid.set(field.uid, locator);
      index.fieldsByPath.set(path, locator);

      if (field.type === 'list') {
        index.listsByUid.set(field.uid, locator as FieldLocator & { field: ListField });
        for (const subField of field.itemFields) {
          const subFieldPath = `${path}.${subField.id}`;
          index.listSubFieldsByPath.set(subFieldPath, {
            list: field,
            field: subField,
            path: subFieldPath,
            listPath: path,
          });
          // Short list paths are normalized by UI code before save; published
          // templates only accept canonical section.list.subField paths.
        }
      }
    }
  }

  return index;
}

export function resolveRefPath(index: TemplateIndex, path: string, parentList?: ListField): ResolvedRef {
  const parts = path.split('.');
  if (parts[0] === 'row') {
    if (!parentList || parts.length !== 2) {
      throw new Error(`Row reference is not available: ${path}`);
    }
    const subField = parentList.itemFields.find((field) => field.id === parts[1]);
    if (!subField) {
      throw new Error(`Unknown row field: ${path}`);
    }
    return { kind: 'field', path, uid: subField.uid };
  }

  const aggregate = index.listSubFieldsByPath.get(path);
  if (aggregate) {
    return {
      kind: 'listSubField',
      path: aggregate.path,
      listUid: aggregate.list.uid,
      subFieldUid: aggregate.field.uid,
    };
  }

  const field = index.fieldsByPath.get(path);
  if (!field) {
    throw new Error(`Unknown field reference: ${path}`);
  }
  return { kind: 'field', path, uid: field.field.uid };
}

export function isComputedField(field: SheetField): field is ComputedField {
  return field.type === 'computed';
}

export function refKey(ref: ResolvedRef): string {
  if (ref.kind === 'field') {
    return `field:${ref.uid}`;
  }
  return `list:${ref.listUid}.${ref.subFieldUid}`;
}
