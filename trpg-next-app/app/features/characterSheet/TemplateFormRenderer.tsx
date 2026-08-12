import { Badge, Button, Checkbox, Group, NumberInput, Paper, Popover, Progress, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import {
  RESERVED_PARTS_KEY_IDS,
  UNSAFE_PARTS_KEYS,
  evaluateAnnotationRuntime,
  isSimpleField,
  resolveGridSpan,
  resolveSectionLayout,
  type ScalarField,
  type SectionAnnotationRuntime,
  type SheetField,
  type SheetTemplate
} from '@trpg/sheet-engine'
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './TemplateFormRenderer.module.css'

interface TemplateFormRendererProps {
  template: SheetTemplate
  values: Record<string, unknown>
  onChange?: (fieldUid: string, value: unknown) => void
  onPartsChange?: (fieldUid: string, partsKey: string, value: number) => void
  /**
   * 呼び出し側が field 単位で描画を差し替える controlled 拡張点。既定描画を defaultNode として渡して呼ぶので、
   * 差し替えない field は defaultNode をそのまま返す。未指定なら全 field が既定描画のまま（既存呼び出し側は無影響）。
   * 例外: table layout の parts 列は行構造ごと parts 専用に組むため、この差し替えを経由しない。
   * table layout では labelledBy を渡さないため既定の aria-labelledby を再現できず、差し替え側が自前のラベルを要する。
   */
  renderField?: (field: SheetField, defaultNode: ReactNode) => ReactNode
}

type RenderFieldEntry = {
  field: SheetField
  fieldIndex: number
  blockId: string | undefined
  displayValue: number | undefined
}

type PartDefinition = NonNullable<ScalarField['partsKeys']>[number]

export function TemplateFormRenderer({
  template,
  values,
  onChange,
  onPartsChange,
  renderField
}: TemplateFormRendererProps) {
  const annotationRuntime = useMemo(
    () => evaluateAnnotationRuntime(template, values),
    [template, values]
  )
  return (
    <Stack gap="lg">
      {template.sections.map((section, sectionIndex) => {
        if (section.fields.length === 0) return null

        const layout = resolveSectionLayout(section.layout)
        const annotations = annotationRuntime.sections[sectionIndex]
        const fields = buildRenderFieldEntries(section.fields, annotations)
        const overLimitMessages = buildOverLimitMessages(annotations)

        return (
          <Stack component="section" gap="sm" key={`${section.id}:${sectionIndex}`}>
            <Title order={2}>{section.label}</Title>
            {renderSectionPools(section, annotations)}
            {annotations.blockIds.length > 0
              ? renderBlockGroups(
                section,
                fields,
                layout,
                values,
                onChange,
                onPartsChange,
                renderField,
                annotations,
                overLimitMessages
              )
              : renderFieldContainer(fields, layout, values, onChange, onPartsChange, renderField, overLimitMessages)}
          </Stack>
        )
      })}
    </Stack>
  )
}

function renderBlockGroups(
  section: SheetTemplate['sections'][number],
  fields: RenderFieldEntry[],
  layout: ReturnType<typeof resolveSectionLayout>,
  values: Record<string, unknown>,
  onChange: TemplateFormRendererProps['onChange'],
  onPartsChange: TemplateFormRendererProps['onPartsChange'],
  renderFieldOverride: TemplateFormRendererProps['renderField'],
  annotations: SectionAnnotationRuntime,
  overLimitMessages: ReadonlyMap<string, string>
) {
  const blockLabels = new Map<string, string>()
  for (const block of section.blocks ?? []) {
    if (!blockLabels.has(block.id)) blockLabels.set(block.id, block.label)
  }

  const blockGroups = new Map<string, { label: string; fields: RenderFieldEntry[] }>()
  for (const blockId of annotations.blockIds) {
    blockGroups.set(blockId, { label: blockLabels.get(blockId) as string, fields: [] })
  }
  const defaultFields: RenderFieldEntry[] = []
  for (const entry of fields) {
    if (entry.blockId === undefined) defaultFields.push(entry)
    else blockGroups.get(entry.blockId)?.fields.push(entry)
  }

  return (
    <>
      {defaultFields.length > 0
        ? renderFieldContainer(
          defaultFields,
          layout,
          values,
          onChange,
          onPartsChange,
          renderFieldOverride,
          overLimitMessages
        )
        : null}
      {[...blockGroups]
        .filter(([, { fields }]) => fields.length > 0)
        .map(([blockId, { label, fields }]) => {
          const capRuntime = annotations.blocks.find((block) => block.blockId === blockId)
          const cap = capRuntime?.status === 'ok' ? capRuntime.cap : undefined

          return (
            <Stack gap="xs" key={blockId}>
              {cap === undefined ? (
                <Title order={3}>{label}</Title>
              ) : (
                <Group gap="xs">
                  <Title order={3}>{label}</Title>
                  <Badge data-block-cap={cap}>上限 {cap}</Badge>
                </Group>
              )}
              {renderFieldContainer(
                fields,
                layout,
                values,
                onChange,
                onPartsChange,
                renderFieldOverride,
                overLimitMessages
              )}
            </Stack>
          )
        })}
    </>
  )
}

function buildRenderFieldEntries(
  fields: SheetField[],
  annotations: SectionAnnotationRuntime
): RenderFieldEntry[] {
  // fieldBlocks は engine が section.fields と同数・同順で返すため、宣言 index で対応付ける。
  return fields.map((field, fieldIndex) => ({
    field,
    fieldIndex,
    blockId: annotations.fieldBlocks[fieldIndex]?.blockId,
    displayValue: annotations.fieldBlocks[fieldIndex]?.displayValue
  }))
}

function renderSectionPools(
  section: SheetTemplate['sections'][number],
  annotations: SectionAnnotationRuntime
) {
  const visiblePools = annotations.pools.filter((pool) => pool.status === 'ok')
  if (visiblePools.length === 0) return null

  const poolLabels = new Map<string, string>()
  for (const pool of section.pools ?? []) {
    if (!poolLabels.has(pool.id)) poolLabels.set(pool.id, pool.label)
  }

  return (
    <Stack gap="sm">
      {visiblePools.map((pool) => {
        const label = poolLabels.get(pool.poolId) ?? pool.poolId
        const isOver = pool.over

        return (
          <Stack gap={4} key={pool.poolId} data-pool-id={pool.poolId} data-pool-status={isOver ? 'danger' : 'ok'}>
            <Text fw={600}>{label}</Text>
            <Progress
              aria-label={`${label} の予算使用率`}
              color={isOver ? 'red' : 'blue'}
              value={toPoolProgress(pool.consumed, pool.total)}
            />
            <Text c={isOver ? 'red' : undefined} size="sm">
              {isOver ? `超過 ${Math.abs(pool.remaining)}` : `残り ${pool.remaining} / ${pool.total}`}
            </Text>
          </Stack>
        )
      })}
    </Stack>
  )
}

function toPoolProgress(consumed: number, total: number) {
  const percentage = (consumed / total) * 100
  // 非有限値は engine が error へ退化するため、NaN 防御の実効域は consumed=0 かつ total=0 の縁だけ。
  return Number.isNaN(percentage) ? 0 : Math.max(0, Math.min(100, percentage))
}

function buildOverLimitMessages(annotations: SectionAnnotationRuntime) {
  const fieldUids = new Set<string>()
  const ambiguousFieldUids = new Set<string>()
  for (const { fieldUid } of annotations.fieldBlocks) {
    if (fieldUids.has(fieldUid)) ambiguousFieldUids.add(fieldUid)
    else fieldUids.add(fieldUid)
  }
  const messages = new Map<string, string>()

  for (const limit of annotations.limits) {
    if (
      limit.status !== 'ok' ||
      ambiguousFieldUids.has(limit.fieldUid) ||
      !limit.over
    ) continue
    messages.set(limit.fieldUid, `上限 ${limit.limit} を超えています（現在 ${limit.displayValue}）`)
  }

  return messages
}

function renderFieldContainer(
  fields: RenderFieldEntry[],
  layout: ReturnType<typeof resolveSectionLayout>,
  values: Record<string, unknown>,
  onChange: TemplateFormRendererProps['onChange'],
  onPartsChange: TemplateFormRendererProps['onPartsChange'],
  renderFieldOverride: TemplateFormRendererProps['renderField'],
  overLimitMessages: ReadonlyMap<string, string>
) {
  const partColumns = layout.mode === 'table' ? buildTablePartColumns(fields) : []

  return (
    <div
      className={styles.fieldContainer}
      data-layout-mode={layout.mode}
      data-grid-columns={layout.columns ?? undefined}
    >
      {layout.mode === 'table' ? (
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
              {fields.map(({ field, fieldIndex, displayValue }) => (
                <TableFieldRow
                  key={`${field.uid}:${fieldIndex}`}
                  field={field}
                  value={values[field.uid]}
                  displayValue={displayValue}
                  partColumns={partColumns}
                  onChange={onChange}
                  onPartsChange={onPartsChange}
                  renderField={renderFieldOverride}
                  warning={overLimitMessages.get(field.uid)}
                />
              ))}
            </Table.Tbody>
          </Table>
        </div>
      ) : fields.map(({ field, fieldIndex, displayValue }) => {
        const span = layout.mode === 'grid' ? resolveGridSpan(field, layout.columns) : null

        return (
          <div
            key={`${field.uid}:${fieldIndex}`}
            className={span === null ? undefined : styles.gridField}
            data-field-uid={field.uid}
            data-grid-span={span ?? undefined}
          >
            {renderFieldWithWarning({
              field,
              value: values[field.uid],
              displayValue,
              onChange,
              onPartsChange,
              renderField: renderFieldOverride,
              warning: overLimitMessages.get(field.uid)
            })}
          </div>
        )
      })}
    </div>
  )
}

function TableFieldRow({
  field,
  value,
  displayValue,
  partColumns,
  onChange,
  onPartsChange,
  renderField,
  warning
}: {
  field: SheetField
  value: unknown
  displayValue: number | undefined
  partColumns: PartDefinition[]
  onChange: TemplateFormRendererProps['onChange']
  onPartsChange: TemplateFormRendererProps['onPartsChange']
  renderField: TemplateFormRendererProps['renderField']
  warning: string | undefined
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
          {usesFreeformParts ? (
            <PartsEditorPopover
              field={field}
              value={value}
              displayValue={displayValue}
              onPartsChange={onPartsChange}
            />
          ) : (
            <Text component="span" data-field-display-value={field.uid}>{displayValue ?? ''}</Text>
          )}
          {renderFieldWarning(field.uid, warning)}
        </Table.Td>
      </Table.Tr>
    )
  }

  if (!isSimpleField(field)) {
    return (
      <Table.Tr data-field-uid={field.uid} data-table-row-mode="full-width">
        <Table.Td colSpan={partColumns.length + 2}>
          {renderFieldWithWarning({ field, value, displayValue, onChange, onPartsChange, renderField, warning })}
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
        {renderFieldWithWarning({
          field,
          value,
          displayValue,
          onChange,
          onPartsChange,
          renderField,
          warning,
          labelledBy: labelId
        })}
      </Table.Td>
    </Table.Tr>
  )
}

function buildTablePartColumns(fields: RenderFieldEntry[]): PartDefinition[] {
  const columns = new Map<string, PartDefinition>()
  for (const { field } of fields) {
    if (!isNumberScalar(field) || field.parts === true) continue
    for (const part of field.partsKeys ?? []) {
      if (!columns.has(part.id)) columns.set(part.id, part)
    }
  }
  return [...columns.values()]
}

function isNumberScalar(field: SheetField): field is ScalarField {
  // engine annotation-runtime.isNumberScalar と同値である必要がある。パッケージ境界を跨ぐため統合せず、変更時は両方を更新する。
  return field.type === 'scalar' && field.valueType === 'number'
}

function isPartsScalarField(field: SheetField): field is ScalarField {
  // engine value-input.allowsParts と同一規則だが、front は number scalar のみに絞る。変更時は両方を同期する。
  return isNumberScalar(field) && (field.parts === true || field.partsKeys !== undefined)
}

function isFiniteNumberInput(value: string | number): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function PartsEditorPopover({
  field,
  value,
  displayValue,
  onPartsChange
}: {
  field: ScalarField
  value: unknown
  displayValue: number | undefined
  onPartsChange: TemplateFormRendererProps['onPartsChange']
}) {
  const [opened, setOpened] = useState(false)
  const editableParts = [
    { id: 'base', label: 'base' },
    ...buildPopoverPartRows(field, value)
  ]
  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpened(false)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpened((current) => !current)
    }
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      shadow="md"
      withinPortal={false}
      width="target"
    >
      <Popover.Target>
        <Button
          aria-label={`${field.label}: 内訳を編集`}
          data-parts-popover-trigger={field.uid}
          fullWidth
          onClick={() => setOpened(true)}
          onFocus={() => setOpened(true)}
          onKeyDown={handleTriggerKeyDown}
          type="button"
          variant="default"
        >
          <Text component="span" data-field-display-value={field.uid}>{displayValue ?? ''}</Text>
        </Button>
      </Popover.Target>
      <Popover.Dropdown aria-label={`${field.label} の内訳`}>
        <Stack gap="xs" data-parts-popover={field.uid}>
          {editableParts.map((part, partIndex) => (
            <NumberInput
              key={`${part.id}:${partIndex}`}
              aria-label={`${field.label}: ${part.label}`}
              data-parts-key={part.id}
              label={part.label}
              value={readPartValue(value, part.id)}
              onChange={(nextValue) => {
                if (isFiniteNumberInput(nextValue)) onPartsChange?.(field.uid, part.id, nextValue)
              }}
            />
          ))}
          {hasPartKey(value, 'other') ? (
            <Group data-parts-key="other" data-parts-readonly="true" justify="space-between">
              <Text size="sm">other</Text>
              <Text data-parts-value="other" size="sm">{readPartValue(value, 'other')}</Text>
            </Group>
          ) : null}
          <Group data-parts-total="true" justify="space-between">
            <Text fw={500} size="sm">合計</Text>
            <Text size="sm">{displayValue ?? ''}</Text>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function buildPopoverPartRows(field: ScalarField, value: unknown): PartDefinition[] {
  if (field.parts !== true) {
    return (field.partsKeys ?? []).filter(({ id }) => !isReservedPartsKey(id))
  }
  if (!isRecord(value) || !isRecord(value.parts)) return []

  return Object.keys(value.parts)
    .filter((partsKey) => !isReservedPartsKey(partsKey) && !UNSAFE_PARTS_KEYS.has(partsKey))
    .map((partsKey) => ({ id: partsKey, label: partsKey }))
}

function isReservedPartsKey(partsKey: string) {
  return RESERVED_PARTS_KEY_IDS.some((reservedKey) => reservedKey === partsKey)
}

function hasPartKey(value: unknown, partsKey: string) {
  return isRecord(value) && isRecord(value.parts) && Object.prototype.hasOwnProperty.call(value.parts, partsKey)
}

function readPartValue(value: unknown, partsKey: string): number | '' {
  if (!isRecord(value) || !isRecord(value.parts)) return ''
  if (!Object.prototype.hasOwnProperty.call(value.parts, partsKey)) return ''
  const partValue = value.parts[partsKey]
  return typeof partValue === 'number' && Number.isFinite(partValue) ? partValue : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function renderFieldWithWarning({
  field,
  value,
  displayValue,
  onChange,
  onPartsChange,
  renderField: renderFieldOverride,
  warning,
  labelledBy
}: {
  field: SheetField
  value: unknown
  displayValue: number | undefined
  onChange: TemplateFormRendererProps['onChange']
  onPartsChange: TemplateFormRendererProps['onPartsChange']
  renderField: TemplateFormRendererProps['renderField']
  warning: string | undefined
  labelledBy?: string
}) {
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
  ) : renderDefaultField(field, value, onChange, labelledBy)
  const control = renderFieldOverride === undefined ? defaultNode : renderFieldOverride(field, defaultNode)
  if (!hasPartsEditor && warning === undefined) return control

  return (
    <Stack gap={4}>
      {control}
      {renderFieldWarning(field.uid, warning)}
    </Stack>
  )
}

function renderFieldWarning(fieldUid: string, warning: string | undefined) {
  if (warning === undefined) return null
  return <Text c="red" size="sm" data-field-over-limit={fieldUid}>{warning}</Text>
}

function renderDefaultField(
  field: SheetField,
  value: unknown,
  onChange: TemplateFormRendererProps['onChange'],
  labelledBy?: string
) {
  if (field.type === 'scalar') return renderScalarField(field, value, onChange, labelledBy)

  if (field.type === 'computed' || field.type === 'roll') {
    return (
      <TextInput
        key={field.uid}
        {...getFieldLabelProps(field.label, labelledBy)}
        description={field.description}
        value={value === undefined ? '—' : String(value)}
        readOnly
      />
    )
  }

  return (
    <Paper key={field.uid} p="sm" withBorder style={{ width: '100%' }} data-field-placeholder={field.type}>
      <Text fw={600}>{field.label}</Text>
      <Text size="sm" c="dimmed">
        {field.type}
      </Text>
    </Paper>
  )
}

function renderScalarField(
  field: ScalarField,
  value: unknown,
  onChange: TemplateFormRendererProps['onChange'],
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
