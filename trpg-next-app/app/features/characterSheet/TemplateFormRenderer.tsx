'use client'

import { Badge, Button, Checkbox, Group, NumberInput, Paper, Popover, Progress, Select, Stack, Table, Text, TextInput, Title } from '@mantine/core'
import {
  evaluateAnnotationRuntime,
  evaluateConstraint,
  isSimpleField,
  LIST_ROW_LIMIT,
  LIST_ROW_TEXT_MAX_LENGTH,
  resolveGridSpan,
  resolveSectionLayout,
  rollOnCreateSpec,
  type ConstraintEvaluationResult,
  type ListField,
  type ScalarField,
  type SectionAnnotationRuntime,
  type SheetField,
  type SheetTemplate,
  type TrackField
} from '@trpg/sheet-engine'
import {
  useId,
  useMemo,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type ReactNode,
  type SetStateAction
} from 'react'
import { createStableUid } from '../../lib/stable-uid'
import { isPresentablePartsKey } from './parts-key-visibility'
import styles from './TemplateFormRenderer.module.css'

interface TemplateFormRendererProps {
  template: SheetTemplate
  values: Record<string, unknown>
  onChange?: (fieldUid: string, value: unknown) => void
  onPartsChange?: (fieldUid: string, partsKey: string, value: number) => void
  /**
   * 呼び出し側のページ構造に section 見出しの階層を合わせる。既定値 2 は従来の h2 構造を維持する。
   */
  headingLevel?: 2 | 3
  /**
   * 呼び出し側が field 単位で描画を差し替える controlled 拡張点。既定描画を defaultNode として渡して呼ぶので、
   * 差し替えない field は defaultNode をそのまま返す。未指定なら全 field が既定描画のまま（既存呼び出し側は無影響）。
   * 例外: table layout の parts 列は行構造ごと parts 専用に組むため、この差し替えを経由しない。
   * table layout では labelledBy を渡さないため既定の aria-labelledby を再現できず、差し替え側が自前のラベルを要する。
   */
  renderField?: (field: SheetField, defaultNode: ReactNode) => ReactNode
  /**
   * 作成時ロールを宣言している field へ振り直しの導線を出す拡張点。未指定なら導線を一切描かない。
   *
   * この component は実シートの編集（CharacterSheetEditClient）とテンプレートのプレビュー
   * （TemplatePreviewV3）の 2 箇所から使われる。プレビューには保存先のキャラクターが存在しないので
   * 振り直しを出してはならず、prop を渡さないことでそれを保証する。
   *
   * この「未指定なら描かない」は TFR で初めての形。他の optional prop（onChange・onPartsChange）は
   * 未指定でも UI を描き続け、`?.()` で編集だけが無効になる。よって既存 prop の読み方をこの prop へ
   * 持ち込まないこと。保証を与えているのは renderCreationRollReroll の未指定 early return 1 行だけで、
   * spec の「creationRollReroll 未指定なら宣言済み field にも導線を描かない」と
   * 「TemplatePreviewV3 は creationRollReroll を渡さない」の 2 本がその不変条件を固定している。
   *
   * callback と実行中 uid を 1 つの prop にまとめているのは、片方だけを渡しても意味を成さない対であり、
   * かつ内部の描画関数群へ 2 本ではなく 1 本の引数として通せるため。
   */
  creationRollReroll?: CreationRollReroll
}

export interface CreationRollReroll {
  onRequest: (fieldUid: string) => void
  /**
   * 振り直し実行中の field uid。実行中は対象を問わず全導線を disabled にして多重送信を防ぐ
   * （TemplatePreviewV3 の rollingFieldUid と同じ扱い）。
   */
  pendingFieldUid?: string
}

type RenderFieldEntry = {
  field: SheetField
  fieldIndex: number
  blockId: string | undefined
  displayValue: number | undefined
  trackMax: ConstraintEvaluationResult | undefined
}

type PartDefinition = NonNullable<ScalarField['partsKeys']>[number]

// 典型的な TRPG トラック規模だけをマーク列にし、DOM 肥大を防ぐため 30 超は数値表示へ退避する。
// max <= 0 は style ごとの退避規則として、割合を描く gauge は 0% を保ち、個数を描く checkboxes は列ごと退避する。
const MAX_TRACK_CHECKBOX_MARKS = 30

export function TemplateFormRenderer({
  template,
  values,
  onChange,
  onPartsChange,
  headingLevel = 2,
  renderField,
  creationRollReroll
}: TemplateFormRendererProps) {
  const blockHeadingLevel = headingLevel === 2 ? 3 : 4
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
        const fields = buildRenderFieldEntries(section.fields, annotations, template, values)
        const fieldConstraintMessages = buildFieldConstraintMessages(annotations)

        return (
          <Stack component="section" gap="sm" key={`${section.id}:${sectionIndex}`}>
            <Title order={headingLevel}>{section.label}</Title>
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
                fieldConstraintMessages,
                blockHeadingLevel,
                creationRollReroll
              )
              : renderFieldContainer(
                fields,
                layout,
                values,
                onChange,
                onPartsChange,
                renderField,
                fieldConstraintMessages,
                creationRollReroll
              )}
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
  fieldConstraintMessages: ReadonlyMap<string, string>,
  blockHeadingLevel: 3 | 4,
  creationRollReroll: TemplateFormRendererProps['creationRollReroll']
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
          fieldConstraintMessages,
          creationRollReroll
        )
        : null}
      {[...blockGroups]
        .filter(([, { fields }]) => fields.length > 0)
        .map(([blockId, { label, fields }]) => {
          const capRuntime = annotations.blocks.find((block) => block.blockId === blockId)

          return (
            <Stack gap="xs" key={blockId}>
              {capRuntime === undefined ? (
                <Title order={blockHeadingLevel}>{label}</Title>
              ) : (
                <Group gap="xs">
                  <Title order={blockHeadingLevel}>{label}</Title>
                  {/* design-v1-ui の「制約評価 API」節 / SM-9(b): 未確定値は警告せず、評価失敗だけを制約単位で隠さず警告する。 */}
                  {capRuntime.status === 'ok' ? (
                    <Badge data-block-cap={capRuntime.cap}>上限 {capRuntime.cap}</Badge>
                  ) : capRuntime.status === 'indeterminate' ? (
                    <Badge data-block-cap="indeterminate">上限 —</Badge>
                  ) : (
                    <Text c="red" data-block-cap-error={blockId} size="sm">上限を評価できません</Text>
                  )}
                </Group>
              )}
              {renderFieldContainer(
                fields,
                layout,
                values,
                onChange,
                onPartsChange,
                renderFieldOverride,
                fieldConstraintMessages,
                creationRollReroll
              )}
            </Stack>
          )
        })}
    </>
  )
}

function buildRenderFieldEntries(
  fields: SheetField[],
  annotations: SectionAnnotationRuntime,
  template: SheetTemplate,
  values: Record<string, unknown>
): RenderFieldEntry[] {
  // fieldBlocks は engine が section.fields と同数・同順で返すため、宣言 index で対応付ける。
  return fields.map((field, fieldIndex) => ({
    field,
    fieldIndex,
    blockId: annotations.fieldBlocks[fieldIndex]?.blockId,
    displayValue: annotations.fieldBlocks[fieldIndex]?.displayValue,
    trackMax: field.type === 'track' ? evaluateConstraint(field.max, template, values) : undefined
  }))
}

function renderSectionPools(
  section: SheetTemplate['sections'][number],
  annotations: SectionAnnotationRuntime
) {
  if (annotations.pools.length === 0) return null

  const poolLabels = new Map<string, string>()
  for (const pool of section.pools ?? []) {
    if (!poolLabels.has(pool.id)) poolLabels.set(pool.id, pool.label)
  }

  return (
    <Stack gap="sm">
      {annotations.pools.map((pool) => {
        const label = poolLabels.get(pool.poolId) ?? pool.poolId

        // design-v1-ui の「制約評価 API」節 / SM-9(b): indeterminate は値だけ「—」へ退化し、error はこの pool 行だけで警告する。
        if (pool.status !== 'ok') {
          if (pool.status === 'indeterminate') {
            return (
              <Stack gap={4} key={pool.poolId} data-pool-id={pool.poolId} data-pool-status="indeterminate">
                <Text fw={600}>{label}</Text>
                <Text size="sm">残り —</Text>
              </Stack>
            )
          }
          return (
            <Stack gap={4} key={pool.poolId} data-pool-id={pool.poolId} data-pool-status="error">
              <Text fw={600}>{label}</Text>
              <Text c="red" data-pool-error={pool.poolId} size="sm">残量を評価できません</Text>
            </Stack>
          )
        }

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

function buildFieldConstraintMessages(annotations: SectionAnnotationRuntime) {
  const fieldUids = new Set<string>()
  const ambiguousFieldUids = new Set<string>()
  for (const { fieldUid } of annotations.fieldBlocks) {
    if (fieldUids.has(fieldUid)) ambiguousFieldUids.add(fieldUid)
    else fieldUids.add(fieldUid)
  }
  const messages = new Map<string, string>()

  for (const limit of annotations.limits) {
    if (ambiguousFieldUids.has(limit.fieldUid)) continue
    // design-v1-ui の「制約評価 API」節 / SM-9(b): indeterminate は超過警告を抑え、error は該当 field の近傍だけで警告する。
    if (limit.status !== 'ok') {
      if (limit.status === 'indeterminate') continue
      messages.set(limit.fieldUid, '上限を評価できません')
      continue
    }
    if (!limit.over) continue
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
  fieldConstraintMessages: ReadonlyMap<string, string>,
  creationRollReroll: TemplateFormRendererProps['creationRollReroll']
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
                  renderField={renderFieldOverride}
                  warning={fieldConstraintMessages.get(field.uid)}
                  creationRollReroll={creationRollReroll}
                />
              ))}
            </Table.Tbody>
          </Table>
        </div>
      ) : fields.map(({ field, fieldIndex, displayValue, trackMax }) => {
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
              trackMax,
              onChange,
              onPartsChange,
              renderField: renderFieldOverride,
              warning: fieldConstraintMessages.get(field.uid),
              creationRollReroll
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
  onChange: TemplateFormRendererProps['onChange']
  onPartsChange: TemplateFormRendererProps['onPartsChange']
  renderField: TemplateFormRendererProps['renderField']
  warning: string | undefined
  creationRollReroll: TemplateFormRendererProps['creationRollReroll']
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
          {renderFieldWithWarning({
            field,
            value,
            displayValue,
            trackMax,
            onChange,
            onPartsChange,
            renderField,
            warning,
            creationRollReroll
          })}
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
          trackMax,
          onChange,
          onPartsChange,
          renderField,
          warning,
          creationRollReroll,
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
      if (!isPresentablePartsKey(part.id)) continue
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

function handleTriggerKeyDown(setOpened: Dispatch<SetStateAction<boolean>>) {
  return (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpened(false)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpened((current) => !current)
    }
  }
}

/** 行用 RowPartsEditor は保存境界が base / other を拒否するため、base を常設するこの section 用 editor とは分ける。 */
function PartsEditorPopover({
  field,
  value,
  displayValue,
  onPartsChange,
  excludedPartIds
}: {
  field: ScalarField
  value: unknown
  displayValue: number | undefined
  onPartsChange: TemplateFormRendererProps['onPartsChange']
  excludedPartIds?: ReadonlySet<string>
}) {
  const [opened, setOpened] = useState(false)
  const editableParts = [
    { id: 'base', label: 'base' },
    ...buildPopoverPartRows(field, value).filter(({ id }) => !excludedPartIds?.has(id))
  ]

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
          onKeyDown={handleTriggerKeyDown(setOpened)}
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

function ListFieldEditor({
  field,
  value,
  onChange
}: {
  field: ListField
  value: unknown
  onChange: TemplateFormRendererProps['onChange']
}) {
  const rows = Array.isArray(value) ? value : []
  // roll / 入れ子 list は publish が閉じる（publish.ts:689-694）。relation / tag は publish を通るが、
  // v1 の行 UI では未対応で、保存境界も input field として拒否するため scalar / track だけを列にする。
  // computed は evaluated.rows が TFR へ配線されておらず表示値を取得できないため非描画とし、
  // 値経路を接続する将来スライスで編集不能な評価値として追加する。
  const visibleItemFields = field.itemFields.filter(
    (itemField) => itemField.type === 'track' || itemField.type === 'scalar'
  )
  // 実効上限は宣言済み rollable 数によって変わり server が原因付き 422 を返すため、front では共有の物理上限だけを扱う。
  const hasReachedRowLimit = rows.length >= LIST_ROW_LIMIT
  const rowLimitReason = `${LIST_ROW_LIMIT} 行の上限に達しています`

  const replaceItemValue = (rowIndex: number, itemFieldUid: string, nextValue: unknown) => {
    onChange?.(field.uid, replaceListRowValue(rows, rowIndex, itemFieldUid, nextValue))
  }

  return (
    <Paper key={field.uid} p="sm" withBorder style={{ width: '100%' }} data-list-field={field.uid}>
      <Stack gap="sm">
        <div>
          <Text fw={600}>{field.label}</Text>
          {field.description === undefined ? null : <Text c="dimmed" size="xs">{field.description}</Text>}
        </div>
        <div className={styles.tableScroll}>
          <Table withColumnBorders withTableBorder verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">行</Table.Th>
                {visibleItemFields.map((itemField) => (
                  <Table.Th
                    key={itemField.uid}
                    scope="col"
                    data-list-item-field-uid={itemField.uid}
                  >
                    {itemField.label}
                  </Table.Th>
                ))}
                <Table.Th scope="col">操作</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((row, rowIndex) => {
                const rowRecord = isRecord(row) ? row : {}
                const rowId = typeof rowRecord.rowId === 'string' ? rowRecord.rowId : undefined
                const rowLabel = `${field.label} ${rowIndex + 1} 行目`

                return (
                  <Table.Tr
                    key={rowId ?? `invalid-row:${rowIndex}`}
                    data-list-row-id={rowId}
                    data-list-row-index={rowIndex}
                  >
                    <Table.Th scope="row">{rowIndex + 1}</Table.Th>
                    {visibleItemFields.map((itemField) => (
                      <Table.Td key={itemField.uid} data-list-item-field-uid={itemField.uid}>
                        {renderListItemField({
                          field: itemField,
                          value: rowRecord[itemField.uid],
                          label: `${rowLabel}: ${itemField.label}`,
                          onCellChange: (nextValue) => replaceItemValue(rowIndex, itemField.uid, nextValue)
                        })}
                      </Table.Td>
                    ))}
                    <Table.Td>
                      <Button
                        aria-label={`${rowLabel}を削除`}
                        onClick={() => onChange?.(field.uid, rows.filter((_, index) => index !== rowIndex))}
                        size="xs"
                        type="button"
                        variant="light"
                      >
                        削除
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </div>
        {rows.length === 0 ? <Text c="dimmed" data-list-empty={field.uid} size="sm">行がありません</Text> : null}
        <Button
          aria-label={hasReachedRowLimit ? `${field.label}: 行を追加（${rowLimitReason}）` : `${field.label}: 行を追加`}
          disabled={hasReachedRowLimit}
          onClick={() => {
            const existingRowIds = new Set(
              rows.flatMap((row) => {
                if (!isRecord(row) || typeof row.rowId !== 'string') return []
                return [row.rowId]
              })
            )
            onChange?.(field.uid, [...rows, { rowId: createStableUid(existingRowIds, 'row') }])
          }}
          title={hasReachedRowLimit ? rowLimitReason : undefined}
          type="button"
          variant="light"
        >
          行を追加
        </Button>
      </Stack>
    </Paper>
  )
}

function renderListItemField({
  field,
  value,
  label,
  onCellChange
}: {
  field: SheetField
  value: unknown
  label: string
  onCellChange: (value: unknown) => void
}) {
  if (field.type === 'track') {
    return (
      <NumberInput
        aria-label={label}
        description={typeof field.max === 'number' ? `上限 ${field.max}（目安）` : undefined}
        value={typeof value === 'number' ? value : ''}
        onChange={(nextValue) => commitListNumberInput(nextValue, onCellChange)}
      />
    )
  }

  if (field.type !== 'scalar') return null

  if (field.valueType === 'number') {
    const isPartsValue = isRecord(value) && isRecord(value.parts)
    // parts 形は内訳経由だけで編集する。直接入力は内訳を無警告で置換し、readOnly だけでは jsdom の
    // change 発火を防げないため handler も配線しない。数値から内訳へ切替後は commit 済み合計がセルに残る。
    return (
      <Stack gap="xs">
        <NumberInput
          aria-label={label}
          value={isPartsValue ? (numberDisplayValue(value) ?? '') : (typeof value === 'number' ? value : '')}
          readOnly={isPartsValue}
          onChange={isPartsValue
            ? undefined
            : (nextValue) => commitListNumberInput(nextValue, onCellChange)}
        />
        {field.partsKeys === undefined ? null : (
          <RowPartsEditor field={field} value={value} label={label} onCellChange={onCellChange} />
        )}
      </Stack>
    )
  }

  if (field.valueType === 'boolean') {
    return (
      <Checkbox
        aria-label={label}
        checked={value === true}
        onChange={(event) => onCellChange(event.currentTarget.checked)}
      />
    )
  }

  if (field.valueType === 'select') {
    return (
      <Select
        aria-label={label}
        clearable
        data={field.options ?? []}
        value={typeof value === 'string' ? value : null}
        onChange={(nextValue) => onCellChange(nextValue === null || nextValue === '' ? undefined : nextValue)}
      />
    )
  }

  return (
    <TextInput
      aria-label={label}
      maxLength={LIST_ROW_TEXT_MAX_LENGTH}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onCellChange(event.currentTarget.value === '' ? undefined : event.currentTarget.value)}
    />
  )
}

/**
 * section 用 PartsEditorPopover は base を常設するが、行用 editor は保存境界に合わせて提示可能キーだけを所有する。
 * commitPart は宣言済み提示可能キー以外を落とし、旧公開データの修復も兼ねる。
 */
function RowPartsEditor({
  field,
  value,
  label,
  onCellChange
}: {
  field: ScalarField
  value: unknown
  label: string
  onCellChange: (value: unknown) => void
}) {
  const [opened, setOpened] = useState(false)
  const editableParts = (field.partsKeys ?? []).filter(({ id }) => isPresentablePartsKey(id))

  const commitPart = (partsKey: string, nextValue: string | number) => {
    if (nextValue !== '' && (!isFiniteNumberInput(nextValue) || nextValue < 0)) return

    const nextParts: Record<string, number> = {}
    for (const part of editableParts) {
      if (part.id === partsKey) {
        if (nextValue !== '') nextParts[part.id] = nextValue
        continue
      }
      const currentValue = readPartValue(value, part.id)
      if (currentValue !== '') nextParts[part.id] = currentValue
    }
    onCellChange(Object.keys(nextParts).length === 0 ? undefined : { parts: nextParts })
  }

  if (editableParts.length === 0) return null

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
          aria-label={`${label} の内訳を編集`}
          data-row-parts-trigger={field.uid}
          onClick={() => setOpened(true)}
          onFocus={() => setOpened(true)}
          onKeyDown={handleTriggerKeyDown(setOpened)}
          size="xs"
          type="button"
          variant="default"
        >
          内訳
        </Button>
      </Popover.Target>
      <Popover.Dropdown aria-label={`${label} の内訳`}>
        <Stack gap="xs" data-row-parts-editor={field.uid}>
          {editableParts.map((part) => (
            <NumberInput
              key={part.id}
              aria-label={`${label}: ${part.label}`}
              data-parts-key={part.id}
              label={part.label}
              min={0}
              value={readPartValue(value, part.id)}
              onChange={(nextValue) => commitPart(part.id, nextValue)}
            />
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  )
}

function commitListNumberInput(nextValue: string | number, onCellChange: (value: unknown) => void) {
  if (nextValue === '') {
    onCellChange(undefined)
  } else if (isFiniteNumberInput(nextValue)) {
    onCellChange(nextValue)
  }
}

function replaceListRowValue(
  rows: unknown[],
  rowIndex: number,
  itemFieldUid: string,
  nextValue: unknown
) {
  return rows.map((row, index) => {
    if (index !== rowIndex) return row
    const nextRow = { ...(isRecord(row) ? row : {}) }
    if (nextValue === undefined) delete nextRow[itemFieldUid]
    else nextRow[itemFieldUid] = nextValue
    return nextRow
  })
}

function buildPopoverPartRows(field: ScalarField, value: unknown): PartDefinition[] {
  if (field.parts !== true) {
    return (field.partsKeys ?? []).filter(({ id }) => isPresentablePartsKey(id))
  }
  if (!isRecord(value) || !isRecord(value.parts)) return []

  return Object.keys(value.parts)
    .filter(isPresentablePartsKey)
    .map((partsKey) => ({ id: partsKey, label: partsKey }))
}

function hasPartKey(value: unknown, partsKey: string) {
  return isRecord(value) && isRecord(value.parts) && Object.prototype.hasOwnProperty.call(value.parts, partsKey)
}

function readPartValue(value: unknown, partsKey: string): number | '' {
  if (partsKey === 'base' && typeof value === 'number' && Number.isFinite(value)) return value
  if (!isRecord(value) || !isRecord(value.parts)) return ''
  if (!Object.prototype.hasOwnProperty.call(value.parts, partsKey)) return ''
  const partValue = value.parts[partsKey]
  return typeof partValue === 'number' && Number.isFinite(partValue) ? partValue : ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** number または parts 形の有限な表示値を返し、不正値は未表示へ退化させる。 */
function numberDisplayValue(raw: unknown): number | undefined {
  // 表示専用の退化契約。保存系の有限性検査（server policy）とは役割が別で、壊れた保存値でも表示を落とさない。
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined
  if (!isRecord(raw) || !isRecord(raw.parts)) return undefined

  let total = 0
  for (const part of Object.values(raw.parts)) {
    if (typeof part !== 'number' || !Number.isFinite(part)) return undefined
    total += part
  }
  return Number.isFinite(total) ? total : undefined
}

function renderFieldWithWarning({
  field,
  value,
  displayValue,
  trackMax,
  onChange,
  onPartsChange,
  renderField: renderFieldOverride,
  warning,
  creationRollReroll,
  labelledBy
}: {
  field: SheetField
  value: unknown
  displayValue: number | undefined
  trackMax: ConstraintEvaluationResult | undefined
  onChange: TemplateFormRendererProps['onChange']
  onPartsChange: TemplateFormRendererProps['onPartsChange']
  renderField: TemplateFormRendererProps['renderField']
  warning: string | undefined
  creationRollReroll: TemplateFormRendererProps['creationRollReroll']
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
  ) : renderDefaultField(field, value, trackMax, onChange, labelledBy)
  const control = renderFieldOverride === undefined ? defaultNode : renderFieldOverride(field, defaultNode)
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
  creationRollReroll: TemplateFormRendererProps['creationRollReroll']
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

function renderFieldWarning(fieldUid: string, warning: string | undefined) {
  if (warning === undefined) return null
  return <Text c="red" size="sm" data-field-constraint-warning={fieldUid}>{warning}</Text>
}

function renderDefaultField(
  field: SheetField,
  value: unknown,
  trackMax: ConstraintEvaluationResult | undefined,
  onChange: TemplateFormRendererProps['onChange'],
  labelledBy?: string
) {
  if (field.type === 'scalar') return renderScalarField(field, value, onChange, labelledBy)

  if (field.type === 'list') return <ListFieldEditor field={field} value={value} onChange={onChange} />

  if (field.type === 'track') {
    return renderTrackField(field, value, trackMax ?? { status: 'indeterminate' })
  }

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

function renderTrackField(
  field: TrackField,
  rawValue: unknown,
  maxRuntime: ConstraintEvaluationResult
) {
  // design-v1-ui の「制約評価 API」節の numberOrZero 不変更契約により、未入力 track は engine が min 非依存で 0 評価するため、
  // evaluated 基底の preview・hub/Discord 投影と
  // 同じ表示へ揃える。定義済みだが壊れた raw は numberDisplayValue の「—」退化を維持する。
  const displayValue = rawValue === undefined ? 0 : numberDisplayValue(rawValue)
  const maxValue = maxRuntime.status === 'ok' ? maxRuntime.value : undefined
  const valueText = maxRuntime.status === 'error'
    ? String(displayValue ?? '—')
    : `${displayValue ?? '—'} / ${maxValue ?? '—'}`

  return (
    <Paper
      key={field.uid}
      p="sm"
      withBorder
      style={{ width: '100%' }}
      data-track-field={field.uid}
      data-track-max-status={maxRuntime.status}
    >
      <Stack gap={4}>
        <Text fw={600}>{field.label}</Text>
        {field.description === undefined ? null : <Text c="dimmed" size="xs">{field.description}</Text>}
        {field.style === 'gauge' ? (
          <Progress
            aria-label={`${field.label} のゲージ`}
            value={toTrackProgress(displayValue, maxValue)}
          />
        ) : null}
        {field.style === 'checkboxes' ? renderTrackCheckboxes(field, displayValue, maxValue) : null}
        <Text data-track-display-value={field.uid} size="sm">{valueText}</Text>
        {/* design-v1-ui の「制約評価 API」節 / SM-9(b): 未確定値は警告せず、評価失敗だけを制約単位で隠さず警告する。 */}
        {maxRuntime.status === 'error' ? (
          <Text c="red" data-track-max-error={field.uid} size="sm">最大値を評価できません</Text>
        ) : null}
      </Stack>
    </Paper>
  )
}

function renderTrackCheckboxes(
  field: TrackField,
  displayValue: number | undefined,
  maxValue: number | undefined
) {
  if (displayValue === undefined || maxValue === undefined) return null
  if (!Number.isInteger(maxValue) || maxValue <= 0 || maxValue > MAX_TRACK_CHECKBOX_MARKS) return null

  const checkedCount = Math.max(0, Math.min(maxValue, Math.floor(displayValue)))

  // Mantine Checkbox なら既存テーマの箱表現を保ちつつ、readOnly と tabIndex で編集用 Checkbox から分離できる。
  return (
    <Group
      aria-hidden="true"
      data-track-checkboxes={field.uid}
      gap="xs"
      wrap="wrap"
    >
      {Array.from({ length: maxValue }, (_, index) => (
        <Checkbox
          key={`${field.uid}:${index}`}
          checked={index < checkedCount}
          readOnly
          size="xs"
          tabIndex={-1}
        />
      ))}
    </Group>
  )
}

function toTrackProgress(value: number | undefined, max: number | undefined) {
  if (value === undefined || max === undefined || max <= 0) return 0
  return Math.max(0, Math.min(100, (value / max) * 100))
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
