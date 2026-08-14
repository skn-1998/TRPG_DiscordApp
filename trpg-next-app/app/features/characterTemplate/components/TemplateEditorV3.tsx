'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { produce } from 'immer'
import {
  Alert,
  Autocomplete,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCheck,
  IconDeviceFloppy,
  IconDice,
  IconPlus,
  IconRefresh,
  IconRocket,
  IconTrash
} from '@tabler/icons-react'
import {
  normalizeTemplateLayout,
  isSimpleField,
  resolveSectionLayout,
  SHEET_FIELD_LAYOUT_SPANS,
  SHEET_SECTION_GRID_COLUMNS,
  SHEET_SECTION_LAYOUT_PRESETS,
  type ConstraintSource,
  validatePublishTemplate,
  validateStandaloneRollNotation,
  validateStandaloneRollNotations
} from '@trpg/sheet-engine'
import { GENERIC_NETWORK_ERROR_MESSAGE } from '../../../lib/api-response.util'
import { saveTemplateDraft, type EditorIntent } from '../actions'
import type {
  CharacterSheetTemplateEntity,
  LookupTable,
  SheetField,
  SheetSection,
  TemplateValidationMessage,
  V3EditorFieldType
} from '../types/v3'
import { requestDicePreview } from '../utils/dicePreview'
import {
  createEditorSignature,
  createField,
  createSection,
  normalizeTemplateReferences,
  parseTags,
  safeParseTables,
  stringifyTables,
  stringifyTags,
  toSheetTemplate,
  validateLocalTemplate
} from '../utils/v3Template'
import { TemplatePreviewV3 } from './TemplatePreviewV3'

interface TemplateEditorV3Props {
  initialTemplate: CharacterSheetTemplateEntity
}

export const AUTOSAVE_DEBOUNCE_MS = 1800

type ConstraintInputMode = 'number' | 'formula'
type SectionLayoutPreset = (typeof SHEET_SECTION_LAYOUT_PRESETS)[number]
type SectionGridColumns = (typeof SHEET_SECTION_GRID_COLUMNS)[number]
type FieldLayoutSpan = (typeof SHEET_FIELD_LAYOUT_SPANS)[number]

const SECTION_LAYOUT_PRESET_OPTIONS = SHEET_SECTION_LAYOUT_PRESETS.map((value) => ({ value, label: value }))
const SECTION_GRID_COLUMNS_OPTIONS = SHEET_SECTION_GRID_COLUMNS.map((value) => ({
  value: String(value),
  label: String(value)
}))

type SaveFailure =
  | { kind: 'retryable'; signature: string; intent: EditorIntent; messages: string[] }
  | { kind: 'permanent'; signature: string; messages: string[] }
  | { kind: 'local'; signature: string; messages: string[] }
  | { kind: 'conflict'; signature: string; messages: string[] }

function buildEditorPayload(
  template: CharacterSheetTemplateEntity,
  tablesText: string
): CharacterSheetTemplateEntity {
  const parsedTables = safeParseTables(tablesText)
  return normalizeTemplateLayout(normalizeTemplateReferences({ ...template, tables: parsedTables }))
}

function createSaveSignature(template: CharacterSheetTemplateEntity, tablesText: string): string {
  try {
    return createEditorSignature(buildEditorPayload(template, tablesText), tablesText)
  } catch {
    // ローカルで不正な入力にも、修正前後を区別できる決定的な署名が必要。
    return createEditorSignature(template, tablesText)
  }
}

interface ConstraintInputProps {
  label: string
  value?: ConstraintSource
  required?: boolean
  onChange: (value: ConstraintSource | undefined) => void
}

function ConstraintInput({ label, value, required = false, onChange }: ConstraintInputProps) {
  const mode: ConstraintInputMode = typeof value === 'object' ? 'formula' : 'number'

  return (
    <Group grow align="end">
      <Stack gap={4}>
        <Text size="sm" fw={500}>
          {label} 入力方式
        </Text>
        <SegmentedControl
          aria-label={`${label} 入力方式`}
          data={[
            { value: 'number', label: 'number' },
            { value: 'formula', label: 'formula' }
          ]}
          value={mode}
          onChange={(nextMode) => {
            const constraintMode = nextMode as ConstraintInputMode
            onChange(constraintMode === 'formula' ? { formula: '' } : required ? 0 : undefined)
          }}
        />
      </Stack>
      {mode === 'number' ? (
        <NumberInput
          label={label}
          value={typeof value === 'number' ? value : ''}
          onChange={(nextValue) =>
            onChange(typeof nextValue === 'number' ? nextValue : required ? 0 : undefined)
          }
        />
      ) : (
        <TextInput
          label={`${label} formula`}
          value={typeof value === 'object' ? value.formula : ''}
          onChange={(event) => onChange({ formula: event.currentTarget.value })}
        />
      )}
    </Group>
  )
}

type SectionBlock = NonNullable<SheetSection['blocks']>[number]
type SectionPool = NonNullable<SheetSection['pools']>[number]

interface SectionBlocksInputProps {
  value?: SectionBlock[]
  onChange: (value: SectionBlock[] | undefined) => void
}

function SectionBlocksInput({ value = [], onChange }: SectionBlocksInputProps) {
  const updateBlock = (index: number, patch: Partial<SectionBlock>) => {
    onChange(value.map((block, currentIndex) => (currentIndex === index ? { ...block, ...patch } : block)))
  }

  const removeBlock = (index: number) => {
    const nextValue = value.filter((_, currentIndex) => currentIndex !== index)
    onChange(nextValue.length > 0 ? nextValue : undefined)
  }

  const moveBlock = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset
    const block = value[index]
    const target = value[nextIndex]
    if (!block || !target) return
    const nextValue = [...value]
    nextValue[index] = target
    nextValue[nextIndex] = block
    onChange(nextValue)
  }

  return (
    <Stack gap="xs">
      <Text fw={500}>blocks</Text>
      {value.map((block, index) => (
        <Paper key={index} withBorder p="sm" radius="sm">
          <Stack gap="xs">
            <Group grow align="end">
              <TextInput
                label={`blocks ${index + 1} id`}
                value={block.id}
                onChange={(event) => updateBlock(index, { id: event.currentTarget.value })}
              />
              <TextInput
                label={`blocks ${index + 1} label`}
                value={block.label}
                onChange={(event) => updateBlock(index, { label: event.currentTarget.value })}
              />
              <Group gap={4} grow={false} wrap="nowrap">
                <Button
                  aria-label={`blocks ${index + 1} を上へ`}
                  variant="subtle"
                  disabled={index === 0}
                  onClick={() => moveBlock(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  aria-label={`blocks ${index + 1} を下へ`}
                  variant="subtle"
                  disabled={index === value.length - 1}
                  onClick={() => moveBlock(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  aria-label={`blocks ${index + 1} を削除`}
                  color="red"
                  variant="subtle"
                  onClick={() => removeBlock(index)}
                >
                  <IconTrash size={16} />
                </Button>
              </Group>
            </Group>
            <ConstraintInput
              label={`blocks ${index + 1} cap`}
              value={block.cap}
              onChange={(cap) => updateBlock(index, { cap })}
            />
          </Stack>
        </Paper>
      ))}
      <Button
        variant="outline"
        size="xs"
        leftSection={<IconPlus size={16} />}
        onClick={() => onChange([...value, { id: '', label: '' }])}
      >
        block 追加
      </Button>
    </Stack>
  )
}

interface SectionPoolsInputProps {
  section: SheetSection
  onChange: (value: SectionPool[] | undefined) => void
}

function SectionPoolsInput({ section, onChange }: SectionPoolsInputProps) {
  const value = section.pools ?? []
  const declaredPartsKeys = section.fields.flatMap((field) =>
    field.type === 'scalar' ? (field.partsKeys ?? []).map((partKey) => partKey.id) : []
  )
  const partsKeyOptions = [...new Set(declaredPartsKeys.filter(Boolean))]
  // フィールド詳細の blockId 候補と同じ導出。片側だけ変更しない。
  const blockOptions = [...new Set((section.blocks ?? []).map((block) => block.id).filter(Boolean))]

  const updatePool = (index: number, patch: Partial<SectionPool>) => {
    onChange(value.map((pool, currentIndex) => (currentIndex === index ? { ...pool, ...patch } : pool)))
  }

  const removePool = (index: number) => {
    const nextValue = value.filter((_, currentIndex) => currentIndex !== index)
    onChange(nextValue.length > 0 ? nextValue : undefined)
  }

  return (
    <Stack gap="xs">
      <Text fw={500}>pools</Text>
      {value.map((pool, index) => (
        <Paper key={index} withBorder p="sm" radius="sm">
          <Stack gap="xs">
            <Group grow align="end">
              <TextInput
                label={`pools ${index + 1} id`}
                value={pool.id}
                onChange={(event) => updatePool(index, { id: event.currentTarget.value })}
              />
              <TextInput
                label={`pools ${index + 1} label`}
                value={pool.label}
                onChange={(event) => updatePool(index, { label: event.currentTarget.value })}
              />
              <Button
                aria-label={`pools ${index + 1} を削除`}
                color="red"
                variant="subtle"
                onClick={() => removePool(index)}
              >
                <IconTrash size={16} />
              </Button>
            </Group>
            <ConstraintInput
              label={`pools ${index + 1} total`}
              value={pool.total}
              required
              onChange={(total) => updatePool(index, { total })}
            />
            <Group grow align="end">
              <Autocomplete
                label={`pools ${index + 1} partsKey`}
                data={partsKeyOptions}
                value={pool.partsKey}
                onChange={(partsKey) => updatePool(index, { partsKey })}
              />
              <MultiSelect
                label={`pools ${index + 1} scope`}
                data={blockOptions}
                value={pool.scope ?? []}
                onChange={(scope) => updatePool(index, { scope: scope.length > 0 ? scope : undefined })}
              />
            </Group>
            {pool.scope && pool.scope.length > 0 && (
              <Button
                aria-label={`pools ${index + 1} scope clear`}
                size="xs"
                variant="subtle"
                onClick={() => updatePool(index, { scope: undefined })}
              >
                scope を全解除
              </Button>
            )}
          </Stack>
        </Paper>
      ))}
      <Button
        variant="outline"
        size="xs"
        leftSection={<IconPlus size={16} />}
        onClick={() => onChange([...value, { id: '', label: '', total: 0, partsKey: '' }])}
      >
        pool 追加
      </Button>
    </Stack>
  )
}

interface PartsKeysInputProps {
  value?: Array<{ id: string; label: string }>
  disabled: boolean
  onChange: (value: Array<{ id: string; label: string }> | undefined) => void
}

function PartsKeysInput({ value = [], disabled, onChange }: PartsKeysInputProps) {
  const updatePartKey = (index: number, patch: Partial<{ id: string; label: string }>) => {
    onChange(value.map((partKey, currentIndex) => (currentIndex === index ? { ...partKey, ...patch } : partKey)))
  }

  const removePartKey = (index: number) => {
    const nextValue = value.filter((_, currentIndex) => currentIndex !== index)
    onChange(nextValue.length > 0 ? nextValue : undefined)
  }

  return (
    <Stack gap="xs">
      <Text fw={500}>partsKeys</Text>
      {disabled && (
        <Text size="sm" c="orange">
          parts:true と partsKeys は併存できないため、partsKeys の編集を無効化しています。
        </Text>
      )}
      {value.map((partKey, index) => (
        <Group key={index} grow align="end" wrap="nowrap">
          <TextInput
            label={`partsKeys ${index + 1} id`}
            value={partKey.id}
            disabled={disabled}
            onChange={(event) => updatePartKey(index, { id: event.currentTarget.value })}
          />
          <TextInput
            label={`partsKeys ${index + 1} label`}
            value={partKey.label}
            disabled={disabled}
            onChange={(event) => updatePartKey(index, { label: event.currentTarget.value })}
          />
          <Button
            aria-label={`partsKeys ${index + 1} を削除`}
            color="red"
            variant="subtle"
            disabled={disabled}
            onClick={() => removePartKey(index)}
          >
            <IconTrash size={16} />
          </Button>
        </Group>
      ))}
      <Button
        variant="outline"
        size="xs"
        leftSection={<IconPlus size={16} />}
        disabled={disabled}
        onClick={() => onChange([...value, { id: '', label: '' }])}
      >
        parts キー追加
      </Button>
    </Stack>
  )
}

interface DeltasInputProps {
  value: number[]
  onChange: (value: number[]) => void
}

function DeltasInput({ value, onChange }: DeltasInputProps) {
  const [drafts, setDrafts] = useState<Array<string | undefined>>([])

  const discardDraft = (index: number) => {
    setDrafts((current) => {
      if (current[index] === undefined) return current
      const nextDrafts = [...current]
      nextDrafts[index] = undefined
      return nextDrafts
    })
  }

  const updateDelta = (index: number, nextDelta: string | number) => {
    if (typeof nextDelta !== 'number' || !Number.isFinite(nextDelta)) {
      setDrafts((current) => {
        const nextDrafts = [...current]
        nextDrafts[index] = nextDelta
        return nextDrafts
      })
      return
    }

    discardDraft(index)
    onChange(value.map((delta, currentIndex) => (currentIndex === index ? nextDelta : delta)))
  }

  const removeDelta = (index: number) => {
    setDrafts([])
    onChange(value.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <Stack gap="xs">
      <Text fw={500}>リソース操作（±）</Text>
      {value.map((delta, index) => (
        <Group key={index} grow align="end" wrap="nowrap">
          <NumberInput
            label={`delta ${index + 1}`}
            value={drafts[index] ?? delta}
            onChange={(nextDelta) => updateDelta(index, nextDelta)}
            onBlur={() => discardDraft(index)}
          />
          <Button
            aria-label={`delta ${index + 1} を削除`}
            color="red"
            variant="subtle"
            onClick={() => removeDelta(index)}
          >
            <IconTrash size={16} />
          </Button>
        </Group>
      ))}
      <Button
        variant="outline"
        size="xs"
        leftSection={<IconPlus size={16} />}
        onClick={() => onChange([...value, -1])}
      >
        delta 追加
      </Button>
    </Stack>
  )
}

export function TemplateEditorV3({ initialTemplate }: TemplateEditorV3Props) {
  const [template, setTemplate] = useState<CharacterSheetTemplateEntity>(initialTemplate)
  const [activeSectionId, setActiveSectionId] = useState(initialTemplate.sections[0]?.id ?? '')
  const [selectedFieldUid, setSelectedFieldUid] = useState<string | null>(
    initialTemplate.sections[0]?.fields[0]?.uid ?? null
  )
  const [newSectionLabel, setNewSectionLabel] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<V3EditorFieldType>('text')
  const [tablesText, setTablesText] = useState(stringifyTables(initialTemplate.tables))
  const [validationMessages, setValidationMessages] = useState<TemplateValidationMessage[]>([])
  const [publishWarnings, setPublishWarnings] = useState<TemplateValidationMessage[]>([])
  const [hasRunValidation, setHasRunValidation] = useState(false)
  const [activeRightPaneTab, setActiveRightPaneTab] = useState<string | null>('input-preview')
  const [saveFailure, setSaveFailure] = useState<SaveFailure | null>(null)
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'conflict'>('idle')
  const [inFlightIntent, setInFlightIntent] = useState<EditorIntent | null>(null)
  const [rollingTrackFieldUid, setRollingTrackFieldUid] = useState<string | null>(null)
  const [rollOnCreateFeedback, setRollOnCreateFeedback] = useState<
    Record<string, { details?: string; error?: string }>
  >({})
  const inFlightRef = useRef(false)
  const lastSavedSignatureRef = useRef(
    createSaveSignature(initialTemplate, stringifyTables(initialTemplate.tables))
  )
  const pendingSignatureRef = useRef<string | null>(null)
  const templateRef = useRef(template)
  const tablesTextRef = useRef(tablesText)

  const activeSection = useMemo(
    () => template.sections.find((section) => section.id === activeSectionId) ?? template.sections[0],
    [activeSectionId, template.sections]
  )
  const selectedField = useMemo(
    () => activeSection?.fields.find((field) => field.uid === selectedFieldUid),
    [activeSection, selectedFieldUid]
  )
  const activeSectionLayout =
    typeof activeSection?.layout === 'object' && activeSection.layout !== null
      ? (activeSection.layout as Record<string, unknown>)
      : undefined
  // Invariant: resolver の既定値は表示条件にだけ使い、明示的な Select 操作までは state に具現化しない。
  const resolvedActiveSectionLayout = resolveSectionLayout(activeSection?.layout)
  const selectedSectionLayoutPreset =
    SHEET_SECTION_LAYOUT_PRESETS.find((preset) => preset === activeSectionLayout?.preset) ?? null
  const selectedSectionGridColumns =
    SHEET_SECTION_GRID_COLUMNS.find((columns) => columns === activeSectionLayout?.columns) ?? null
  const selectedFieldLayoutSpan =
    SHEET_FIELD_LAYOUT_SPANS.find((span) => span === selectedField?.layout?.span) ?? null
  // 正本 design-v1-ui.md のレイアウトヒント語彙は span を「1〜columns−1 ＋ 全幅」と定める。
  // columns 以上の span は描画時に full へ clamp されるため、選ばせても別の結果にならない。
  const fieldLayoutSpanOptions =
    resolvedActiveSectionLayout.mode === 'grid'
      ? SHEET_FIELD_LAYOUT_SPANS.filter(
          (span) => span === 'full' || span < resolvedActiveSectionLayout.columns
        ).map((span) => ({ value: String(span), label: String(span) }))
      : []

  const isSaving = inFlightIntent !== null
  const editorSignature = useMemo(() => createSaveSignature(template, tablesText), [tablesText, template])
  const activeSaveFailure = saveFailure?.signature === editorSignature ? saveFailure : null
  const hasActiveSaveFailure = activeSaveFailure !== null

  useEffect(() => {
    templateRef.current = template
    tablesTextRef.current = tablesText
  }, [tablesText, template])

  const buildPayload = useCallback((): CharacterSheetTemplateEntity => {
    return buildEditorPayload(template, tablesText)
  }, [tablesText, template])

  const submitDraft = useCallback(
    async (intent: EditorIntent) => {
      if (inFlightRef.current) return
      inFlightRef.current = true

      try {
        setSaveFailure(null)

        let payload: CharacterSheetTemplateEntity
        try {
          payload = buildPayload()
          const localErrors = validateLocalTemplate(payload)
          if (localErrors.length > 0) {
            setValidationMessages([])
            setSaveFailure({ kind: 'local', signature: editorSignature, messages: localErrors })
            setSaveState((current) => (current === 'conflict' ? current : 'dirty'))
            return
          }
        } catch (error) {
          setValidationMessages([])
          setSaveFailure({
            kind: 'local',
            signature: editorSignature,
            messages: [error instanceof Error ? error.message : '保存 payload の作成に失敗しました']
          })
          setSaveState((current) => (current === 'conflict' ? current : 'dirty'))
          return
        }

        const signature = editorSignature
        pendingSignatureRef.current = signature
        setValidationMessages([])
        setSaveState((current) => (current === 'conflict' ? current : 'saving'))
        setInFlightIntent(intent)

        try {
          const actionResult = await saveTemplateDraft(template.templateId, intent, payload)
          const messages = actionResult.messages ?? []

          if (actionResult.conflict) {
            setSaveFailure({ kind: 'conflict', signature, messages })
            setSaveState('conflict')
            return
          }
          if (!actionResult.template) {
            pendingSignatureRef.current = null
            setSaveFailure(
              actionResult.retryable
                ? { kind: 'retryable', signature, intent, messages }
                : { kind: 'permanent', signature, messages }
            )
            setSaveState((current) => (current === 'conflict' ? current : 'dirty'))
            return
          }

          const returned = actionResult.template
          const currentSignature = createSaveSignature(templateRef.current, tablesTextRef.current)
          const pendingSignature = pendingSignatureRef.current
          lastSavedSignatureRef.current =
            pendingSignature ?? createSaveSignature(returned, stringifyTables(returned.tables))
          pendingSignatureRef.current = null
          // actions は「template あり ∧ messages 非空」を部分成功として返す。
          // draft は保存済みで publish leg だけが失敗した状態なので、保存済み表示のまま失敗も併記する。
          setSaveFailure(
            messages.length === 0
              ? null
              : actionResult.retryable
                ? { kind: 'retryable', signature, intent, messages }
                : { kind: 'permanent', signature, messages }
          )

          if (pendingSignature && currentSignature !== pendingSignature) {
            setTemplate((current) => ({
              ...current,
              draftRevision: returned.draftRevision,
              updatedAt: returned.updatedAt
            }))
            setSaveState('dirty')
            return
          }

          setTemplate(returned)
          setTablesText(stringifyTables(returned.tables))
          setSaveState('saved')
        } catch {
          pendingSignatureRef.current = null
          setSaveFailure({
            kind: 'retryable',
            signature,
            intent,
            messages: [GENERIC_NETWORK_ERROR_MESSAGE]
          })
          setSaveState((current) => (current === 'conflict' ? current : 'dirty'))
        }
      } finally {
        inFlightRef.current = false
        setInFlightIntent(null)
      }
    },
    [buildPayload, editorSignature, template.templateId]
  )

  useEffect(() => {
    if (
      editorSignature === lastSavedSignatureRef.current ||
      hasActiveSaveFailure ||
      saveState === 'conflict' ||
      saveState === 'saving'
    )
      return
    setSaveState('dirty')

    const timeout = window.setTimeout(() => {
      void submitDraft('autosave')
    }, AUTOSAVE_DEBOUNCE_MS)

    return () => window.clearTimeout(timeout)
  }, [editorSignature, hasActiveSaveFailure, saveState, submitDraft])

  // Invariant: undefined の patch も own key を残し、従来の spread merge と同じ state shape を保つ。
  const updateTemplate = (patch: Partial<CharacterSheetTemplateEntity>) => {
    setTemplate(
      produce((draft) => {
        Object.assign(draft, patch)
      })
    )
  }

  const updateSection = (sectionId: string, patch: Partial<SheetSection>) => {
    setTemplate(
      produce((draft) => {
        for (const section of draft.sections) {
          if (section.id === sectionId) Object.assign(section, patch)
        }
      })
    )
  }

  const updateField = (fieldUid: string, patch: Partial<SheetField>) => {
    setTemplate(
      produce((draft) => {
        for (const section of draft.sections) {
          for (const field of section.fields) {
            if (field.uid === fieldUid) Object.assign(field, patch)
          }
        }
      })
    )
  }

  const updateSectionLayout = (
    sectionId: string,
    update: { preset: SectionLayoutPreset | null } | { columns: SectionGridColumns | null }
  ) => {
    setTemplate(
      produce((draft) => {
        const section = draft.sections.find((candidate) => candidate.id === sectionId)
        if (!section) return

        if ('preset' in update) {
          if (update.preset === null) {
            delete section.layout
            return
          }

          // この UI から preset なしの columns へは到達しない。H-9 が「preset キーを持たない layout は
          // 無視して stack 扱い」と決めた legacy/外部 JSON の columns を、grid 化で捨てないための引き継ぎ。
          const currentLayout =
            typeof section.layout === 'object' && section.layout !== null
              ? (section.layout as Record<string, unknown>)
              : undefined
          const currentColumns = SHEET_SECTION_GRID_COLUMNS.find(
            (columns) => columns === currentLayout?.columns
          )
          section.layout =
            update.preset === 'grid' && currentColumns !== undefined
              ? { preset: update.preset, columns: currentColumns }
              : { preset: update.preset }
          return
        }

        if (resolveSectionLayout(section.layout).mode !== 'grid') return
        const layout = section.layout as { preset: 'grid'; columns?: SectionGridColumns }
        if (update.columns === null) delete layout.columns
        else layout.columns = update.columns
      })
    )
  }

  const updateFieldLayout = (fieldUid: string, span: FieldLayoutSpan | null) => {
    setTemplate(
      produce((draft) => {
        for (const section of draft.sections) {
          const field = section.fields.find((candidate) => candidate.uid === fieldUid)
          if (!field) continue

          if (span === null) {
            // Invariant: clear は editor state から削除し、保存境界での既定値具現化とは分離する。
            if (!field.layout) return
            delete field.layout.span
            if (Object.keys(field.layout).length === 0) delete field.layout
            return
          }

          if (!field.layout) field.layout = {}
          field.layout.span = span
          return
        }
      })
    )
  }

  const addSection = () => {
    const section = createSection(template.sections, newSectionLabel)
    setTemplate((current) => ({ ...current, sections: [...current.sections, section] }))
    setActiveSectionId(section.id)
    setNewSectionLabel('')
  }

  const deleteSection = (sectionId: string) => {
    setTemplate((current) => {
      const nextSections = current.sections.filter((section) => section.id !== sectionId)
      if (activeSectionId === sectionId) {
        setActiveSectionId(nextSections[0]?.id ?? '')
        setSelectedFieldUid(nextSections[0]?.fields[0]?.uid ?? null)
      }
      return { ...current, sections: nextSections }
    })
  }

  const addField = () => {
    if (!activeSection) return
    const field = createField(newFieldType, activeSection, newFieldLabel || newFieldType)
    setTemplate(
      produce((draft) => {
        for (const section of draft.sections) {
          if (section.id === activeSection.id) section.fields.push(field)
        }
      })
    )
    setSelectedFieldUid(field.uid)
    setNewFieldLabel('')
  }

  const deleteField = (fieldUid: string) => {
    setTemplate(
      produce((draft) => {
        for (const section of draft.sections) {
          section.fields = section.fields.filter((field) => field.uid !== fieldUid)
        }
      })
    )
    setSelectedFieldUid(null)
  }

  const previewRollOnCreate = async (field: Extract<SheetField, { type: 'track' }>) => {
    if (rollingTrackFieldUid !== null) return

    const notation = field.rollOnCreate?.notation ?? ''
    const validationIssue = validateStandaloneRollNotation(notation)[0]
    if (validationIssue) {
      setRollOnCreateFeedback((current) => ({
        ...current,
        [field.uid]: { error: validationIssue.message }
      }))
      return
    }

    setRollOnCreateFeedback((current) => ({ ...current, [field.uid]: {} }))
    setRollingTrackFieldUid(field.uid)

    try {
      const requestResult = await requestDicePreview({
        notation,
        ...(template.gameSystemId ? { gameSystemId: template.gameSystemId } : {})
      })
      setRollOnCreateFeedback((current) => ({
        ...current,
        [field.uid]: requestResult.ok
          ? { details: requestResult.details }
          : { error: requestResult.error }
      }))
    } finally {
      setRollingTrackFieldUid(null)
    }
  }

  const runValidation = () => {
    try {
      const payload = buildPayload()
      const localErrors = validateLocalTemplate(payload).map((message) => ({ message }))
      const sheetTemplate = toSheetTemplate(payload)
      const publishResult = validatePublishTemplate(sheetTemplate)
      const standaloneRollIssues = validateStandaloneRollNotations(sheetTemplate)
      const publishErrors = [...publishResult.issues, ...standaloneRollIssues].map((issue) => ({
        path: describeIssuePath(issue.path, payload),
        message: issue.message
      }))
      setValidationMessages([...localErrors, ...publishErrors])
      setPublishWarnings(
        publishResult.warnings.map((warning) => ({
          code: warning.code,
          path: describeIssuePath(warning.path, payload),
          message: warning.message
        }))
      )
    } catch (error) {
      setValidationMessages([{ message: error instanceof Error ? error.message : '検証に失敗しました' }])
      setPublishWarnings([])
    }
    setHasRunValidation(true)
    // 検証は作者が明示的に起こす操作であり、結果を見に行くところまでが期待動作。
    // 問題なしも結果なので、成功・失敗を問わず結果面へ切り替える。
    setActiveRightPaneTab('validation-results')
  }

  const dirtyMessage =
    activeSaveFailure?.kind === 'retryable'
      ? '保存されていません。再試行するか、編集を続けると自動保存を再開します。'
      : activeSaveFailure?.kind === 'permanent'
        ? '保存されていません。エラー内容を修正して編集を続けると自動保存を再開します。'
        : activeSaveFailure?.kind === 'local'
          ? '入力を修正してください。修正すると自動保存を再開します。'
          : '未保存の変更があります。autosave を待機中です。'

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="start">
        <div>
          <Group gap="xs">
            <Title order={2}>{template.name}</Title>
            <Badge color={template.status === 'draft' ? 'yellow' : 'green'}>{template.status}</Badge>
          </Group>
          <Text size="sm" c="dimmed">
            draftRevision {template.draftRevision} / schemaVersion {template.schemaVersion}
          </Text>
        </div>

        <Group gap="sm">
          <Button component={Link} href="/templates" variant="subtle">
            一覧
          </Button>
          <Button
            variant="outline"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={isSaving}
            onClick={() => void submitDraft('save')}
          >
            保存
          </Button>
          <Button leftSection={<IconCheck size={16} />} variant="outline" onClick={runValidation}>
            検証
          </Button>
          <Button
            leftSection={<IconRocket size={16} />}
            color="green"
            loading={isSaving}
            onClick={() => void submitDraft('publish')}
          >
            publish
          </Button>
        </Group>
      </Group>

      <Alert color={saveState === 'conflict' ? 'red' : saveState === 'saved' ? 'green' : 'blue'}>
        {saveState === 'conflict'
          ? '他所で更新あり。再読み込みして最新の draft を確認してください。'
          : saveState === 'saving'
            ? '保存中...'
            : saveState === 'dirty'
              ? dirtyMessage
              : saveState === 'saved'
                ? '保存しました。'
                : '編集できます。'}
        {saveState === 'conflict' && (
          <Button ml="md" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        )}
      </Alert>

      {/* Invariant: 保存失敗の詳細と手動再試行は右ペインのタブ状態に依存させない。
          自動保存はどの面を見ていても失敗しうるため、到達性はここでの常時表示が担う。 */}
      {activeSaveFailure !== null && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="保存エラー">
          <Stack gap={4}>
            {activeSaveFailure.messages.map((message, index) => {
              // サーバーのメッセージは対象を「field {id}」と本文に埋めて返す。
              // 検証エラーの [位置] 表記に合わせ、読み取れたときだけ位置として前置する。
              const fieldId = message.match(/field ([a-z][a-z0-9_]{0,31})/)?.[1]
              return (
                <Text key={`${message}-${index}`} size="sm">
                  {fieldId ? `[${fieldId}] ` : ''}
                  {message}
                </Text>
              )
            })}
            {/* conflict 中の再送は同じ draftRevision で必ず 409 になるため、出口は再読み込みだけにする。 */}
            {activeSaveFailure.kind === 'retryable' && saveState !== 'conflict' && (
              <Button
                mt={4}
                size="xs"
                variant="light"
                color="red"
                leftSection={<IconRefresh size={14} />}
                onClick={() => void submitDraft(activeSaveFailure.intent)}
              >
                再試行
              </Button>
            )}
          </Stack>
        </Alert>
      )}

      <Paper withBorder p="md" radius="md">
        <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
          <TextInput
            label="テンプレート名"
            value={template.name}
            onChange={(event) => updateTemplate({ name: event.currentTarget.value })}
          />
          <TextInput
            label="version"
            value={template.version}
            onChange={(event) => updateTemplate({ version: event.currentTarget.value })}
          />
          <Select
            label="公開範囲"
            data={[
              { value: 'private', label: 'private' },
              { value: 'unlisted', label: 'unlisted' },
              { value: 'public', label: 'public' }
            ]}
            value={template.visibility}
            onChange={(value) =>
              updateTemplate({ visibility: (value ?? 'private') as CharacterSheetTemplateEntity['visibility'] })
            }
          />
          <TextInput
            label="gameSystemId"
            value={template.gameSystemId ?? ''}
            onChange={(event) => updateTemplate({ gameSystemId: event.currentTarget.value || undefined })}
          />
          <TextInput
            label="tags"
            description="カンマ区切り"
            value={stringifyTags(template.tags)}
            onChange={(event) => updateTemplate({ tags: parseTags(event.currentTarget.value) })}
          />
          <Select
            label="rounding"
            data={[
              { value: 'floor', label: 'floor' },
              { value: 'ceil', label: 'ceil' },
              { value: 'round', label: 'round' }
            ]}
            value={template.settings.rounding}
            onChange={(value) =>
              updateTemplate({
                settings: {
                  ...template.settings,
                  rounding: (value ?? 'floor') as CharacterSheetTemplateEntity['settings']['rounding']
                }
              })
            }
          />
        </SimpleGrid>
      </Paper>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
        <Stack gap="md">
          <Card withBorder radius="md" p="md">
            <Group justify="space-between" align="end">
              <TextInput
                label="セクション追加"
                placeholder="例: abilities"
                value={newSectionLabel}
                onChange={(event) => setNewSectionLabel(event.currentTarget.value)}
              />
              <Button leftSection={<IconPlus size={16} />} onClick={addSection}>
                追加
              </Button>
            </Group>

            <Tabs
              mt="md"
              value={activeSection?.id ?? ''}
              onChange={(value) => {
                if (!value) return
                setActiveSectionId(value)
              }}
            >
              <Tabs.List>
                {template.sections.map((section) => (
                  <Tabs.Tab key={section.id} value={section.id}>
                    {section.label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs>
          </Card>

          {activeSection && (
            <Card withBorder radius="md" p="md">
              <Stack gap="md">
                <Group justify="space-between" align="end">
                  <TextInput
                    label="section id"
                    value={activeSection.id}
                    onChange={(event) => {
                      const nextId = event.currentTarget.value
                      updateSection(activeSection.id, { id: nextId })
                      setActiveSectionId(nextId)
                    }}
                  />
                  <TextInput
                    label="section label"
                    value={activeSection.label}
                    onChange={(event) => updateSection(activeSection.id, { label: event.currentTarget.value })}
                  />
                  <Button
                    color="red"
                    variant="subtle"
                    leftSection={<IconTrash size={16} />}
                    onClick={() => deleteSection(activeSection.id)}
                  >
                    削除
                  </Button>
                </Group>

                <Divider />

                <SectionBlocksInput
                  value={activeSection.blocks}
                  onChange={(blocks) => updateSection(activeSection.id, { blocks })}
                />

                <SectionPoolsInput
                  section={activeSection}
                  onChange={(pools) => updateSection(activeSection.id, { pools })}
                />

                <Group grow align="end">
                  <Select
                    label="レイアウトプリセット"
                    placeholder="未選択（既定 stack）"
                    data={SECTION_LAYOUT_PRESET_OPTIONS}
                    clearable
                    allowDeselect={false}
                    clearButtonProps={{ 'aria-label': '配置設定を初期化' }}
                    value={selectedSectionLayoutPreset}
                    onChange={(value) =>
                      updateSectionLayout(activeSection.id, {
                        preset: SHEET_SECTION_LAYOUT_PRESETS.find((preset) => preset === value) ?? null
                      })
                    }
                  />
                  {resolvedActiveSectionLayout.mode === 'grid' ? (
                    <Select
                      label="グリッド列数"
                      placeholder="未選択（既定 2）"
                      data={SECTION_GRID_COLUMNS_OPTIONS}
                      clearable
                      allowDeselect={false}
                      clearButtonProps={{ 'aria-label': '列設定を初期化' }}
                      value={selectedSectionGridColumns === null ? null : String(selectedSectionGridColumns)}
                      onChange={(value) =>
                        updateSectionLayout(activeSection.id, {
                          columns:
                            SHEET_SECTION_GRID_COLUMNS.find((columns) => String(columns) === value) ?? null
                        })
                      }
                    />
                  ) : null}
                </Group>

                <Divider />

                <Group align="end">
                  <TextInput
                    label="フィールド名"
                    value={newFieldLabel}
                    onChange={(event) => setNewFieldLabel(event.currentTarget.value)}
                  />
                  <Select
                    label="型"
                    data={[
                      { value: 'text', label: 'text' },
                      { value: 'number', label: 'number' },
                      { value: 'select', label: 'select' },
                      { value: 'checkbox', label: 'checkbox' },
                      { value: 'computed', label: 'computed' },
                      { value: 'roll', label: 'roll' },
                      { value: 'track', label: 'track' }
                    ]}
                    value={newFieldType}
                    onChange={(value) => setNewFieldType((value ?? 'text') as V3EditorFieldType)}
                  />
                  <Button leftSection={<IconPlus size={16} />} onClick={addField}>
                    フィールド追加
                  </Button>
                </Group>

                <Stack gap="xs">
                  {activeSection.fields.map((field) => (
                    <Paper
                      key={field.uid}
                      withBorder
                      p="sm"
                      radius="sm"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedFieldUid(field.uid)}
                    >
                      <Group justify="space-between">
                        <div>
                          <Text fw={selectedFieldUid === field.uid ? 700 : 500}>{field.label}</Text>
                          <Text size="xs" c="dimmed">
                            {field.id} / {field.type}
                          </Text>
                        </div>
                        <Button
                          size="xs"
                          color="red"
                          variant="subtle"
                          onClick={(event) => {
                            event.stopPropagation()
                            deleteField(field.uid)
                          }}
                        >
                          削除
                        </Button>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            </Card>
          )}

          {selectedField && (
            <Card withBorder radius="md" p="md">
              <Stack gap="sm">
                <Text fw={700}>フィールド詳細</Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }}>
                  <TextInput
                    label="id"
                    value={selectedField.id}
                    onChange={(event) =>
                      updateField(selectedField.uid, { id: event.currentTarget.value } as Partial<SheetField>)
                    }
                  />
                  <TextInput
                    label="label"
                    value={selectedField.label}
                    onChange={(event) =>
                      updateField(selectedField.uid, { label: event.currentTarget.value } as Partial<SheetField>)
                    }
                  />
                  </SimpleGrid>
                <Textarea
                  label="description"
                  value={selectedField.description ?? ''}
                  onChange={(event) =>
                    updateField(selectedField.uid, {
                      description: event.currentTarget.value || undefined
                    } as Partial<SheetField>)
                  }
                  />
                {/* SectionPoolsInput の blockOptions と同じ導出。片側だけ変更しない。 */}
                <Autocomplete
                  label="blockId"
                  data={[...new Set((activeSection?.blocks ?? []).map((block) => block.id).filter(Boolean))]}
                  value={selectedField.blockId ?? ''}
                  onChange={(blockId) =>
                    updateField(selectedField.uid, {
                      blockId: blockId || undefined
                    })
                  }
                />
                {isSimpleField(selectedField) && resolvedActiveSectionLayout.mode === 'grid' ? (
                  <Select
                    label="表示幅"
                    placeholder="未選択（既定 1）"
                    data={fieldLayoutSpanOptions}
                    clearable
                    allowDeselect={false}
                    clearButtonProps={{ 'aria-label': '幅指定を初期化' }}
                    value={selectedFieldLayoutSpan === null ? null : String(selectedFieldLayoutSpan)}
                    onChange={(value) =>
                      updateFieldLayout(
                        selectedField.uid,
                        SHEET_FIELD_LAYOUT_SPANS.find((span) => String(span) === value) ?? null
                      )
                    }
                  />
                ) : null}
                {selectedField.type === 'scalar' && selectedField.valueType === 'number' && (
                  <>
                    <ConstraintInput
                      label="max"
                      value={selectedField.max}
                      onChange={(max) => updateField(selectedField.uid, { max })}
                    />
                    <PartsKeysInput
                      value={selectedField.partsKeys}
                      disabled={selectedField.parts === true}
                      onChange={(partsKeys) => updateField(selectedField.uid, { partsKeys })}
                    />
                  </>
                )}
                {selectedField.type === 'scalar' && selectedField.valueType === 'select' && (
                  <Textarea
                    label="options"
                    description="1行1項目。label=value 形式も可"
                    value={(selectedField.options ?? []).map((option) => `${option.label}=${option.value}`).join('\n')}
                    onChange={(event) =>
                      updateField(selectedField.uid, {
                        options: parseOptions(event.currentTarget.value)
                      } as Partial<SheetField>)
                    }
                  />
                )}
                {selectedField.type === 'computed' && (
                  <Group grow align="end">
                    <Select
                      label="resultType"
                      data={[
                        { value: 'number', label: 'number' },
                        { value: 'text', label: 'text' },
                        { value: 'boolean', label: 'boolean' },
                        { value: 'dice', label: 'dice' }
                      ]}
                      value={selectedField.resultType}
                      onChange={(value) =>
                        updateField(selectedField.uid, {
                          resultType: (value ?? 'number') as typeof selectedField.resultType
                        } as Partial<SheetField>)
                      }
                    />
                    <TextInput
                      label="formula"
                      value={selectedField.formula}
                      onChange={(event) =>
                        updateField(selectedField.uid, { formula: event.currentTarget.value } as Partial<SheetField>)
                      }
                    />
                  </Group>
                )}
                {selectedField.type === 'track' && (
                  <>
                    <ConstraintInput
                      label="max"
                      value={selectedField.max}
                      required
                      onChange={(max) => updateField(selectedField.uid, { max })}
                    />
                    <NumberInput
                      label="min"
                      value={selectedField.min ?? ''}
                      onChange={(min) =>
                        updateField(selectedField.uid, {
                          min: typeof min === 'number' ? min : undefined
                        } as Partial<SheetField>)
                      }
                    />
                    <Select
                      label="style"
                      data={[
                        { value: 'gauge', label: 'gauge' },
                        { value: 'checkboxes', label: 'checkboxes' }
                      ]}
                      value={selectedField.style}
                      onChange={(value) =>
                        updateField(selectedField.uid, {
                          style: (value ?? 'gauge') as typeof selectedField.style
                        } as Partial<SheetField>)
                      }
                    />
                    <Stack gap={4}>
                      <TextInput
                        label="rollOnCreate notation"
                        value={selectedField.rollOnCreate?.notation ?? ''}
                        disabled={rollingTrackFieldUid === selectedField.uid}
                        onChange={(event) => {
                          const notation = event.currentTarget.value || undefined
                          setRollOnCreateFeedback((current) => ({ ...current, [selectedField.uid]: {} }))
                          updateField(selectedField.uid, {
                            rollOnCreate: notation ? { notation } : undefined
                          } as Partial<SheetField>)
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        leftSection={<IconDice size={16} />}
                        loading={rollingTrackFieldUid === selectedField.uid}
                        disabled={!selectedField.rollOnCreate?.notation || rollingTrackFieldUid !== null}
                        onClick={() => void previewRollOnCreate(selectedField)}
                      >
                        試しロール
                      </Button>
                      {rollOnCreateFeedback[selectedField.uid]?.details && (
                        <Text size="xs" c="dimmed">
                          {/* dice-preview の total は rands 合算で、rollOnCreate の評価後の値とは一致しない。
                              BCDice text の末尾に評価値を含む details だけを表示する。 */}
                          結果: {rollOnCreateFeedback[selectedField.uid].details}
                        </Text>
                      )}
                      {rollOnCreateFeedback[selectedField.uid]?.error && (
                        <Text size="xs" c="red" role="alert">
                          {rollOnCreateFeedback[selectedField.uid].error}
                        </Text>
                      )}
                    </Stack>
                    {selectedField.role !== undefined && selectedField.role.kind !== 'resource' ? (
                      <Stack gap="xs">
                        <Text fw={500}>リソース操作（±）</Text>
                        <Text size="sm" c="orange">
                          この track には {selectedField.role.kind} role が設定されています。リソース操作（±）へ置き換えると現在の
                          role は失われます。
                        </Text>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            updateField(selectedField.uid, {
                              role: { kind: 'resource', deltas: [-1] }
                            } as Partial<SheetField>)
                          }
                        >
                          resource role へ置き換える
                        </Button>
                      </Stack>
                    ) : (
                      <>
                        {/* resource の group は palette 生成時に section.label から決まるため、この UI では入力させない。 */}
                        <DeltasInput
                          key={selectedField.uid}
                          value={selectedField.role?.kind === 'resource' ? selectedField.role.deltas : []}
                          onChange={(deltas) =>
                            updateField(selectedField.uid, {
                              role: deltas.length > 0 ? { kind: 'resource', deltas } : undefined
                            } as Partial<SheetField>)
                          }
                        />
                      </>
                    )}
                  </>
                )}
                {selectedField.type === 'roll' && (
                  <TextInput
                    label="notation"
                    value={selectedField.notation}
                    onChange={(event) =>
                      updateField(selectedField.uid, { notation: event.currentTarget.value } as Partial<SheetField>)
                    }
                  />
                )}
              </Stack>
            </Card>
          )}

          <Card withBorder radius="md" p="md">
            <Textarea
              label="tables"
              description="Phase 1 は JSON array の直接編集です"
              minRows={8}
              value={tablesText}
              onChange={(event) => setTablesText(event.currentTarget.value)}
            />
          </Card>
        </Stack>

        <Card withBorder radius="md" p="md">
          <Tabs value={activeRightPaneTab} onChange={setActiveRightPaneTab}>
            <Tabs.List>
              <Tabs.Tab value="input-preview">入力プレビュー</Tabs.Tab>
              <Tabs.Tab value="validation-results">検証結果</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="input-preview" pt="md">
              <TemplatePreviewV3
                template={{ ...template, tables: parseTablesOrKeepCurrent(tablesText, template.tables) }}
              />
            </Tabs.Panel>

            <Tabs.Panel value="validation-results" pt="md">
              <Stack gap="md">
                {/* 検証前は結果が空なのが正常。validationMessages / publishWarnings は
                    runValidation でしか非空にならないため、未実行かどうかだけで案内を出し分ける。 */}
                {!hasRunValidation && <Text c="dimmed">検証を実行してください</Text>}

                {/* 空の面では「問題なし」と「押せていない」を区別できないため、通過も明示する。 */}
                {hasRunValidation && validationMessages.length === 0 && publishWarnings.length === 0 && (
                  <Alert color="green" icon={<IconCheck size={16} />}>
                    問題は見つかりませんでした
                  </Alert>
                )}

                {validationMessages.length > 0 && (
                  <Alert color="red" icon={<IconAlertCircle size={16} />} title="検証エラー">
                    <Stack gap={4}>
                      {validationMessages.map((message, index) => (
                        <Text key={`${message.message}-${index}`} size="sm">
                          {message.path ? `[${message.path}] ` : ''}
                          {message.message}
                        </Text>
                      ))}
                    </Stack>
                  </Alert>
                )}

                {publishWarnings.length > 0 && (
                  <Alert color="yellow" icon={<IconAlertCircle size={16} />} title="検証警告">
                    <Stack gap={4}>
                      {publishWarnings.map((warning, index) => (
                        <Text key={`${warning.code}-${warning.path}-${index}`} size="sm">
                          [{warning.path}] {warning.message}
                        </Text>
                      ))}
                    </Stack>
                  </Alert>
                )}
              </Stack>
            </Tabs.Panel>
          </Tabs>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}

function describeIssuePath(path: string, template: CharacterSheetTemplateEntity): string {
  const segments = path.split('.')
  const interpretationCandidates: string[] = []
  const displayName = (entry: { id: string; label: string }) =>
    typeof entry.label === 'string' ? entry.label.trim() || entry.id : entry.id
  const resolveFieldPath = (
    section: SheetSection,
    field: SheetField,
    remainingSegments: string[],
    fieldLabels = [displayName(section), displayName(field)]
  ): string[] => {
    const location = fieldLabels.join(' / ')
    if (remainingSegments.length === 0) return [location]

    const [segment, fieldKey] = remainingSegments
    const resolvedLocations: string[] = []
    const nestedFields = field.type === 'list' ? field.itemFields : field.type === 'relation' ? (field.attrs ?? []) : []

    for (const nestedField of nestedFields.filter((candidate) => candidate.id === segment)) {
      resolvedLocations.push(
        ...resolveFieldPath(section, nestedField, remainingSegments.slice(1), [
          ...fieldLabels,
          displayName(nestedField)
        ])
      )
    }

    const collectionKind = field.type === 'list' ? 'itemFields' : field.type === 'relation' ? 'attrs' : undefined
    if (segment === collectionKind) {
      if (remainingSegments.length === 1) resolvedLocations.push(location)
      if (fieldKey !== undefined) {
        const nestedFieldCandidates: SheetField[] = []
        if (/^\d+$/.test(fieldKey)) {
          const nestedField = nestedFields[Number(fieldKey)]
          if (nestedField) nestedFieldCandidates.push(nestedField)
        }
        nestedFieldCandidates.push(...nestedFields.filter((candidate) => candidate.id === fieldKey))
        for (const nestedField of nestedFieldCandidates) {
          resolvedLocations.push(
            ...resolveFieldPath(section, nestedField, remainingSegments.slice(2), [
              ...fieldLabels,
              displayName(nestedField)
            ])
          )
        }
      }
      return resolvedLocations
    }

    if (segment === 'partsKeys') {
      if (field.type !== 'scalar' || field.partsKeys === undefined) return resolvedLocations
      if (remainingSegments.length === 1) return [...resolvedLocations, location]

      const partsKeyIndex = /^\d+$/.test(fieldKey ?? '') ? Number(fieldKey) : Number.NaN
      const partsKey = Number.isInteger(partsKeyIndex) ? field.partsKeys[partsKeyIndex] : undefined
      if (!partsKey) return resolvedLocations
      if (
        remainingSegments.length === 2 ||
        (remainingSegments.length === 3 && (remainingSegments[2] === 'id' || remainingSegments[2] === 'label'))
      ) {
        resolvedLocations.push(`${location} / partsKeys ${partsKeyIndex + 1}`)
      }
      return resolvedLocations
    }

    let propertyValue: unknown = field
    for (const property of remainingSegments) {
      if (Array.isArray(propertyValue)) {
        if (!/^\d+$/.test(property)) {
          propertyValue = undefined
          break
        }
        propertyValue = propertyValue[Number(property)]
      } else if (
        typeof propertyValue === 'object' &&
        propertyValue !== null &&
        Object.prototype.hasOwnProperty.call(propertyValue, property)
      ) {
        propertyValue = (propertyValue as Record<string, unknown>)[property]
      } else {
        propertyValue = undefined
        break
      }
    }
    if (propertyValue !== undefined) resolvedLocations.push(location)
    return resolvedLocations
  }

  for (const section of template.sections.filter((candidate) => candidate.id === segments[0])) {
    for (const field of section.fields.filter((candidate) => candidate.id === segments[1])) {
      interpretationCandidates.push(...resolveFieldPath(section, field, segments.slice(2)))
    }
  }

  if (segments[0] === 'sections') {
    const sectionKey = segments[1]
    const sectionCandidates: SheetSection[] = []
    if (/^\d+$/.test(sectionKey ?? '')) {
      const section = template.sections[Number(sectionKey)]
      if (section) sectionCandidates.push(section)
    }
    sectionCandidates.push(...template.sections.filter((candidate) => candidate.id === sectionKey))

    for (const section of sectionCandidates) {
      const sectionLabel = displayName(section)
      const locationKind = segments[2]
      if (locationKind === 'id' || locationKind === 'label' || locationKind === 'layout') {
        interpretationCandidates.push(sectionLabel)
      } else if (locationKind === 'fields') {
        if (segments.length === 3) {
          interpretationCandidates.push(sectionLabel)
          continue
        }

        const fieldKey = segments[3]
        const fieldCandidates: SheetField[] = []
        if (/^\d+$/.test(fieldKey ?? '')) {
          const field = section.fields[Number(fieldKey)]
          if (field) fieldCandidates.push(field)
        }
        fieldCandidates.push(...section.fields.filter((candidate) => candidate.id === fieldKey))
        for (const field of fieldCandidates) {
          interpretationCandidates.push(...resolveFieldPath(section, field, segments.slice(4)))
        }
      } else if ((locationKind === 'blocks' || locationKind === 'pools') && segments.length >= 4) {
        const locationKey = segments[3]
        const locations = section[locationKind] ?? []
        const locationCandidates: Array<{ location: (typeof locations)[number]; index: number }> = []
        if (/^\d+$/.test(locationKey ?? '')) {
          const index = Number(locationKey)
          const location = locations[index]
          if (location) locationCandidates.push({ location, index })
        }
        for (const [index, location] of locations.entries()) {
          if (location.id === locationKey) locationCandidates.push({ location, index })
        }
        for (const { location, index } of locationCandidates) {
          interpretationCandidates.push(`${sectionLabel} / ${locationKind} ${index + 1} (${displayName(location)})`)
        }
      }
    }
  }

  return interpretationCandidates.length === 1 ? interpretationCandidates[0] : path
}

function parseOptions(value: string): Array<{ label: string; value: string }> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, optionValue] = line.includes('=') ? line.split('=', 2) : [line, line]
      return { label: label.trim(), value: optionValue.trim() }
    })
}

function parseTablesOrKeepCurrent(value: string, fallback: LookupTable[]): LookupTable[] {
  try {
    return safeParseTables(value)
  } catch {
    return fallback
  }
}
