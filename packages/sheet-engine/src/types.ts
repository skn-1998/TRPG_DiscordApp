export type RoundingMode = 'floor' | 'ceil' | 'round';

export type ScalarValueType = 'number' | 'text' | 'boolean' | 'select';
export type ComputedResultType = 'number' | 'text' | 'boolean' | 'dice';
export type ExpressionValueType = 'number' | 'text' | 'boolean' | 'dice';

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
}

export interface FieldBase {
  id: string;
  uid: string;
  label: string;
  description?: string;
  role?: FieldRole;
  visibleTo?: 'public' | 'owner' | 'gm';
  when?: string;
}

export type FieldRole =
  | { kind: 'rollable'; notation: string; group?: string; secret?: boolean }
  | { kind: 'resource'; deltas: number[]; secret?: boolean }
  | { kind: 'profile'; secret?: boolean };

export interface ScalarField extends FieldBase {
  type: 'scalar';
  valueType: ScalarValueType;
  parts?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface ComputedField extends FieldBase {
  type: 'computed';
  resultType: ComputedResultType;
  formula: string;
}

export interface RollField extends FieldBase {
  type: 'roll';
  notation: string;
  rerollable?: boolean;
}

export interface TrackField extends FieldBase {
  type: 'track';
  min?: number;
  max: number | { formula: string };
  style: 'gauge' | 'checkboxes';
  thresholds?: Array<{ at: number; label: string }>;
  resetOn?: 'scene' | 'session' | 'rest';
  resetTo?: 'zero' | 'max' | { formula: string };
}

export interface ListField extends FieldBase {
  type: 'list';
  itemFields: SheetField[];
  rowRole?: FieldRole;
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

export interface PublishValidationResult {
  ok: boolean;
  issues: PublishIssue[];
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
