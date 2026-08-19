'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Alert, Button, Code, Group, Stack, Tabs, Text, TextInput } from '@mantine/core'
import { IconAlertCircle, IconDice } from '@tabler/icons-react'
import { evaluateTemplate } from '@trpg/sheet-engine'
import { buildFormValues } from '../../characterSheet/form-values'
import { TemplateFormRenderer } from '../../characterSheet/TemplateFormRenderer'
import type { CharacterSheetTemplateEntity, PreviewValues, SheetField } from '../types/v3'
import { buildDicePreviewRequest, requestDicePreview } from '../utils/dicePreview'
import { toSheetTemplate } from '../utils/v3Template'

interface TemplatePreviewV3Props {
  template: CharacterSheetTemplateEntity
}

export function TemplatePreviewV3({ template }: TemplatePreviewV3Props) {
  const [activeSectionId, setActiveSectionId] = useState(template.sections[0]?.id ?? '')
  const [values, setValues] = useState<PreviewValues>({})
  const [rollingFieldUid, setRollingFieldUid] = useState<string | null>(null)
  const [rollFeedback, setRollFeedback] = useState<Record<string, { details?: string; error?: string }>>({})
  const sheetTemplate = useMemo(() => toSheetTemplate(template), [template])

  const evaluated = useMemo(() => {
    try {
      return { result: evaluateTemplate(sheetTemplate, { values }), error: null }
    } catch (error) {
      return { result: null, error: error instanceof Error ? error.message : '式評価に失敗しました' }
    }
  }, [sheetTemplate, values])

  // タブ列挙と editor と一致すべき生 formula は entity 側、layout・評価用 section は変換後 template 側を正本にする。
  // toSheetTemplate が section の id・順序と field uid を保つことが、両者を突き合わせられる前提。
  const activeEntitySection = template.sections.find((section) => section.id === activeSectionId) ?? template.sections[0]
  const activeSection = sheetTemplate.sections.find((section) => section.id === activeSectionId) ?? sheetTemplate.sections[0]
  // セクション切替は preview の所掌なので、TFR へは active section だけの subset を渡す。
  // これにより TFR へ section 選択の責務を持ち込まず、タブ挙動を preview 内に閉じる。
  const activeSectionTemplate = useMemo(() => ({
    ...sheetTemplate,
    sections: activeSection === undefined
      ? []
      : [{
        ...activeSection,
        // preview の式表示は保存前の editor 入力と一致させるため、参照正規化前の entity formula を uid で対応付ける。
        fields: activeSection.fields.map((field) => {
          const entityField = activeEntitySection?.fields.find((candidate) => candidate.uid === field.uid)
          return field.type === 'computed' && entityField?.type === 'computed'
            ? { ...field, description: `式: ${entityField.formula}` }
            : field
        })
      }]
  }), [activeEntitySection, activeSection, sheetTemplate])
  // 評価値と編集値を重ねる順序は buildFormValues が持つ。updateValue が唯一の writer として undefined を
  // 弾くため、preview の values に未入力を表すキーは無く、載っているキーはすべて利用者が入れた値になる。
  // computed の失敗表示は active section の field だけを対象にする（描いていない section は表示先が無い）。
  const formValues = useMemo(
    () => buildFormValues({ evaluated: evaluated.result, fields: activeSection?.fields ?? [], values }),
    [activeSection, evaluated.result, values]
  )

  const updateValue = useCallback((uid: string, value: unknown) => {
    // 現状の TFR は primitive だけを渡すが onChange の契約は unknown なので、preview state の境界で絞る。
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return
    setValues((current) => ({ ...current, [uid]: value }))
  }, [])

  const rollField = async (field: Extract<SheetField, { type: 'roll' }>) => {
    if (rollingFieldUid !== null) return

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

    try {
      const requestResult = await requestDicePreview(builtRequest.request)

      if (requestResult.ok) {
        updateValue(field.uid, requestResult.total)
        setRollFeedback((current) => ({
          ...current,
          [field.uid]: { details: requestResult.details }
        }))
      } else {
        setRollFeedback((current) => ({
          ...current,
          [field.uid]: { error: requestResult.error }
        }))
      }
    } finally {
      setRollingFieldUid(null)
    }
  }

  // preview が自前で描くのは対話ダイスを伴う roll だけとし、それ以外は TFR の既定描画へ委譲する。
  const renderPreviewField = (field: SheetField, defaultNode: ReactNode) => {
    if (field.type === 'roll') {
      const feedback = rollFeedback[field.uid]
      const isRolling = rollingFieldUid === field.uid
      const current = formValues[field.uid]
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
              disabled={rollingFieldUid !== null}
              onClick={() => void rollField(field)}
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

    return defaultNode
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

      <TemplateFormRenderer
        template={activeSectionTemplate}
        headingLevel={3}
        values={formValues}
        onChange={updateValue}
        renderField={renderPreviewField}
      />

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
