import { evaluateConstraint } from './constraint-evaluator';
import { LIST_ROW_LIMIT, resolveNumberValue } from './evaluator';
import { isPartsRecordValue } from './parts-value';
import {
  canonicalFieldPath,
  fieldCandidateKeys,
  readAliasedValue,
} from './template-index';
import { ListField, ScalarField, SheetField, SheetSection, SheetTemplate } from './types';

// 識別子のみ・表示文言は caller 所有（publish の PublishWarning とは所有権が逆）。
export interface AnnotationRuntimeWarning {
  code:
    | 'duplicate-block-id'
    | 'duplicate-pool-id'
    | 'duplicate-parts-key-id'
    | 'missing-field-block'
    | 'missing-pool-scope-block'
    | 'missing-pool-parts-key-declaration'
    | 'pool-over'
    | 'field-over-limit';
  /** section id は template 上一意でない（publish は重複 section id を拒否しない）— 警告の帰属 section を一意に特定するキーとして使わないこと。 */
  sectionId: string;
  blockId?: string;
  poolId?: string;
  fieldUid?: string;
  partsKey?: string;
}

export type AnnotationPoolRuntime = {
  sectionId: string;
  poolId: string;
  consumed: number;
} & (
  | { status: 'ok'; total: number; remaining: number; over: boolean }
  | { status: 'indeterminate' | 'error' }
);

export type AnnotationBlockRuntime = {
  sectionId: string;
  blockId: string;
} & (
  | { status: 'ok'; cap: number }
  | { status: 'indeterminate' | 'error' }
);

export type AnnotationLimitRuntime = {
  sectionId: string;
  fieldUid: string;
  blockId?: string;
  origin: 'field' | 'block';
} & (
  | { status: 'ok'; limit: number; displayValue?: number; over: boolean }
  | { status: 'indeterminate' | 'error' }
);

export interface SectionAnnotationRuntime {
  sectionId: string;
  /** 全 first-win ブロックを宣言順で列挙する、一覧と順序の正本。 */
  blockIds: string[];
  /** cap 宣言ブロックのみを含む疎配列で、blockId により対応付ける。 */
  blocks: AnnotationBlockRuntime[];
  /**
   * section.fields と同数・同順。number scalar のエントリは表示値
   * （Σ 入力 parts・base/other 込み）を持つ — 合計列/grid 合計表示の正本。
   * raw 欠落・不正時は displayValue を省略する。
   */
  fieldBlocks: Array<{ fieldUid: string; blockId?: string; displayValue?: number }>;
  pools: AnnotationPoolRuntime[];
  limits: AnnotationLimitRuntime[];
}

export interface AnnotationRuntimeResult {
  sections: SectionAnnotationRuntime[];
  warnings: AnnotationRuntimeWarning[];
}

type SectionBlock = NonNullable<SheetSection['blocks']>[number];
type SectionPool = NonNullable<SheetSection['pools']>[number];
type ResolvedSectionNumberScalar = {
  kind: 'section-field';
  field: ScalarField;
  blockId?: string;
  partsKeys: ReadonlySet<string>;
};
type ResolvedListNumberScalar = {
  kind: 'list-item-field';
  list: ListField;
  field: ScalarField;
  blockId?: string;
  partsKeys: ReadonlySet<string>;
};
type ResolvedPoolSource = ResolvedSectionNumberScalar | ResolvedListNumberScalar;

/**
 * Resolves display-only block, pool, and effective-limit annotations for draft-safe rendering.
 * Warnings contain identifiers only; callers own all user-facing message construction.
 */
export function evaluateAnnotationRuntime(
  template: SheetTemplate,
  rawValues: Record<string, unknown> = {},
): AnnotationRuntimeResult {
  const warnings: AnnotationRuntimeWarning[] = [];
  const sections = template.sections.map((section) => evaluateSection(template, section, rawValues, warnings));
  return { sections, warnings };
}

function evaluateSection(
  template: SheetTemplate,
  section: SheetSection,
  rawValues: Record<string, unknown>,
  warnings: AnnotationRuntimeWarning[],
): SectionAnnotationRuntime {
  const blocks = new Map<string, SectionBlock>();
  for (const block of section.blocks ?? []) {
    if (blocks.has(block.id)) {
      warnings.push({ code: 'duplicate-block-id', sectionId: section.id, blockId: block.id });
    } else {
      blocks.set(block.id, block);
    }
  }
  const blockRuntimes: AnnotationBlockRuntime[] = [];
  for (const block of blocks.values()) {
    if (block.cap === undefined) continue;
    const cap = evaluateConstraint(block.cap, template, rawValues);
    blockRuntimes.push(cap.status === 'ok'
      ? { sectionId: section.id, blockId: block.id, status: 'ok', cap: cap.value }
      : { sectionId: section.id, blockId: block.id, status: cap.status });
  }

  const pools: SectionPool[] = [];
  const poolIds = new Set<string>();
  for (const pool of section.pools ?? []) {
    if (poolIds.has(pool.id)) {
      warnings.push({ code: 'duplicate-pool-id', sectionId: section.id, poolId: pool.id });
    } else {
      poolIds.add(pool.id);
      pools.push(pool);
    }
  }

  const fieldBlocks: SectionAnnotationRuntime['fieldBlocks'] = [];
  const limitSources: ResolvedSectionNumberScalar[] = [];
  // runtime 集計は行 source も含むが、pool の publish 資格・scope 充足・label 整合は
  // Q-C 裁定により section 直下だけを対象にする（publish.ts の validateSectionReferences 参照）。
  const poolSources: ResolvedPoolSource[] = [];
  for (const field of section.fields) {
    const blockId = resolveFieldBlock(section.id, field, blocks, warnings);
    const fieldBlock = blockId === undefined ? { fieldUid: field.uid } : { fieldUid: field.uid, blockId };
    if (field.type === 'list') {
      for (const itemField of field.itemFields) {
        if (!isNumberScalar(itemField)) continue;
        // scope 付き pool では行の所属を itemField ではなく、行を所有する親 list の blockId で決める。
        poolSources.push({
          kind: 'list-item-field',
          list: field,
          field: itemField,
          blockId,
          partsKeys: collectPartsKeys(section.id, itemField, warnings),
        });
      }
    }
    if (!isNumberScalar(field)) {
      fieldBlocks.push(fieldBlock);
      continue;
    }

    const raw = readRawSectionFieldValue(section.id, field, rawValues);
    if (raw === undefined) {
      fieldBlocks.push(fieldBlock);
    } else {
      try {
        fieldBlocks.push({ ...fieldBlock, displayValue: resolveNumberValue(field.uid, raw) });
      } catch {
        // limits と同じ draft-safe 規則で、不正 parts の表示値だけを省略する。
        fieldBlocks.push(fieldBlock);
      }
    }

    const resolvedField: ResolvedSectionNumberScalar = {
      kind: 'section-field', field, blockId, partsKeys: collectPartsKeys(section.id, field, warnings),
    };
    limitSources.push(resolvedField);
    poolSources.push(resolvedField);
  }

  return {
    sectionId: section.id,
    blockIds: [...blocks.keys()],
    blocks: blockRuntimes,
    fieldBlocks,
    pools: pools.map((pool) => evaluatePool(template, section.id, pool, blocks, poolSources, rawValues, warnings)),
    limits: evaluateLimits(template, section.id, blocks, limitSources, rawValues, warnings),
  };
}

function collectPartsKeys(
  sectionId: string,
  field: ScalarField,
  warnings: AnnotationRuntimeWarning[],
): ReadonlySet<string> {
  const partsKeys = new Set<string>();
  for (const part of field.partsKeys ?? []) {
    if (partsKeys.has(part.id)) {
      warnings.push({ code: 'duplicate-parts-key-id', sectionId, fieldUid: field.uid, partsKey: part.id });
    } else {
      partsKeys.add(part.id);
    }
  }
  return partsKeys;
}

function resolveFieldBlock(
  sectionId: string,
  field: SheetField,
  blocks: ReadonlyMap<string, SectionBlock>,
  warnings: AnnotationRuntimeWarning[],
): string | undefined {
  if (field.blockId === undefined) return undefined;
  if (blocks.has(field.blockId)) return field.blockId;
  warnings.push({ code: 'missing-field-block', sectionId, blockId: field.blockId, fieldUid: field.uid });
  return undefined;
}

function evaluatePool(
  template: SheetTemplate,
  sectionId: string,
  pool: SectionPool,
  blocks: ReadonlyMap<string, SectionBlock>,
  sources: ResolvedPoolSource[],
  rawValues: Record<string, unknown>,
  warnings: AnnotationRuntimeWarning[],
): AnnotationPoolRuntime {
  let scope: Set<string> | undefined;
  if (pool.scope !== undefined) {
    scope = new Set();
    for (const blockId of pool.scope) {
      if (blocks.has(blockId)) scope.add(blockId);
      else warnings.push({ code: 'missing-pool-scope-block', sectionId, poolId: pool.id, blockId });
    }
  }

  // 宣言 source のみを合算し、parts: true の自由キー一致は H-10 行3と書込契約のため除外する。
  const declaredSources = sources.filter(({ blockId, partsKeys }) =>
    (scope === undefined || (blockId !== undefined && scope.has(blockId))) && partsKeys.has(pool.partsKey));
  if (declaredSources.length === 0) {
    warnings.push({
      code: 'missing-pool-parts-key-declaration', sectionId, poolId: pool.id, partsKey: pool.partsKey,
    });
  }

  let consumed = 0;
  for (const source of declaredSources) {
    if (source.kind === 'section-field') {
      consumed = addDeclaredPart(consumed, readRawSectionFieldValue(sectionId, source.field, rawValues), pool.partsKey);
      continue;
    }
    for (const row of readListRows(sectionId, source.list, rawValues)) {
      // evaluator と同じ uid -> id 順で読む。保存境界は uid へ正規化するが、runtime は保存前 draft も受けるため両対応する。
      const raw = readAliasedValue(row, [source.field.uid, source.field.id]);
      consumed = addDeclaredPart(consumed, raw, pool.partsKey);
    }
  }

  const total = evaluateConstraint(pool.total, template, rawValues);
  if (total.status !== 'ok') return { sectionId, poolId: pool.id, consumed, status: total.status };

  const remaining = total.value - consumed;
  if (!Number.isFinite(remaining)) return { sectionId, poolId: pool.id, consumed, status: 'error' };
  const over = remaining < 0;
  if (over) warnings.push({ code: 'pool-over', sectionId, poolId: pool.id });
  return { sectionId, poolId: pool.id, consumed, status: 'ok', total: total.value, remaining, over };
}

function addDeclaredPart(consumed: number, raw: unknown, partsKey: string): number {
  if (!isPartsRecordValue(raw) || !hasOwn(raw.parts, partsKey)) return consumed;
  const partValue = raw.parts[partsKey];
  // 基本 evaluator は不正 parts を throw するが、pool 表示は draft skew を部分合算して継続する。
  if (typeof partValue !== 'number' || !Number.isFinite(partValue)) return consumed;
  const nextConsumed = consumed + partValue;
  return Number.isFinite(nextConsumed) ? nextConsumed : consumed;
}

function readListRows(
  sectionId: string,
  list: ListField,
  rawValues: Record<string, unknown>,
): Record<string, unknown>[] {
  const raw = readRawSectionFieldValue(sectionId, list, rawValues);
  if (!Array.isArray(raw)) return [];
  // evaluator は非 object 行を空行として残し、value-input は不正行と上限超過を拒否する。3 境界の退化規則は意図的に異なる。
  return raw.slice(0, LIST_ROW_LIMIT).filter(isRecord);
}

function evaluateLimits(
  template: SheetTemplate,
  sectionId: string,
  blocks: ReadonlyMap<string, SectionBlock>,
  sources: ResolvedSectionNumberScalar[],
  rawValues: Record<string, unknown>,
  warnings: AnnotationRuntimeWarning[],
): AnnotationLimitRuntime[] {
  const results: AnnotationLimitRuntime[] = [];
  for (const { field, blockId } of sources) {
    const blockCap = blockId === undefined ? undefined : blocks.get(blockId)?.cap;
    const source = field.max ?? blockCap;
    if (source === undefined) continue;

    const origin = field.max === undefined ? 'block' : 'field';
    const base = { sectionId, fieldUid: field.uid, blockId, origin } as const;
    const limit = evaluateConstraint(source, template, rawValues);
    if (limit.status !== 'ok') {
      results.push({ ...base, status: limit.status });
      continue;
    }

    const raw = readRawSectionFieldValue(sectionId, field, rawValues);
    if (raw === undefined) {
      results.push({ ...base, status: 'ok', limit: limit.value, over: false });
      continue;
    }
    let displayValue: number;
    try {
      displayValue = resolveNumberValue(field.uid, raw);
    } catch {
      // 基本 evaluator は不正 parts を拒否するが、注釈境界は当該表示だけを省略して draft preview を継続する。
      results.push({ ...base, status: 'ok', limit: limit.value, over: false });
      continue;
    }
    const over = displayValue > limit.value;
    if (over) warnings.push({ code: 'field-over-limit', sectionId, fieldUid: field.uid, blockId });
    results.push({ ...base, status: 'ok', limit: limit.value, displayValue, over });
  }
  return results;
}

function readRawSectionFieldValue(
  sectionId: string,
  field: Pick<SheetField, 'id' | 'uid'>,
  rawValues: Record<string, unknown>,
): unknown {
  return readAliasedValue(rawValues, fieldCandidateKeys(
    field.uid,
    canonicalFieldPath(sectionId, field.id),
    field.id,
  ));
}

// superset 等価 spec（field-predicates.spec / TemplateFormRenderer.spec）の deep import 用 default export。barrel（export *）非公開を保つため named export 化しない・削除不可。
export default function isNumberScalar(field: SheetField): field is ScalarField {
  // H-6: section 直下 number scalar の判定として導入し、S2 以降は pool source 解決だけが list itemField にも同じ述語を適用する。
  return field.type === 'scalar' && field.valueType === 'number';
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
