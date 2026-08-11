import {
  DEFAULT_SHEET_FIELD_LAYOUT_SPAN,
  DEFAULT_SHEET_SECTION_GRID_COLUMNS,
  SHEET_FIELD_LAYOUT_SPANS,
  SHEET_SECTION_GRID_COLUMNS,
  SHEET_SECTION_LAYOUT_PRESETS,
  type SheetField,
} from './types';

type GridColumns = typeof SHEET_SECTION_GRID_COLUMNS[number];
type GridSpan = typeof SHEET_FIELD_LAYOUT_SPANS[number];

export type ResolvedSectionLayout =
  | { mode: 'stack' | 'table'; columns: null }
  | { mode: 'grid'; columns: GridColumns };

export function resolveSectionLayout(layout: unknown): ResolvedSectionLayout {
  if (
    !isRecord(layout)
    || !Object.prototype.hasOwnProperty.call(layout, 'preset')
    || !isTupleValue(SHEET_SECTION_LAYOUT_PRESETS, layout.preset)
  ) {
    return { mode: 'stack', columns: null };
  }
  if (layout.preset === 'table') return { mode: 'table', columns: null };
  if (layout.preset !== 'grid') return { mode: 'stack', columns: null };

  const columns = isTupleValue(SHEET_SECTION_GRID_COLUMNS, layout.columns)
    ? layout.columns
    : DEFAULT_SHEET_SECTION_GRID_COLUMNS;
  return { mode: 'grid', columns };
}

export function resolveGridSpan(field: SheetField, columns: GridColumns): GridSpan {
  if (!isSimpleField(field)) return 'full';

  const span = isRecord(field.layout) && isTupleValue(SHEET_FIELD_LAYOUT_SPANS, field.layout.span)
    ? field.layout.span
    : DEFAULT_SHEET_FIELD_LAYOUT_SPAN;

  return span === 'full' || span >= columns ? 'full' : span;
}

export function isSimpleField(field: { type?: unknown }) {
  const type = field.type;
  return type === 'scalar' || type === 'computed' || type === 'roll';
}

function isTupleValue<const Values extends readonly unknown[]>(
  values: Values,
  value: unknown,
): value is Values[number] {
  return values.some((candidate) => candidate === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
