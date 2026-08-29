'use client'

import { Alert, Button, Card, Container, Group, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconUserPlus } from '@tabler/icons-react'
import { evaluateTemplate, rollOnCreateSpec, type SheetField } from '@trpg/sheet-engine'
import Link from 'next/link'
import { useMemo, useState, useTransition, type ReactNode } from 'react'
import {
  editableListFields,
  editableScalarFields,
  listEditablePartsKeys,
  normalizeEditorValue,
  usesPartsEditor,
  writeSheetPathValue
} from '../../character/sheet-edit'
import { buildFormValues } from '../../characterSheet/form-values'
import { TemplateFormRenderer } from '../../characterSheet/TemplateFormRenderer'
import { createCharacter } from '../actions'
import type { CharacterSheetTemplateEntity } from '../types/v3'
import { toSheetTemplate } from '../utils/v3Template'

interface CharacterCreationFormProps {
  template: CharacterSheetTemplateEntity
}

type CreationOutcome =
  | { status: 'editing' }
  | { status: 'error'; message: string }
  | { status: 'created'; results: NonNullable<Awaited<ReturnType<typeof createCharacter>>['rollOnCreateResults']> }

const EMPTY_VALUES: Record<string, unknown> = {}

function renderCreationField(field: SheetField, defaultNode: ReactNode) {
  const creationRoll = rollOnCreateSpec(field)
  if (creationRoll === undefined) return defaultNode

  return (
    <TextInput
      label={field.label}
      description="作成時にサーバー側で自動ロールします"
      value={`自動ロール: ${creationRoll.notation}`}
      readOnly
    />
  )
}

export function CharacterCreationForm({ template }: CharacterCreationFormProps) {
  const [characterName, setCharacterName] = useState('')
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [outcome, setOutcome] = useState<CreationOutcome>({ status: 'editing' })
  const [isPending, startTransition] = useTransition()
  const sheetTemplate = useMemo(() => toSheetTemplate(template), [template])
  const scalarFields = useMemo(() => editableScalarFields(template), [template])
  const listFields = useMemo(() => editableListFields(template), [template])
  const scalarFieldsByUid = useMemo(
    () => new Map(scalarFields.map((field) => [field.uid, field])),
    [scalarFields]
  )
  const listFieldUids = useMemo(() => new Set(listFields.map((field) => field.uid)), [listFields])
  const templateFields = useMemo(() => template.sections.flatMap((section) => section.fields), [template])
  const creationRollFieldUids = useMemo(
    () => new Set(templateFields.filter((field) => rollOnCreateSpec(field) !== undefined).map((field) => field.uid)),
    [templateFields]
  )
  const evaluated = useMemo(() => {
    try {
      return { result: evaluateTemplate(sheetTemplate, { values }), error: null }
    } catch {
      return { result: null, error: '入力値からシートを計算できませんでした' }
    }
  }, [sheetTemplate, values])
  const formValues = useMemo(() => {
    const editorValues = { ...values }
    for (const field of templateFields) {
      if (field.type === 'computed' || field.type === 'roll') continue
      if (!(field.uid in editorValues)) editorValues[field.uid] = undefined
    }
    return buildFormValues({ evaluated: evaluated.result, fields: templateFields, values: editorValues })
  }, [evaluated.result, templateFields, values])

  const handleChange = (fieldUid: string, value: unknown) => {
    if (creationRollFieldUids.has(fieldUid)) return

    if (listFieldUids.has(fieldUid)) {
      if (!Array.isArray(value)) return
      setValues((current) => ({ ...current, [fieldUid]: value }))
      return
    }

    const field = scalarFieldsByUid.get(fieldUid)
    if (!field || usesPartsEditor(field)) return
    const normalizedValue = normalizeEditorValue(field, value)
    if (normalizedValue === undefined) return
    if (field.valueType === 'number' && !Number.isFinite(normalizedValue)) return
    setValues((current) => writeSheetPathValue(field, undefined, normalizedValue, current))
  }

  const handlePartsChange = (fieldUid: string, partsKey: string, value: number) => {
    if (creationRollFieldUids.has(fieldUid)) return

    const field = scalarFieldsByUid.get(fieldUid)
    if (!field || !usesPartsEditor(field) || !Number.isFinite(value)) return
    if (!listEditablePartsKeys(field, EMPTY_VALUES, values).includes(partsKey)) return
    setValues((current) => writeSheetPathValue(field, partsKey, value, current))
  }

  const handleSubmit = () => {
    if (isPending || !characterName.trim()) return
    setOutcome({ status: 'editing' })
    startTransition(async () => {
      const result = await createCharacter({
        templateId: template.templateId,
        templateVersion: template.version,
        characterName,
        values
      })
      if (result.error) {
        setOutcome({ status: 'error', message: result.error })
        return
      }
      setOutcome({ status: 'created', results: result.rollOnCreateResults ?? [] })
    })
  }

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="start">
          <div>
            <Title order={2}>キャラクター作成</Title>
            <Text size="sm" c="dimmed">
              {template.name} / v{template.version}
            </Text>
          </div>
          <Button component={Link} href="/templates" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
            テンプレート一覧へ
          </Button>
        </Group>

        {outcome.status === 'created' ? (
          <Card withBorder radius="md" p="lg">
            <Stack gap="md">
              <Alert color="green" title="キャラクターを作成しました">
                {outcome.results.length === 0 ? (
                  '作成が完了しました。'
                ) : (
                  <Stack gap="xs">
                    <Text size="sm">作成時の出目</Text>
                    {outcome.results.map((result) => (
                      <Text key={result.uid} size="xs">
                        {result.label}: {result.details}
                      </Text>
                    ))}
                  </Stack>
                )}
              </Alert>
              <Group justify="flex-end">
                <Button component={Link} href="/user/character">
                  キャラクター一覧へ
                </Button>
              </Group>
            </Stack>
          </Card>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              handleSubmit()
            }}
          >
            <Stack gap="lg">
              <Card withBorder radius="md" p="lg">
                <Stack gap="md">
                  <TextInput
                    label="キャラクター名"
                    value={characterName}
                    onChange={(event) => setCharacterName(event.currentTarget.value)}
                    required
                  />
                  {creationRollFieldUids.size > 0 && (
                    <Alert color="blue" title="作成時に自動決定される項目">
                      作成時ロールが設定された項目はサーバー側で決定され、この画面では変更できません。
                    </Alert>
                  )}
                  {evaluated.error && (
                    <Alert color="yellow" icon={<IconAlertCircle size={16} />} title="シート計算エラー">
                      {evaluated.error}
                    </Alert>
                  )}
                  <TemplateFormRenderer
                    template={sheetTemplate}
                    headingLevel={3}
                    values={formValues}
                    onChange={handleChange}
                    onPartsChange={handlePartsChange}
                    renderField={renderCreationField}
                  />
                </Stack>
              </Card>

              {outcome.status === 'error' && (
                <Alert color="red" icon={<IconAlertCircle size={16} />} title="作成できませんでした">
                  {outcome.message}
                </Alert>
              )}

              <Group justify="flex-end">
                <Button
                  type="submit"
                  leftSection={<IconUserPlus size={16} />}
                  loading={isPending}
                  disabled={!characterName.trim()}
                >
                  キャラクターを作成
                </Button>
              </Group>
            </Stack>
          </form>
        )}
      </Stack>
    </Container>
  )
}
