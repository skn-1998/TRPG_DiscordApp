import { Button, Checkbox, Group, NumberInput, Paper, Select, Stack, Text, TextInput } from '@mantine/core'
import {
  rollOnCreateSpec,
  type ConstraintEvaluationResult,
  type ScalarField,
  type SheetField
} from '@trpg/sheet-engine'
import type { ReactNode } from 'react'
import { ListFieldEditor } from './ListFieldEditor'
import { isPartsScalarField, PartsEditorPopover } from './PartsEditorPopover'
import { isFiniteNumberInput } from './renderer-value'
import { TrackFieldView } from './TrackFieldView'

export interface CreationRollReroll {
  onRequest: (fieldUid: string) => void
  /**
   * 振り直し実行中の field uid。実行中は対象を問わず全導線を disabled にして多重送信を防ぐ
   * （TemplatePreviewV3 の rollingFieldUid と同じ扱い）。
   */
  pendingFieldUid?: string
}

export interface FieldRendererProps {
  field: SheetField
  value: unknown
  displayValue: number | undefined
  trackMax: ConstraintEvaluationResult | undefined
  onChange?: (fieldUid: string, value: unknown) => void
  onPartsChange?: (fieldUid: string, partsKey: string, value: number) => void
  renderField?: (field: SheetField, defaultNode: ReactNode) => ReactNode
  warning: string | undefined
  creationRollReroll: CreationRollReroll | undefined
  labelledBy?: string
}

export function FieldRenderer({
  field,
  value,
  displayValue,
  trackMax,
  onChange,
  onPartsChange,
  renderField,
  warning,
  creationRollReroll,
  labelledBy
}: FieldRendererProps) {
  const hasPartsEditor = isPartsScalarField(field)
  const defaultNode = hasPartsEditor ? (
    <>
      <Text fw={500} size="sm">{field.label}</Text>
      {field.description === undefined ? null : <Text c="dimmed" size="xs">{field.description}</Text>}
      <PartsEditorPopover
        field={field}
        value={value}
        displayValue={displayValue}
        onPartsChange={onPartsChange}
      />
    </>
  ) : renderDefaultField(field, value, trackMax, onChange, labelledBy)
  const control = renderField === undefined ? defaultNode : renderField(field, defaultNode)
  const rerollControl = renderCreationRollReroll(field, creationRollReroll)
  if (!hasPartsEditor && warning === undefined && rerollControl === null) return control

  return (
    <Stack gap={4}>
      {control}
      {rerollControl}
      {renderFieldWarning(field.uid, warning)}
    </Stack>
  )
}

/**
 * 作成時ロールを宣言している field にだけ振り直しボタンを描く。
 *
 * 対象かどうかの判定は engine の rollOnCreateSpec だけを使う。同じ判定を front で書き直すと、
 * 作成時の適用・server の振り直し・この表示が別々の対象集合を持ちうるため
 * （engine 側 roll-on-create.ts の「対象集合を決める述語は 1 本」）。
 * 記法も戻り値から採る（field.rollOnCreate を読み直すと 1 本化した述語がその場で分裂する）。
 */
function renderCreationRollReroll(
  field: SheetField,
  creationRollReroll: CreationRollReroll | undefined
) {
  if (creationRollReroll === undefined) return null
  const spec = rollOnCreateSpec(field)
  if (spec === undefined) return null

  const { onRequest, pendingFieldUid } = creationRollReroll
  return (
    <Group gap="xs" data-creation-roll-reroll={field.uid}>
      <Button
        aria-label={`${field.label}: 作成時ロールを振り直す`}
        disabled={pendingFieldUid !== undefined}
        loading={pendingFieldUid === field.uid}
        onClick={() => onRequest(field.uid)}
        size="xs"
        type="button"
        variant="light"
      >
        振り直す
      </Button>
      <Text c="dimmed" data-creation-roll-notation={field.uid} size="xs">{spec.notation}</Text>
    </Group>
  )
}

export function renderFieldWarning(fieldUid: string, warning: string | undefined) {
  if (warning === undefined) return null
  return <Text c="red" size="sm" data-field-constraint-warning={fieldUid}>{warning}</Text>
}

function renderDefaultField(
  field: SheetField,
  value: unknown,
  trackMax: ConstraintEvaluationResult | undefined,
  onChange: FieldRendererProps['onChange'],
  labelledBy?: string
) {
  switch (field.type) {
    case 'scalar':
      return renderScalarField(field, value, onChange, labelledBy)
    case 'list':
      return <ListFieldEditor field={field} value={value} onChange={onChange} />
    case 'track':
      return (
        <TrackFieldView
          field={field}
          rawValue={value}
          maxRuntime={trackMax ?? { status: 'indeterminate' }}
        />
      )
    case 'computed':
    case 'roll':
      return (
        <TextInput
          key={field.uid}
          {...getFieldLabelProps(field.label, labelledBy)}
          description={field.description}
          value={value === undefined ? '—' : String(value)}
          readOnly
        />
      )
    case 'relation':
    case 'tag':
      return (
        <Paper key={field.uid} p="sm" withBorder style={{ width: '100%' }} data-field-placeholder={field.type}>
          <Text fw={600}>{field.label}</Text>
          <Text size="sm" c="dimmed">
            {field.type}
          </Text>
        </Paper>
      )
  }

  const unhandledField: never = field
  return unhandledField
}

function renderScalarField(
  field: ScalarField,
  value: unknown,
  onChange: FieldRendererProps['onChange'],
  labelledBy?: string
) {
  if (field.valueType === 'number') {
    return (
      <NumberInput
        key={field.uid}
        {...getFieldLabelProps(field.label, labelledBy)}
        description={field.description}
        value={typeof value === 'number' ? value : ''}
        onChange={(nextValue) => {
          if (isFiniteNumberInput(nextValue)) onChange?.(field.uid, nextValue)
        }}
      />
    )
  }

  if (field.valueType === 'boolean') {
    return (
      <Checkbox
        key={field.uid}
        {...getFieldLabelProps(field.label, labelledBy)}
        description={field.description}
        checked={value === true}
        onChange={(event) => onChange?.(field.uid, event.currentTarget.checked)}
      />
    )
  }

  if (field.valueType === 'select') {
    return (
      <Select
        key={field.uid}
        {...getFieldLabelProps(field.label, labelledBy)}
        description={field.description}
        data={field.options ?? []}
        value={typeof value === 'string' ? value : null}
        onChange={(nextValue) => {
          if (nextValue !== null) onChange?.(field.uid, nextValue)
        }}
      />
    )
  }

  return (
    <TextInput
      key={field.uid}
      {...getFieldLabelProps(field.label, labelledBy)}
      description={field.description}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange?.(field.uid, event.currentTarget.value)}
    />
  )
}

function getFieldLabelProps(label: string, labelledBy?: string) {
  return labelledBy === undefined ? { label } : { 'aria-labelledby': labelledBy }
}
