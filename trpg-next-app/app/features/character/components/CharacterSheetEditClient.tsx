'use client'

import { Alert, Button, Card, Container, Group, NumberInput, Radio, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import type { CharacterWire, SheetMergeConflictWire } from '@trpg/api-contract'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'
import type { CharacterSheetTemplateEntity } from '../../characterTemplate/types/v3'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { saveSheet } from '../actions'
import {
  deriveSheetChanges,
  editableScalarFields,
  GENERIC_SHEET_CONFLICT_MESSAGE,
  readEditableValue,
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

function createEditorValues(
  fields: EditableScalarField[],
  rawValues: Record<string, unknown>
): Record<string, EditorValue> {
  return Object.fromEntries(fields.map((field) => [field.uid, readEditableValue(field, rawValues)]))
}

function readConflictCurrent(field: EditableScalarField, current: unknown): EditorValue {
  // readEditableValue と似るが、field 全体の values レコードではなく conflict path 単位の値を読む。
  if (field.valueType === 'number') return typeof current === 'number' ? current : undefined
  return typeof current === 'string' ? current : undefined
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
      current: readConflictCurrent(field, conflict.current)
    }]
  })
  return conflicts.length > 0 ? { currentRevision: payload.currentRevision, conflicts, selections: {} } : null
}

function formatEditorValue(value: EditorValue): string {
  return value === undefined ? '未入力' : value === '' ? '空文字' : String(value)
}

export function CharacterSheetEditClient({ character, template }: CharacterSheetEditClientProps) {
  const fields = useMemo(() => editableScalarFields(template), [template])
  const initialBaseValues = character.sheet!.values
  const [baseline, setBaseline] = useState<Record<string, EditorValue>>(() =>
    createEditorValues(fields, initialBaseValues)
  )
  const [baseRevision, setBaseRevision] = useState(character.sheet!.revision)
  const [values, setValues] = useState<Record<string, EditorValue>>(() => createEditorValues(fields, initialBaseValues))
  const [actionData, setActionData] = useState<SheetActionData | null>(null)
  const [conflictPanel, setConflictPanel] = useState<ConflictPanelState | null>(null)
  const [isPending, startTransition] = useTransition()

  const hasInvalidNumber = fields.some((field) => field.valueType === 'number' && values[field.uid] === '')
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

  const handleConflictApply = () => {
    if (!conflictPanel || !hasCompleteConflictSelection) return
    const nextBaseline = { ...baseline }
    const nextValues = { ...values }
    // deriveSheetChanges により、1 uid あたりの partsKey は 'base' 一択なので field 単位で書き込む。
    for (const conflict of conflictPanel.conflicts) {
      nextBaseline[conflict.field.uid] = conflict.current
      if (conflictPanel.selections[conflict.id] === 'theirs') nextValues[conflict.field.uid] = conflict.current
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
                    <Text size="sm">相手の値: {formatEditorValue(conflict.current)}</Text>
                    <Text size="sm">自分の値: {formatEditorValue(values[conflict.field.uid])}</Text>
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
            <Alert color="blue">このテンプレートには編集対象の number/text scalar がありません。</Alert>
          ) : (
            <form onSubmit={handleSubmit}>
              <Stack gap="md">
                {fields.map((field) =>
                  field.valueType === 'number' ? (
                    <NumberInput
                      key={field.uid}
                      label={field.label}
                      description={field.description}
                      value={values[field.uid] ?? ''}
                      onChange={(value) => setValues((current) => ({ ...current, [field.uid]: value }))}
                      required
                    />
                  ) : (
                    <TextInput
                      key={field.uid}
                      label={field.label}
                      description={field.description}
                      value={typeof values[field.uid] === 'string' ? values[field.uid] : ''}
                      onChange={(event) => {
                        const value = event.currentTarget.value
                        setValues((current) => ({ ...current, [field.uid]: value }))
                      }}
                    />
                  )
                )}
                <Group justify="flex-end">
                  <Button
                    type="submit"
                    leftSection={<IconDeviceFloppy size={16} />}
                    disabled={hasInvalidNumber || changes.length === 0}
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
