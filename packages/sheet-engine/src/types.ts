export type RoundingMode = 'floor' | 'ceil' | 'round';

export type ScalarValueType = 'number' | 'text' | 'boolean' | 'select';
export type ComputedResultType = 'number' | 'text' | 'boolean' | 'dice';
export type ExpressionValueType = 'number' | 'text' | 'boolean' | 'dice';
export type ConstraintSource = number | { formula: string };

export interface SheetTemplate {
  templateId: string;
  name: string;
  version: string;
  schemaVersion: 3;
  gameSystemId?: string;
  tags: string[];
  visibility: 'private' | 'unlisted' | 'public';
  authorDiscordUserId: string;
  forkedFrom?: { templateId: string; version: string };
  license?: string;
  sections: SheetSection[];
  tables: LookupTable[];
  settings: { rounding: RoundingMode };
}

export interface SheetSection {
  id: string;
  label: string;
  fields: SheetField[];
  layout?: unknown;
  blocks?: Array<{ id: string; label: string; cap?: ConstraintSource }>;
  pools?: Array<{ id: string; label: string; total: ConstraintSource; partsKey: string; scope?: string[] }>;
}

export const SHEET_SECTION_LAYOUT_PRESETS = ['stack', 'grid', 'table'] as const;
export const SHEET_SECTION_GRID_COLUMNS = [2, 3, 4] as const;
export const SHEET_FIELD_LAYOUT_SPANS = [1, 2, 3, 'full'] as const;
export const DEFAULT_SHEET_SECTION_GRID_COLUMNS: typeof SHEET_SECTION_GRID_COLUMNS[number] = 2;
export const DEFAULT_SHEET_FIELD_LAYOUT_SPAN: typeof SHEET_FIELD_LAYOUT_SPANS[number] = 1;

export interface SheetFieldLayout {
  span?: typeof SHEET_FIELD_LAYOUT_SPANS[number];
}

export interface FieldBase {
  id: string;
  uid: string;
  label: string;
  description?: string;
  role?: FieldRole;
  visibleTo?: 'public' | 'owner' | 'gm';
  when?: string;
  layout?: SheetFieldLayout;
  blockId?: string;
}

export type FieldRole =
  | { kind: 'rollable'; notation: string; group?: string; secret?: boolean }
  | { kind: 'resource'; deltas: number[]; secret?: boolean }
  | { kind: 'profile'; secret?: boolean };

/**
 * 作成時ロールの宣言。サーバーが notation をロールし、その出目を値へ反映する。
 *
 * notation は standalone roll 文法。placeholder（`{...}`）と `/` は publish が拒否する。
 * partsKey は出目の行き先となる内訳キー。publish が受理するのは field が宣言した partsKeys の id と
 * `base` だけで、`other` は拒否する（理由は publish.ts の validateRollOnCreatePartsKey のコメント）。
 * partsKey 未指定時の行き先と、出目を内訳へ書き込む処理そのものは本宣言の範囲外で、どちらも PV-R で
 * 書き込み側に実装済み。未指定を `base` へ畳む既定を決めているのも書き込み側であり、本宣言も publish も
 * その既定を決めていない。
 */
export interface RollOnCreate {
  notation: string;
  partsKey?: string;
}

export interface ScalarField extends FieldBase {
  type: 'scalar';
  valueType: ScalarValueType;
  parts?: boolean;
  max?: ConstraintSource;
  /**
   * 内訳キーの宣言。`default` は内訳の既定値で、`max` / `cap` と同じ「数値か式」型を再利用する。
   * 式は publish で number 型検査・参照解決・循環検査・ステップ見積もりの対象になる
   * （publish.ts の validateSectionFormulaAnnotations / detectCycles / estimateStaticFieldSteps）。
   * 既定値をシートの値へ適用する処理は本宣言の範囲外で、未実装（PV-2b の担当）。
   */
  partsKeys?: Array<{ id: string; label: string; default?: ConstraintSource }>;
  /** 作成時ロール。publish が受理するのは valueType === 'number' のときだけ（text/boolean/select に出目は入らない）。 */
  rollOnCreate?: RollOnCreate;
  options?: Array<{ label: string; value: string }>;
}

export interface ComputedField extends FieldBase {
  type: 'computed';
  resultType: ComputedResultType;
  formula: string;
}

export interface RollField extends FieldBase {
  type: 'roll';
  /**
   * roll 型は例外なく作成時ロール／振り直しの対象になり、対象を絞るフラグは持たない（D-11 の裁定。
   * かつて `rerollable` があったが読み手ゼロで削除）。対象判定の正本は roll-on-create.ts の rollOnCreateSpec。
   */
  notation: string;
}

export interface TrackField extends FieldBase {
  type: 'track';
  min?: number;
  max: ConstraintSource;
  style: 'gauge' | 'checkboxes';
  /**
   * 作成時にサーバーで notation をロールし、出目を track の現在値として保存する。
   * min/max は全経路で advisory とし、範囲外の出目・提出値・delta も raw のまま採用する。
   * 正本: document/character-sheet-proposals/track-roll-on-create-promotion-draft.md の「確定した裁定」。
   */
  rollOnCreate?: RollOnCreate;
  thresholds?: Array<{ at: number; label: string }>;
  resetOn?: 'scene' | 'session' | 'rest';
  resetTo?: 'zero' | 'max' | { formula: string };
}

export interface ListField extends FieldBase {
  type: 'list';
  itemFields: SheetField[];
  rowRole?: FieldRole & { labelSubFieldId: string };
}

export interface RelationField extends FieldBase {
  type: 'relation';
  targetKind?: 'character' | 'freeText';
  attrs?: ScalarField[];
}

export interface TagField extends FieldBase {
  type: 'tag';
  catalog?: string[];
  allowFreeInput?: boolean;
}

export type SheetField =
  | ScalarField
  | ComputedField
  | RollField
  | TrackField
  | ListField
  | RelationField
  | TagField;

export type LookupResultType = 'number' | 'text' | 'boolean' | 'dice';

export type LookupRow =
  | { key: string | number | boolean; result: RuntimeValueInput; resultType?: LookupResultType }
  | { min: number; max: number; result: RuntimeValueInput; resultType?: LookupResultType }
  | [string | number | boolean, RuntimeValueInput]
  | [number, number, RuntimeValueInput];

export interface LookupTable {
  id: string;
  uid?: string;
  resultType?: LookupResultType;
  rows: LookupRow[];
}

export type RuntimeValueInput = number | string | boolean | { type: ExpressionValueType; value: number | string | boolean };

export interface RuntimeValue {
  type: ExpressionValueType;
  value: number | string | boolean;
}

export interface ResolvedFieldRef {
  kind: 'field';
  path: string;
  uid: string;
}

export interface ResolvedListSubFieldRef {
  kind: 'listSubField';
  path: string;
  listUid: string;
  subFieldUid: string;
}

export type ResolvedRef = ResolvedFieldRef | ResolvedListSubFieldRef;

export interface PublishIssue {
  path: string;
  message: string;
}

export type PublishWarningCode =
  | 'block-empty'
  | 'layout-legacy-ignored'
  | 'layout-invalid-ignored'
  | 'layout-span-outside-grid'
  | 'layout-span-clamped'
  | 'layout-table-complex-demoted'
  | 'section-empty';

export interface PublishWarning {
  code: PublishWarningCode;
  path: string;
  // message は engine が著述し UI が素通し描画（annotation-runtime の AnnotationRuntimeWarning とは所有権が逆）。
  message: string;
}

export interface PublishValidationResult {
  ok: boolean;
  issues: PublishIssue[];
  warnings: PublishWarning[];
  resolvedRefs: ResolvedRef[];
}

export interface PublishValidationOptions {
  tableRowLimit?: number;
  astNodeLimit?: number;
  evaluationStepLimit?: number;
}

export interface EvaluationInput {
  values?: Record<string, unknown>;
  astNodeLimit?: number;
  evaluationStepLimit?: number;
}

export interface EvaluationResult {
  values: Record<string, RuntimeValue>;
  rows: Record<string, Array<Record<string, RuntimeValue>>>;
  evaluationOrder: string[];
  resolvedRefs: ResolvedRef[];
}

export interface NotationInterpolationResult {
  notation: string;
  refs: ResolvedRef[];
}
