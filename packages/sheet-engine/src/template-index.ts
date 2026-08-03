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
      const path = `${section.id}.${field.id}`;
      const locator: FieldLocator = { section, field, path };
      index.fieldsByUid.set(field.uid, locator);
      index.fieldsByPath.set(path, locator);

      if (field.type === 'list') {
        index.listsByUid.set(field.uid, locator as FieldLocator & { field: ListField });
        for (const subField of field.itemFields) {
          index.listSubFieldsByPath.set(`${section.id}.${field.id}.${subField.id}`, {
            list: field,
            field: subField,
            path: `${section.id}.${field.id}.${subField.id}`,
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
