'use client'

import { Alert, Button, Card, Container, Group, Radio, Stack, Text, Title } from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconDeviceFloppy } from '@tabler/icons-react'
import type { CharacterWire, RerollCreationRollResultWire, SheetMergeConflictWire } from '@trpg/api-contract'
import { evaluateTemplate } from '@trpg/sheet-engine'
import Link from 'next/link'
import { unstable_rethrow } from 'next/navigation'
import { type FormEvent, useMemo, useState, useTransition } from 'react'
import type { CharacterSheetTemplateEntity } from '../../characterTemplate/types/v3'
import { toSheetTemplate } from '../../characterTemplate/utils/v3Template'
import { buildFormValues } from '../../characterSheet/form-values'
import { TemplateFormRenderer } from '../../characterSheet/TemplateFormRenderer'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { rerollSheetField, saveSheet, type RerollSheetFieldResult } from '../actions'
import {
  deriveSheetChanges,
  editableListFields,
  editableScalarFields,
  GENERIC_SHEET_CONFLICT_MESSAGE,
  listEditablePartsKeys,
  normalizeEditorValue,
  readSheetPathValue,
  usesPartsEditor,
  writeSheetPathValue,
  type EditableListField,
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
  fields: EditableScalarField[],
  listFieldsByUid: ReadonlyMap<string, EditableListField>
): ConflictPanelState | null {
  // list の current は server の boundMergeConflictValue により 4KB 境界で $truncated になりうるため、相手の値として忠実に提示できない。
  // 1 path でも含めば混在時も応答全体を汎用競合へ落とし、front で $truncated を解釈せず再読み込みを促す。
  if (payload.conflicts.some((conflict) => listFieldsByUid.has(conflict.path.fieldUid))) return null

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
  const listFields = useMemo(() => editableListFields(template), [template])
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
  const listFieldsByUid = useMemo(
    () => new Map(listFields.map((field) => [field.uid, field])),
    [listFields]
  )
  const templateFields = useMemo(() => template.sections.flatMap((section) => section.fields), [template])
  // 振り直しの対象には track / roll も含まれ、これらは editableScalarFields の外なので、全 field から label を引く。
  const fieldLabels = useMemo(
    () => new Map(templateFields.map((field) => [field.uid, field.label])),
    [templateFields]
  )
  // computed の値は保存値ではないので values state には無い（materialize が computed への保存を拒否する）。
  // roll は保存値だが、保存値を持たない roll は評価値（記法文字列）が出る。どちらもプレビューと同じ
  // client 評価から採る。
  // engine 形への変換もプレビューと同じ toSheetTemplate を通す。そこが呼ぶ normalizeTemplateReferences が
  // 書き換えるのは `{field}` 形の参照だけで、保存済みテンプレートが持つ `{section.field}` 形には効かない。
  // Invariant: この画面が評価器へ渡すテンプレート実体はこれ 1 つに保つ。TFR も内部で評価器を呼ぶので
  // （evaluateAnnotationRuntime / evaluateConstraint）、TFR へ正規化前の entity を渡すと同じ画面の評価器が
  // 2 つの実体を見ることになり、`{field}` 形の参照の解決結果が両者で食い違いうる。
  const sheetTemplate = useMemo(() => toSheetTemplate(template), [template])
  // evaluateTemplate は式 1 本の失敗で例外を投げる。編集画面はテンプレートを直せる場所ではないので、
  // 画面ごと落とさず null にし、computed だけを 'Error' 表示へ退化させる（プレビューと同じ扱い）。
  const evaluated = useMemo(() => {
    try {
      return evaluateTemplate(sheetTemplate, { values })
    } catch {
      return null
    }
  }, [sheetTemplate, values])
  const formValues = useMemo(() => {
    // 「値を持たない」は values state のキー不在で表される。buildFormValues の 1 段目は評価値を全 uid に
    // 敷くので、不在キーを undefined として明示的に載せない限り、engine の評価値がその不在を埋めてしまう。
    // 埋まると、未入力の number 欄が 0（engine の未入力 number の評価値）と表示され、保存していない値を
    // 画面が主張する。
    //
    // 補填の対象を「この画面が raw 値を所有しない型か」で決めるのが要。この画面が所有しないのは
    // computed と roll の 2 つだけで、それ以外（scalar / track / relation / tag / list）は
    // values state のキーの在不在がそのまま「保存値の有無」を表す。
    //
    // Invariant: 評価値をここに残してよいのは computed と roll だけ。TFR は受け取った values を
    // engine へ差し戻して注釈と制約を評価するため（TFR の evaluateAnnotationRuntime と
    // evaluateConstraint）、それ以外の型に評価値を残すと engine 側の「own かつ非 nullish な raw entry が
    // 無ければ indeterminate」という契約（constraint-evaluator の isRawNumberDependencyMissing）が崩れる。
    // 具体的には未設定 track に評価値 0 が載り、その track を参照する上限 / block cap / pool total が
    // 未確定（—）から 0 の断定へ転ぶ。表示だけの理由で対象を絞ると、この壊れ方を素通しする。
    const editorOwned: Record<string, unknown> = { ...values }
    for (const field of templateFields) {
      if (field.type === 'computed' || field.type === 'roll') continue
      if (!(field.uid in editorOwned)) editorOwned[field.uid] = undefined
    }
    return buildFormValues({ evaluated, fields: templateFields, values: editorOwned })
  }, [evaluated, templateFields, values])

  const changes = deriveSheetChanges(fields, baseline, values, listFields)
  const savableChanges = conflictPanel
    ? changes.filter((change) => !conflictPanel.conflicts.some((conflict) =>
      conflict.field.uid === change.path.fieldUid && conflict.partsKey === change.path.partsKey
    ))
    : changes
  const hasCompleteConflictSelection = conflictPanel?.conflicts.every(({ id }) => conflictPanel.selections[id]) ?? false
  const hasUnsavedFailure = changes.length > 0 && Boolean(actionData?.error || conflictPanel)

  const presentSaveResult = (result: SheetActionData) => {
    if (result.mergeConflict) {
      const nextPanel = createConflictPanel(result.mergeConflict, fields, listFieldsByUid)
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
    const listField = listFieldsByUid.get(fieldUid)
    if (listField) {
      // TFR の現在実装では配列を通知するが、unknown callback 境界の契約として list 全体だけを受理する。
      if (!Array.isArray(value)) return
      setValues((current) => ({ ...current, [listField.uid]: value }))
      return
    }

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
    // baseline も進めるのは、振り直し直後の値が偽の未保存差分として保存対象に入るのを防ぐため。
    // deriveSheetChanges は editableScalarFields の scalar（per-path）と editableListFields の list（whole-field）を
    // baseline と突き合わせる。作成時ロールは scalar でも宣言でき、
    // 振り直しの対象になるため、この経路には観測者がいる。
    // この行を落とすと本 component の spec の「scalar の振り直しは baseline も進め、振り直した値を
    // 保存差分にしない」が赤になる（実測。62 tests 中その 1 本だけが落ちる）。
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
   * Scope: この導線抑止はパネル経路だけを覆う。汎用競合（result.conflict / list degrade）でも
   * baseRevision は同様に stale だが導線は残り、押すと 409 → 振り直し競合 alert になる。
   * generic 競合経路へ波及する実装判断は別スライス。
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
    const nextChanges = deriveSheetChanges(fields, nextBaseline, nextValues, listFields)
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
              {fields.length === 0 && listFields.length === 0 ? (
                <Alert color="blue">このテンプレートには編集対象の scalar がありません。</Alert>
              ) : null}
              {/* design-v1-ui :117: 編集対象がなくても computed/roll と U14/U15 annotation を同一 TFR 経路で描画する。 */}
              {/* 渡すのは表示用の formValues。保存差分の正本である values state には computed / roll を混ぜない。 */}
              <TemplateFormRenderer
                template={sheetTemplate}
                headingLevel={3}
                values={formValues}
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
