import { Button, NumberInput, Popover, Stack } from '@mantine/core'
import type { ScalarField } from '@trpg/sheet-engine'
import { useState } from 'react'
import { isPresentablePartsKey } from '../parts-key-visibility'
import { handleTriggerKeyDown } from './PartsEditorPopover'
import { isFiniteNumberInput, readPartValue } from './renderer-value'

/**
 * section 用 PartsEditorPopover は base を常設するが、行用 editor は保存境界に合わせて提示可能キーだけを所有する。
 * commitPart は宣言済み提示可能キー以外を落とし、旧公開データの修復も兼ねる。
 */
export function ListRowPartsEditor({
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
