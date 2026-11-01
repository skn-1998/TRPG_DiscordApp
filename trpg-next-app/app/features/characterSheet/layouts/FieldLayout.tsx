import { resolveGridSpan, type ResolvedSectionLayout } from '@trpg/sheet-engine'
import {
  FieldRenderer,
  type FieldRendererProps
} from '../fields/FieldRenderer'
import styles from '../TemplateFormRenderer.module.css'
import { TableFieldLayout } from './TableFieldLayout'

type FieldLayoutEntry = Pick<FieldRendererProps, 'field' | 'displayValue' | 'trackMax'> & {
  fieldIndex: number
}

export function FieldLayout({
  fields,
  layout,
  values,
  onChange,
  onPartsChange,
  renderField,
  fieldConstraintMessages,
  creationRollReroll
}: {
  fields: ReadonlyArray<FieldLayoutEntry>
  layout: ResolvedSectionLayout
  values: Record<string, unknown>
  onChange: FieldRendererProps['onChange']
  onPartsChange: FieldRendererProps['onPartsChange']
  renderField: FieldRendererProps['renderField']
  fieldConstraintMessages: ReadonlyMap<string, string>
  creationRollReroll: FieldRendererProps['creationRollReroll']
}) {
  return (
    <div
      className={styles.fieldContainer}
      data-layout-mode={layout.mode}
      data-grid-columns={layout.columns ?? undefined}
    >
      {layout.mode === 'table' ? (
        <TableFieldLayout
          fields={fields}
          values={values}
          onChange={onChange}
          onPartsChange={onPartsChange}
          renderField={renderField}
          fieldConstraintMessages={fieldConstraintMessages}
          creationRollReroll={creationRollReroll}
        />
      ) : fields.map(({ field, fieldIndex, displayValue, trackMax }) => {
        const span = layout.mode === 'grid' ? resolveGridSpan(field, layout.columns) : null

        return (
          <div
            key={`${field.uid}:${fieldIndex}`}
            className={span === null ? undefined : styles.gridField}
            data-field-uid={field.uid}
            data-grid-span={span ?? undefined}
          >
            <FieldRenderer
              field={field}
              value={values[field.uid]}
              displayValue={displayValue}
              trackMax={trackMax}
              onChange={onChange}
              onPartsChange={onPartsChange}
              renderField={renderField}
              warning={fieldConstraintMessages.get(field.uid)}
              creationRollReroll={creationRollReroll}
            />
          </div>
        )
      })}
    </div>
  )
}
