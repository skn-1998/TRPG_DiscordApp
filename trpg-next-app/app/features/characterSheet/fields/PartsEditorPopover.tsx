import { Button, Group, NumberInput, Popover, Stack, Text } from '@mantine/core'
import type { ScalarField, SheetField } from '@trpg/sheet-engine'
import {
  useState,
  type Dispatch,
  type KeyboardEvent,
  type SetStateAction
} from 'react'
import { isPresentablePartsKey } from '../parts-key-visibility'
import {
  hasPartKey,
  isFiniteNumberInput,
  isRecord,
  readPartValue
} from './renderer-value'

type PartDefinition = NonNullable<ScalarField['partsKeys']>[number]

export function isNumberScalar(field: SheetField): field is ScalarField {
  // engine annotation-runtime.isNumberScalar と同値である必要がある。パッケージ境界を跨ぐため統合せず、変更時は両方を更新する。
  return field.type === 'scalar' && field.valueType === 'number'
}

export function isPartsScalarField(field: SheetField): field is ScalarField {
  // engine value-input.allowsParts と同一規則だが、front は number scalar のみに絞る。変更時は両方を同期する。
  return isNumberScalar(field) && (field.parts === true || field.partsKeys !== undefined)
}

export function handleTriggerKeyDown(setOpened: Dispatch<SetStateAction<boolean>>) {
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

/** 行用 ListRowPartsEditor は保存境界が base / other を拒否するため、base を常設するこの section 用 editor とは分ける。 */
export function PartsEditorPopover({
  field,
  value,
  displayValue,
  onPartsChange,
  excludedPartIds
}: {
  field: ScalarField
  value: unknown
  displayValue: number | undefined
  onPartsChange?: (fieldUid: string, partsKey: string, value: number) => void
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

function buildPopoverPartRows(field: ScalarField, value: unknown): PartDefinition[] {
  if (field.parts !== true) {
    return (field.partsKeys ?? []).filter(({ id }) => isPresentablePartsKey(id))
  }
  if (!isRecord(value) || !isRecord(value.parts)) return []

  return Object.keys(value.parts)
    .filter(isPresentablePartsKey)
    .map((partsKey) => ({ id: partsKey, label: partsKey }))
}
