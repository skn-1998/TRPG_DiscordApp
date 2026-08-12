'use client'

import { Alert, Card, SegmentedControl, Stack, Text, Title } from '@mantine/core'
import type { CharacterSheetVisibility } from '@trpg/api-contract'
import { useRef, useState, useTransition } from 'react'
import { updateSheetVisibility } from '../actions'
import { SHEET_VISIBILITY_LABELS, SHEET_VISIBILITY_NOTICE } from '../sheet-visibility'

interface SheetVisibilityToggleProps {
  characterId: string
  initialVisibility: CharacterSheetVisibility
}

const VISIBILITY_OPTIONS = [
  { value: 'private', label: SHEET_VISIBILITY_LABELS.private },
  { value: 'public', label: SHEET_VISIBILITY_LABELS.public }
]

export function SheetVisibilityToggle({ characterId, initialVisibility }: SheetVisibilityToggleProps) {
  const [visibility, setVisibility] = useState(initialVisibility)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isSubmittingRef = useRef(false)

  const handleVisibilityChange = (nextValue: string) => {
    const nextVisibility = nextValue as CharacterSheetVisibility
    if (isSubmittingRef.current || nextVisibility === visibility) return

    isSubmittingRef.current = true
    setError(null)
    startTransition(async () => {
      try {
        const result = await updateSheetVisibility(characterId, nextVisibility)
        if ('error' in result) {
          setError(result.error)
          return
        }
        setVisibility(result.visibility)
      } finally {
        isSubmittingRef.current = false
      }
    })
  }

  return (
    <Card withBorder radius="md" p="lg">
      <Stack gap="sm">
        <Title order={3}>公開設定</Title>
        <Text size="sm">現在の設定: {SHEET_VISIBILITY_LABELS[visibility]}</Text>
        <SegmentedControl
          aria-label="シートの公開設定"
          data={VISIBILITY_OPTIONS}
          value={visibility}
          disabled={isPending}
          onChange={handleVisibilityChange}
        />
        {error && (
          <Alert color="red" title="公開設定を更新できませんでした">
            {error}
          </Alert>
        )}
        <Text size="sm" c="dimmed">
          {SHEET_VISIBILITY_NOTICE}
        </Text>
      </Stack>
    </Card>
  )
}
