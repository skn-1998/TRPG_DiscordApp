'use client'

import { Alert, Button, Card, Container, Group, Radio, Stack, Text, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import type { CharacterWire, SheetMergeConflictWire } from '@trpg/api-contract'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'
import type { CharacterSheetTemplateEntity } from '../../characterTemplate/types/v3'
import { TemplateFormRenderer } from '../../characterSheet/TemplateFormRenderer'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { saveSheet } from '../actions'
import {
  deriveSheetChanges,
  editableScalarFields,
  GENERIC_SHEET_CONFLICT_MESSAGE,
  listEditablePartsKeys,
  normalizeEditorValue,
  readSheetPathValue,
  usesPartsEditor,
  writeSheetPathValue,
  type EditableScalarField,
  type EditorValue
} from '../sheet-edit'

interface CharacterSheetEditClientProps {
  character: CharacterWire
  template: CharacterSheetTemplateEntity
}

type SheetActionData = Awaited<ReturnType<typeof saveSheet>>

type ConflictResolution = 'theirs' | 'mine'

interface EditorConflict {
  id: string
  field: EditableScalarField
  partsKey: string | undefined
  current: EditorValue
}

interface ConflictPanelState {
  currentRevision: number
  conflicts: EditorConflict[]
  selections: Record<string, ConflictResolution>
}

function createConflictPanel(
  payload: SheetMergeConflictWire,
  fields: EditableScalarField[]
): ConflictPanelState | null {
  const fieldsByUid = new Map(fields.map((field) => [field.uid, field]))
  const conflicts = payload.conflicts.flatMap<EditorConflict>((conflict, index) => {
    const field = fieldsByUid.get(conflict.path.fieldUid)
    if (!field) return []
    return [{
      id: `${conflict.path.fieldUid}:${conflict.path.partsKey ?? ''}:${index}`,
      field,
      partsKey: conflict.path.partsKey,
      current: normalizeEditorValue(field, conflict.current)
    }]
  })
  return conflicts.length > 0 ? { currentRevision: payload.currentRevision, conflicts, selections: {} } : null
}

function formatEditorValue(field: EditableScalarField, value: EditorValue): string {
  if (field.valueType === 'select' && typeof value === 'string') {
    return field.options?.find((option) => option.value === value)?.label ?? String(value)
  }
  if (typeof value === 'boolean') return value ? 'チェックあり' : 'チェックなし'
  return value === undefined ? '未入力' : value === '' ? '空文字' : String(value)
}

export function CharacterSheetEditClient({ character, template }: CharacterSheetEditClientProps) {
  const fields = useMemo(() => editableScalarFields(template), [template])
  const initialBaseValues = character.sheet!.values
  const [baseline, setBaseline] = useState<Record<string, unknown>>(() => ({ ...initialBaseValues }))
  const [baseRevision, setBaseRevision] = useState(character.sheet!.revision)
  const [values, setValues] = useState<Record<string, unknown>>(() => ({ ...initialBaseValues }))
  const [actionData, setActionData] = useState<SheetActionData | null>(null)
  const [conflictPanel, setConflictPanel] = useState<ConflictPanelState | null>(null)
  const [isPending, startTransition] = useTransition()
  const fieldsByUid = useMemo(() => new Map(fields.map((field) => [field.uid, field])), [fields])

  const changes = deriveSheetChanges(fields, baseline, values)
  const savableChanges = conflictPanel
    ? changes.filter((change) => !conflictPanel.conflicts.some((conflict) =>
      conflict.field.uid === change.path.fieldUid && conflict.partsKey === change.path.partsKey
    ))
    : changes
  const hasCompleteConflictSelection = conflictPanel?.conflicts.every(({ id }) => conflictPanel.selections[id]) ?? false
  const hasUnsavedFailure = changes.length > 0 && Boolean(actionData?.error || conflictPanel)

  const presentSaveResult = (result: SheetActionData) => {
    if (result.mergeConflict) {
      const nextPanel = createConflictPanel(result.mergeConflict, fields)
      if (nextPanel) {
        setConflictPanel(nextPanel)
        setActionData(null)
        return
      }
      setActionData({ error: GENERIC_SHEET_CONFLICT_MESSAGE, conflict: true })
      setConflictPanel(null)
      return
    }
    if (result.conflict) {
      setConflictPanel(null)
      setActionData({ error: GENERIC_SHEET_CONFLICT_MESSAGE, conflict: true })
      return
    }
    setActionData(result)
  }

  const saveChanges = (revision: number, nextChanges: typeof changes) => {
    if (isPending || nextChanges.length === 0) return
    startTransition(async () => {
      try {
        // 競合判定は path ごとの baseValue CAS。baseRevision は SM-15 の再送規約用の情報値。
        const result = await saveSheet(character.characterId, { baseRevision: revision, changes: nextChanges })
        presentSaveResult(result)
      } catch (error) {
        unstable_rethrow(error)
        setActionData({ error: GENERIC_NETWORK_ERROR_MESSAGE, retryable: true })
      }
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    saveChanges(baseRevision, savableChanges)
  }

  const handleRendererChange = (fieldUid: string, value: unknown) => {
    const field = fieldsByUid.get(fieldUid)
    // TFR は unknown を運ぶ契約なので、保存境界では編集可能な非 parts scalar とその値型だけを state に入れる。
    if (!field || usesPartsEditor(field)) return
    const normalizedValue = normalizeEditorValue(field, value)
    if (normalizedValue === undefined) return
    if (field.valueType === 'number' && !Number.isFinite(normalizedValue)) return
    setValues((current) => writeSheetPathValue(field, undefined, normalizedValue, current))
  }

  const handleRendererPartsChange = (fieldUid: string, partsKey: string, value: number) => {
    const field = fieldsByUid.get(fieldUid)
    if (!field || !usesPartsEditor(field) || !Number.isFinite(value)) return
    // TFR が提示できる base・宣言キー・自由キーだけを受理し、旧公開データの reserved / UNSAFE と
    // 宣言モードの未宣言キーが callback 境界を越えて state に入ることを防ぐ。
    if (!listEditablePartsKeys(field, baseline, values).includes(partsKey)) return
    setValues((current) => writeSheetPathValue(field, partsKey, value, current))
  }

  const handleConflictApply = () => {
    if (!conflictPanel || !hasCompleteConflictSelection) return
    let nextBaseline = { ...baseline }
    let nextValues = { ...values }
    // 同一 uid の複数 partsKey 競合も合成できるよう、各 path を直前の再構築結果へ逐次適用する。
    for (const conflict of conflictPanel.conflicts) {
      nextBaseline = writeSheetPathValue(conflict.field, conflict.partsKey, conflict.current, nextBaseline)
      if (conflictPanel.selections[conflict.id] === 'theirs') {
        nextValues = writeSheetPathValue(conflict.field, conflict.partsKey, conflict.current, nextValues)
      }
    }
    const nextRevision = conflictPanel.currentRevision
    const nextChanges = deriveSheetChanges(fields, nextBaseline, nextValues)
    setBaseline(nextBaseline)
    setBaseRevision(nextRevision)
    setValues(nextValues)
    setConflictPanel(null)
    setActionData(null)
    if (nextChanges.length > 0) saveChanges(nextRevision, nextChanges)
  }

  return (
    <Container size="sm" py="xl">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>{character.characterName} のシート編集</Title>
            <Text size="sm" c="dimmed">
              {template.name} v{character.sheet!.templateVersion} / revision {baseRevision}
            </Text>
          </div>
          <Button
            component={Link}
            href="/user/character"
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
          >
            一覧へ
          </Button>
        </Group>

        {conflictPanel && (
          <Card withBorder radius="md" p="lg" role="region" aria-label="保存競合">
            <Stack gap="md">
              <div>
                <Title order={3}>保存競合</Title>
                <Text size="sm" c="dimmed">項目ごとに採用する値を選んでください。他の項目は引き続き編集できます。</Text>
              </div>
              {conflictPanel.conflicts.map((conflict) => (
                <Card key={conflict.id} withBorder radius="sm" p="md">
                  <Stack gap="xs">
                    <Text fw={600}>{conflict.field.label}</Text>
                    <Text size="sm">相手の値: {formatEditorValue(conflict.field, conflict.current)}</Text>
                    <Text size="sm">
                      自分の値: {formatEditorValue(
                        conflict.field,
                        readSheetPathValue(conflict.field, conflict.partsKey, values)
                      )}
                    </Text>
                    <Radio.Group
                      label={`${conflict.field.label} の解決方法`}
                      value={conflictPanel.selections[conflict.id] ?? ''}
                      onChange={(resolution) => setConflictPanel((current) =>
                        current?.conflicts === conflictPanel.conflicts
                          ? { ...current, selections: { ...current.selections, [conflict.id]: resolution as ConflictResolution } }
                          : current
                      )}
                    >
                      <Group mt="xs">
                        <Radio value="theirs" label="相手の値を採用 (theirs)" />
                        <Radio value="mine" label="自分の値を採用 (mine)" />
                      </Group>
                    </Radio.Group>
                  </Stack>
                </Card>
              ))}
              <Group justify="flex-end">
                <Button
                  type="button"
                  onClick={handleConflictApply}
                  disabled={!hasCompleteConflictSelection}
                  loading={isPending}
                >
                  選択を適用
                </Button>
              </Group>
            </Stack>
          </Card>
        )}

        {actionData?.error && (
          <Alert
            color={actionData.conflict ? 'yellow' : 'red'}
            icon={<IconAlertCircle size={16} />}
            title={actionData.conflict ? '保存競合' : '保存できませんでした'}
          >
            <Stack gap="xs">
              <Text>{actionData.error}</Text>
              {actionData.retryable && (
                <Button
                  type="button"
                  variant="light"
                  color="red"
                  loading={isPending}
                  disabled={changes.length === 0}
                  onClick={() => saveChanges(baseRevision, savableChanges)}
                >
                  再試行
                </Button>
              )}
            </Stack>
          </Alert>
        )}

        {hasUnsavedFailure && (
          <Alert color="orange" icon={<IconAlertCircle size={16} />} title="保存されていません">
            編集内容はこの画面に保持されています。
          </Alert>
        )}

        <Card withBorder radius="md" p="lg">
          {fields.length === 0 ? (
            <Alert color="blue">このテンプレートには編集対象の scalar がありません。</Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                <TemplateFormRenderer
                  template={template}
                  headingLevel={3}
                  values={values}
                  onChange={handleRendererChange}
                  onPartsChange={handleRendererPartsChange}
                />
                <Group justify="flex-end">
                  <Button
                    type="submit"
                    leftSection={<IconDeviceFloppy size={16} />}
                    disabled={changes.length === 0}
                    loading={isPending}
                  >
                    変更を保存
                  </Button>
                </Group>
              </Stack>
            </form>
          )}
        </Card>
      </Stack>
    </Container>
  )
}
