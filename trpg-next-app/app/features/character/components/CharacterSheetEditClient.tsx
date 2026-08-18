'use client'

import { Alert, Button, Card, Container, Group, Radio, Stack, Text, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import type { CharacterWire, RerollCreationRollResultWire, SheetMergeConflictWire } from '@trpg/api-contract'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'
import type { CharacterSheetTemplateEntity } from '../../characterTemplate/types/v3'
import { TemplateFormRenderer } from '../../characterSheet/TemplateFormRenderer'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { rerollSheetField, saveSheet, type RerollSheetFieldResult } from '../actions'
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

function formatConflictPathLabel(field: EditableScalarField, partsKey: string | undefined): string {
  if (partsKey === undefined) return field.label
  const partsLabel = partsKey === 'base'
    ? '基本値'
    : field.partsKeys?.find(({ id }) => id === partsKey)?.label ?? partsKey
  return `${field.label}（${partsLabel}）`
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
  // 振り直しは保存とは別操作なので pending も分ける。保存ボタンの loading を巻き込まない。
  const [rerollingFieldUid, setRerollingFieldUid] = useState<string>()
  const [rerollFeedback, setRerollFeedback] = useState<RerollSheetFieldResult | null>(null)
  const fieldsByUid = useMemo(() => new Map(fields.map((field) => [field.uid, field])), [fields])
  // 振り直しの対象は track / roll で editableScalarFields に含まれないため、全 field から label を引く。
  const fieldLabels = useMemo(
    () => new Map(template.sections.flatMap((section) => section.fields.map((field) => [field.uid, field.label]))),
    [template]
  )

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

  /**
   * baseline・values・baseRevision は props から useState の初期化子で保持しており、初期化子は
   * 再レンダーで再実行されない（router.refresh() では更新されない）。よって応答から直接書き戻す。
   */
  const applyRerollResult = (roll: RerollCreationRollResultWire) => {
    // 書き戻しを省くと、2 回目の振り直しは server 入口の revision 比較で必ず 409 になる
    // （1 回目の成功で sheet.revision が進んでいるため）。この入口ガードは sheet.revision との
    // 直接比較で、saveSheet の path ごとの CAS とは非対称。
    setBaseRevision(roll.revision)
    // server が保存した値をそのまま採る。出目の合計から保存形を組み立て直すと、その変換規則
    // （server の creationRollValue）が front にも分裂する。応答に value が載っているのはこのため。
    //
    // baseline への書き戻しは今日の振り直し対象（track / roll）では観測者がいない。
    // deriveSheetChanges が読むのは editableScalarFields だけで、track / roll はその対象外
    // （この行を落とす変異が spec 全緑のまま生存することを確認済み）。
    // それでも書くのは PV-S で scalar が振り直し対象になったときに必要になるため。
    // baseline を欠くと、振り直し直後の値が偽の未保存差分として保存対象に入る。
    setBaseline((current) => ({ ...current, [roll.fieldUid]: roll.value }))
    setValues((current) => ({ ...current, [roll.fieldUid]: roll.value }))
  }

  /**
   * 競合パネルが開いている間は振り直しを受け付けない。パネルを開く経路（presentSaveResult の
   * mergeConflict 分岐）は baseRevision を進めず、進めるのは applyRerollResult と handleConflictApply
   * だけなので、パネル表示中の baseRevision は必ず stale。server の rerollCreationRoll は入口で
   * revision を比較して 409 にするため、この状態の振り直しは失敗しかしない。
   * 失敗時の案内（GENERIC_SHEET_CONFLICT_MESSAGE）は再読み込みを促すので、従うと未保存編集と
   * パネルの選択の両方を失う。導線を出さないことでその袋小路を作らない。
   */
  const canReroll = conflictPanel === null

  const handleReroll = (fieldUid: string) => {
    // 保存と振り直しは別の非同期なので、振り直しが飛行中にパネルが開く重なりがありうる。
    if (rerollingFieldUid !== undefined || !canReroll) return
    setRerollingFieldUid(fieldUid)
    setRerollFeedback(null)

    void (async () => {
      try {
        const result = await rerollSheetField(character.characterId, fieldUid, baseRevision)
        setRerollFeedback(result)
        if (result.error === null) applyRerollResult(result.roll)
      } catch (error) {
        unstable_rethrow(error)
        setRerollFeedback({ error: GENERIC_NETWORK_ERROR_MESSAGE })
      } finally {
        setRerollingFieldUid(undefined)
      }
    })()
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
              {conflictPanel.conflicts.map((conflict) => {
                const pathLabel = formatConflictPathLabel(conflict.field, conflict.partsKey)
                return (
                  <Card key={conflict.id} withBorder radius="sm" p="md">
                    <Stack gap="xs">
                      <Text fw={600}>{pathLabel}</Text>
                      <Text size="sm">相手の値: {formatEditorValue(conflict.field, conflict.current)}</Text>
                      <Text size="sm">
                        自分の値: {formatEditorValue(
                          conflict.field,
                          readSheetPathValue(conflict.field, conflict.partsKey, values)
                        )}
                      </Text>
                      <Radio.Group
                        label={`${pathLabel} の解決方法`}
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
                )
              })}
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

        {rerollFeedback && (rerollFeedback.error === null ? (
          <Alert color="green" title="振り直しました">
            <Text>
              {fieldLabels.get(rerollFeedback.roll.fieldUid) ?? rerollFeedback.roll.fieldUid}:
              {' '}{rerollFeedback.roll.notation} → 合計 {rerollFeedback.roll.total}
            </Text>
            <Text size="sm" c="dimmed">内訳: {rerollFeedback.roll.details}</Text>
          </Alert>
        ) : (
          <Alert
            color={rerollFeedback.conflict ? 'yellow' : 'red'}
            icon={<IconAlertCircle size={16} />}
            title={rerollFeedback.conflict ? '振り直し競合' : '振り直せませんでした'}
          >
            {rerollFeedback.error}
          </Alert>
        ))}

        {hasUnsavedFailure && (
          <Alert color="orange" icon={<IconAlertCircle size={16} />} title="保存されていません">
            編集内容はこの画面に保持されています。
          </Alert>
        )}

        <Card withBorder radius="md" p="lg">
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {fields.length === 0 ? (
                <Alert color="blue">このテンプレートには編集対象の scalar がありません。</Alert>
              ) : null}
              {/* design-v1-ui :117: 編集対象がなくても computed/roll と U14/U15 annotation を同一 TFR 経路で描画する。 */}
              <TemplateFormRenderer
                template={template}
                headingLevel={3}
                values={values}
                onChange={handleRendererChange}
                onPartsChange={handleRendererPartsChange}
                creationRollReroll={
                  canReroll ? { onRequest: handleReroll, pendingFieldUid: rerollingFieldUid } : undefined
                }
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
        </Card>
      </Stack>
    </Container>
  )
}
