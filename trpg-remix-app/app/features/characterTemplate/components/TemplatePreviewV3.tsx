import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Checkbox, Code, Group, NumberInput, Select, Stack, Tabs, Text, TextInput } from '@mantine/core'
import { useFetcher } from '@remix-run/react'
import { IconAlertCircle, IconDice } from '@tabler/icons-react'
import { evaluateTemplate } from '@trpg/sheet-engine'
import type { CharacterSheetTemplateEntity, PreviewValues, SheetField } from '../types/v3'
import { buildDicePreviewRequest, readDicePreviewActionData } from '../utils/dicePreview'
import { toSheetTemplate } from '../utils/v3Template'

interface TemplatePreviewV3Props {
  template: CharacterSheetTemplateEntity
}

export function TemplatePreviewV3({ template }: TemplatePreviewV3Props) {
  const fetcher = useFetcher<unknown>()
  const [activeSectionId, setActiveSectionId] = useState(template.sections[0]?.id ?? '')
  const [values, setValues] = useState<PreviewValues>({})
  const [rollingFieldUid, setRollingFieldUid] = useState<string | null>(null)
  const [rollFeedback, setRollFeedback] = useState<Record<string, { details?: string; error?: string }>>({})
  // v3_fetcherPersist では前回 data が次の submit 開始時にも残るため、non-idle → idle 遷移だけを完了として処理する。
  const previousFetcherState = useRef(fetcher.state)
  const sheetTemplate = useMemo(() => toSheetTemplate(template), [template])

  const evaluated = useMemo(() => {
    try {
      return { result: evaluateTemplate(sheetTemplate, { values }), error: null }
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : '式評価に失敗しました' }
    }
  }, [sheetTemplate, values])

  const activeSection = template.sections.find((section) => section.id === activeSectionId) ?? template.sections[0]

  const updateValue = useCallback((uid: string, value: string | number | boolean | undefined) => {
    setValues((current) => ({ ...current, [uid]: value }))
  }, [])

  useEffect(() => {
    const requestCompleted = previousFetcherState.current !== 'idle' && fetcher.state === 'idle'
    previousFetcherState.current = fetcher.state
    if (!requestCompleted || !rollingFieldUid) return

    const actionResult = readDicePreviewActionData(fetcher.data)
    if (actionResult.ok) {
      updateValue(rollingFieldUid, actionResult.result.total)
      setRollFeedback((current) => ({
        ...current,
        [rollingFieldUid]: { details: actionResult.result.details }
      }))
    } else {
      setRollFeedback((current) => ({
        ...current,
        [rollingFieldUid]: { error: actionResult.error }
      }))
    }
    setRollingFieldUid(null)
  }, [fetcher.data, fetcher.state, rollingFieldUid, updateValue])

  const rollField = (field: Extract<SheetField, { type: 'roll' }>) => {
    if (fetcher.state !== 'idle') return

    const builtRequest = buildDicePreviewRequest({
      template: sheetTemplate,
      evaluated: evaluated.result,
      notation: field.notation,
      gameSystemId: template.gameSystemId
    })
    if (!builtRequest.ok) {
      setRollFeedback((current) => ({ ...current, [field.uid]: { error: builtRequest.error } }))
      return
    }

    setRollFeedback((current) => ({ ...current, [field.uid]: {} }))
    setRollingFieldUid(field.uid)
    fetcher.submit(builtRequest.request, {
      method: 'post',
      action: '/templates/dice-preview',
      encType: 'application/json'
    })
  }

  const renderField = (field: SheetField) => {
    const runtime = evaluated.result?.values[field.uid]
    const current = values[field.uid] ?? runtime?.value

    if (field.type === 'scalar' && field.valueType === 'number') {
      return (
        <NumberInput
          key={field.uid}
          label={field.label}
          description={field.description}
          value={typeof current === 'number' ? current : undefined}
          onChange={(value) => updateValue(field.uid, typeof value === 'number' ? value : undefined)}
        />
      )
    }

    if (field.type === 'scalar' && field.valueType === 'select') {
      return (
        <Select
          key={field.uid}
          label={field.label}
          description={field.description}
          data={(field.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
          value={typeof current === 'string' ? current : ''}
          onChange={(value) => updateValue(field.uid, value ?? '')}
        />
      )
    }

    if (field.type === 'scalar' && field.valueType === 'boolean') {
      return (
        <Checkbox
          key={field.uid}
          label={field.label}
          description={field.description}
          checked={Boolean(current)}
          onChange={(event) => updateValue(field.uid, event.currentTarget.checked)}
        />
      )
    }

    if (field.type === 'computed') {
      return (
        <TextInput
          key={field.uid}
          label={field.label}
          description={`式: ${field.formula}`}
          value={runtime ? String(runtime.value) : 'Error'}
          readOnly
        />
      )
    }

    if (field.type === 'roll') {
      const feedback = rollFeedback[field.uid]
      const isRolling = rollingFieldUid === field.uid && fetcher.state !== 'idle'
      return (
        <Stack key={field.uid} gap={4}>
          <Group align="end" wrap="nowrap">
            <TextInput
              label={field.label}
              description={`記法: ${field.notation}`}
              value={current == null ? '' : String(current)}
              onChange={(event) => updateValue(field.uid, event.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Button
              type="button"
              variant="outline"
              leftSection={<IconDice size={16} />}
              loading={isRolling}
              disabled={fetcher.state !== 'idle'}
              onClick={() => rollField(field)}
            >
              {isRolling ? 'ロール中' : 'ロール'}
            </Button>
          </Group>
          {feedback?.details && (
            <Text size="xs" c="dimmed">
              結果: {feedback.details}
            </Text>
          )}
          {feedback?.error && (
            <Text size="xs" c="red" role="alert">
              {feedback.error}
            </Text>
          )}
        </Stack>
      )
    }

    return (
      <TextInput
        key={field.uid}
        label={field.label}
        description={field.description}
        value={typeof current === 'string' ? current : ''}
        onChange={(event) => updateValue(field.uid, event.currentTarget.value)}
      />
    )
  }

  if (!activeSection) {
    return <Alert color="yellow">セクションがありません。</Alert>
  }

  return (
    <Stack gap="md">
      {evaluated.error && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="式評価エラー">
          {evaluated.error}
        </Alert>
      )}

      <Tabs value={activeSection.id} onChange={(value) => value && setActiveSectionId(value)}>
        <Tabs.List>
          {template.sections.map((section) => (
            <Tabs.Tab key={section.id} value={section.id}>
              {section.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Stack gap="sm">{activeSection.fields.map(renderField)}</Stack>

      <details>
        <summary style={{ cursor: 'pointer' }}>
          <Text component="span" size="sm" fw={600}>
            入力値
          </Text>
        </summary>
        <Code block mt="sm">
          {JSON.stringify(values, null, 2)}
        </Code>
      </details>
    </Stack>
  )
}
