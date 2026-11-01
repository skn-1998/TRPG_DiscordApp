import { NumberInput, Table } from '@mantine/core'
import {
  isSimpleField,
  type ConstraintEvaluationResult,
  type ScalarField,
  type SheetField
} from '@trpg/sheet-engine'
import { useId } from 'react'
import {
  FieldRenderer,
  renderFieldWarning,
  type FieldRendererProps
} from '../fields/FieldRenderer'
import {
  isNumberScalar,
  isPartsScalarField,
  PartsEditorPopover
} from '../fields/PartsEditorPopover'
import {
  isFiniteNumberInput,
  readPartValue
} from '../fields/renderer-value'
import { isPresentablePartsKey } from '../parts-key-visibility'
import styles from '../TemplateFormRenderer.module.css'

type TableFieldEntry = {
  field: SheetField
  fieldIndex: number
  displayValue: number | undefined
  trackMax: ConstraintEvaluationResult | undefined
}

type PartDefinition = NonNullable<ScalarField['partsKeys']>[number]

export function TableFieldLayout({
  fields,
  values,
  onChange,
  onPartsChange,
  renderField,
  fieldConstraintMessages,
  creationRollReroll
}: {
  fields: ReadonlyArray<TableFieldEntry>
  values: Record<string, unknown>
  onChange: FieldRendererProps['onChange']
  onPartsChange: FieldRendererProps['onPartsChange']
  renderField: FieldRendererProps['renderField']
  fieldConstraintMessages: ReadonlyMap<string, string>
  creationRollReroll: FieldRendererProps['creationRollReroll']
}) {
  const partColumns = buildTablePartColumns(fields)

  return (
    <div className={styles.tableScroll}>
      <Table withColumnBorders withTableBorder verticalSpacing="sm">
        {partColumns.length > 0 ? (
          <Table.Thead>
            <Table.Tr data-table-header-mode="parts">
              <Table.Th scope="col" data-table-column="label">項目</Table.Th>
              {partColumns.map((column) => (
                <Table.Th key={column.id} scope="col" data-table-column="part" data-parts-key={column.id}>
                  {column.label}
                </Table.Th>
              ))}
              <Table.Th scope="col" data-table-column="total">合計</Table.Th>
            </Table.Tr>
          </Table.Thead>
        ) : null}
        <Table.Tbody>
          {fields.map(({ field, fieldIndex, displayValue, trackMax }) => (
            <TableFieldRow
              key={`${field.uid}:${fieldIndex}`}
              field={field}
              value={values[field.uid]}
              displayValue={displayValue}
              trackMax={trackMax}
              partColumns={partColumns}
              onChange={onChange}
              onPartsChange={onPartsChange}
              renderField={renderField}
              warning={fieldConstraintMessages.get(field.uid)}
              creationRollReroll={creationRollReroll}
            />
          ))}
        </Table.Tbody>
      </Table>
    </div>
  )
}

function TableFieldRow({
  field,
  value,
  displayValue,
  trackMax,
  partColumns,
  onChange,
  onPartsChange,
  renderField,
  warning,
  creationRollReroll
}: {
  field: SheetField
  value: unknown
  displayValue: number | undefined
  trackMax: ConstraintEvaluationResult | undefined
  partColumns: PartDefinition[]
  onChange: FieldRendererProps['onChange']
  onPartsChange: FieldRendererProps['onPartsChange']
  renderField: FieldRendererProps['renderField']
  warning: string | undefined
  creationRollReroll: FieldRendererProps['creationRollReroll']
}) {
  const labelId = useId()

  if (isPartsScalarField(field)) {
    const usesFreeformParts = field.parts === true
    const declaredPartIds = new Set(usesFreeformParts ? [] : (field.partsKeys ?? []).map(({ id }) => id))

    return (
      <Table.Tr data-field-uid={field.uid} data-table-row-mode={usesFreeformParts ? 'parts-total' : 'parts'}>
        <Table.Th id={labelId} scope="row" data-table-column="label">{field.label}</Table.Th>
        {partColumns.map((column) => {
          const isDeclared = declaredPartIds.has(column.id)
          return (
            <Table.Td
              key={column.id}
              data-table-column="part"
              data-parts-key={column.id}
              data-parts-declared={String(isDeclared)}
            >
              {isDeclared ? (
                <NumberInput
                  aria-label={`${field.label}: ${column.label}`}
                  value={readPartValue(value, column.id)}
                  onChange={(nextValue) => {
                    if (isFiniteNumberInput(nextValue)) onPartsChange?.(field.uid, column.id, nextValue)
                  }}
                />
              ) : null}
            </Table.Td>
          )
        })}
        <Table.Td data-table-column="total">
          {/* table の宣言キーは canonical 列が編集責任を持つため、Popover は base だけを補完して重複提示を避ける。 */}
          <PartsEditorPopover
            field={field}
            value={value}
            displayValue={displayValue}
            onPartsChange={onPartsChange}
            excludedPartIds={declaredPartIds}
          />
          {renderFieldWarning(field.uid, warning)}
        </Table.Td>
      </Table.Tr>
    )
  }

  if (!isSimpleField(field)) {
    return (
      <Table.Tr data-field-uid={field.uid} data-table-row-mode="full-width">
        <Table.Td colSpan={partColumns.length + 2}>
          <FieldRenderer
            field={field}
            value={value}
            displayValue={displayValue}
            trackMax={trackMax}
            onChange={onChange}
            onPartsChange={onPartsChange}
            renderField={renderField}
            warning={warning}
            creationRollReroll={creationRollReroll}
          />
        </Table.Td>
      </Table.Tr>
    )
  }

  return (
    <Table.Tr data-field-uid={field.uid} data-table-row-mode="columns">
      <Table.Th id={labelId} scope="row" data-table-column="label">{field.label}</Table.Th>
      <Table.Td
        colSpan={partColumns.length > 0 ? partColumns.length + 1 : undefined}
        data-table-column="value"
      >
        <FieldRenderer
          field={field}
          value={value}
          displayValue={displayValue}
          trackMax={trackMax}
          onChange={onChange}
          onPartsChange={onPartsChange}
          renderField={renderField}
          warning={warning}
          creationRollReroll={creationRollReroll}
          labelledBy={labelId}
        />
      </Table.Td>
    </Table.Tr>
  )
}

function buildTablePartColumns(fields: ReadonlyArray<TableFieldEntry>): PartDefinition[] {
  const columns = new Map<string, PartDefinition>()
  for (const { field } of fields) {
    if (!isNumberScalar(field) || field.parts === true) continue
    for (const part of field.partsKeys ?? []) {
      if (!isPresentablePartsKey(part.id)) continue
      if (!columns.has(part.id)) columns.set(part.id, part)
    }
  }
  return [...columns.values()]
}
