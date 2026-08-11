import {
  DEFAULT_SHEET_FIELD_LAYOUT_SPAN,
  DEFAULT_SHEET_SECTION_GRID_COLUMNS,
  SHEET_SECTION_GRID_COLUMNS,
  SHEET_SECTION_LAYOUT_PRESETS,
} from './types';
import { isSimpleField } from './layout-resolver';

const GRID_COLUMNS = new Set<unknown>(SHEET_SECTION_GRID_COLUMNS);
const SECTION_LAYOUT_PRESETS = new Set<unknown>(SHEET_SECTION_LAYOUT_PRESETS);

export function normalizeTemplateLayout<T>(template: T): T {
  if (!isRecord(template) || !Array.isArray(template.sections)) return template;

  return {
    ...template,
    sections: template.sections.map(normalizeSectionLayout),
  } as T;
}

function normalizeSectionLayout(section: unknown): unknown {
  if (!isRecord(section) || !Array.isArray(section.fields)) return section;

  const layout = section.layout;
  if (!isU14SectionLayout(layout) || layout.preset !== 'grid') return section;

  const columns = GRID_COLUMNS.has(layout.columns)
    ? layout.columns
    : DEFAULT_SHEET_SECTION_GRID_COLUMNS;

  return {
    ...section,
    layout: { ...layout, columns },
    fields: section.fields.map(normalizeGridFieldLayout),
  };
}

function normalizeGridFieldLayout(field: unknown): unknown {
  if (!isRecord(field) || !isSimpleField(field)) return field;
  if (field.layout === undefined) return { ...field, layout: { span: DEFAULT_SHEET_FIELD_LAYOUT_SPAN } };
  if (!isRecord(field.layout) || field.layout.span !== undefined) return field;

  return { ...field, layout: { ...field.layout, span: DEFAULT_SHEET_FIELD_LAYOUT_SPAN } };
}

function isU14SectionLayout(layout: unknown): layout is Record<string, unknown> {
  return isRecord(layout)
    && Object.prototype.hasOwnProperty.call(layout, 'preset')
    && SECTION_LAYOUT_PRESETS.has(layout.preset);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
