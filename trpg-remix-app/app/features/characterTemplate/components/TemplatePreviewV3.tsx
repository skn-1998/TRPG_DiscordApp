import { useMemo, useState } from 'react'
import { Alert, Button, Checkbox, Code, Group, NumberInput, Select, Stack, Tabs, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconDice } from '@tabler/icons-react'
import type { CharacterSheetTemplateEntity, PreviewValues, SheetField } from '../types/v3'
import { rollDice } from '../utils/diceRoller'
import { evaluateTemplate } from '../utils/sheetEngine'
import { toSheetTemplate } from '../utils/v3Template'

interface TemplatePreviewV3Props {
  template: CharacterSheetTemplateEntity
}

export function TemplatePreviewV3({ template }: TemplatePreviewV3Props) {
  const [activeSectionId, setActiveSectionId] = useState(template.sections[0]?.id ?? '')
  const [values, setValues] = useState<PreviewValues>({})

  const evaluated = useMemo(() => {
    try {
      return { result: evaluateTemplate(toSheetTemplate(template), { values }), error: null }
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : '式評価に失敗しました' }
    }
  }, [template, values])

  const activeSection = template.sections.find((section) => section.id === activeSectionId) ?? template.sections[0]

  const updateValue = (uid: string, value: string | number | boolean | undefined) => {
    setValues((current) => ({ ...current, [uid]: value }))
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
      return (
        <Group key={field.uid} align="end" wrap="nowrap">
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
            onClick={() => {
              const result = rollDice(`[${field.notation}]`)
              if (result) updateValue(field.uid, result.total)
            }}
          >
            ロール
          </Button>
        </Group>
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
