import { Button, Checkbox, NumberInput, Paper, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import {
  LIST_ROW_LIMIT,
  LIST_ROW_TEXT_MAX_LENGTH,
  type ListField,
  type SheetField
} from '@trpg/sheet-engine'
import { createStableUid } from '../../../lib/stable-uid'
import styles from '../TemplateFormRenderer.module.css'
import { ListRowPartsEditor } from './ListRowPartsEditor'
import { isFiniteNumberInput, isRecord, numberDisplayValue } from './renderer-value'

export function ListFieldEditor({
  field,
  value,
  onChange
}: {
  field: ListField
  value: unknown
  onChange?: (fieldUid: string, value: unknown) => void
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
          <ListRowPartsEditor field={field} value={value} label={label} onCellChange={onCellChange} />
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
