import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useFetcher } from '@remix-run/react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Paper,
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
  IconPlus,
  IconRefresh,
  IconRocket,
  IconTrash
} from '@tabler/icons-react'
import type {
  CharacterSheetTemplateEntity,
  LookupTable,
  SheetField,
  SheetSection,
  TemplateValidationMessage,
  V3EditorFieldType
} from '../types/v3'
import {
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
import { validatePublishTemplate } from '../utils/sheetEngine'
import { TemplatePreviewV3 } from './TemplatePreviewV3'

interface TemplateEditorV3Props {
  initialTemplate: CharacterSheetTemplateEntity
}

type EditorActionData = {
  ok?: boolean
  intent?: 'autosave' | 'save' | 'publish'
  template?: CharacterSheetTemplateEntity
  conflict?: boolean
  messages?: string[]
}

export function TemplateEditorV3({ initialTemplate }: TemplateEditorV3Props) {
  const fetcher = useFetcher<EditorActionData>()
  const [template, setTemplate] = useState<CharacterSheetTemplateEntity>(initialTemplate)
  const [activeSectionId, setActiveSectionId] = useState(initialTemplate.sections[0]?.id ?? '')
  const [selectedFieldUid, setSelectedFieldUid] = useState<string | null>(
    initialTemplate.sections[0]?.fields[0]?.uid ?? null
  )
  const [newSectionLabel, setNewSectionLabel] = useState('')
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<V3EditorFieldType>('text')
  const [tablesText, setTablesText] = useState(stringifyTables(initialTemplate.tables))
  const [localMessages, setLocalMessages] = useState<TemplateValidationMessage[]>([])
  const [saveState, setSaveState] = useState<'idle' | 'dirty' | 'saving' | 'saved' | 'conflict'>('idle')
  const lastSavedSignatureRef = useRef(createContentSignature(initialTemplate))
  const pendingSignatureRef = useRef<string | null>(null)
  const templateRef = useRef(template)

  const activeSection = useMemo(
    () => template.sections.find((section) => section.id === activeSectionId) ?? template.sections[0],
    [activeSectionId, template.sections]
  )
  const selectedField = useMemo(
    () => template.sections.flatMap((section) => section.fields).find((field) => field.uid === selectedFieldUid),
    [selectedFieldUid, template.sections]
  )

  const actionMessages = fetcher.data?.messages ?? []
  const isSaving = fetcher.state !== 'idle'

  useEffect(() => {
    templateRef.current = template
  }, [template])

  const buildPayload = useCallback((): CharacterSheetTemplateEntity => {
    const parsedTables = safeParseTables(tablesText)
    return normalizeTemplateReferences({ ...template, tables: parsedTables })
  }, [tablesText, template])

  const submitDraft = useCallback(
    (intent: 'autosave' | 'save' | 'publish') => {
      try {
        const payload = buildPayload()
        const localErrors = validateLocalTemplate(payload)
        if (localErrors.length > 0) {
          setLocalMessages(localErrors.map((message) => ({ message })))
          setSaveState('dirty')
          return
        }

        const signature = createContentSignature(payload)
        pendingSignatureRef.current = signature
        setLocalMessages([])
        setSaveState('saving')

        const formData = new FormData()
        formData.set('intent', intent)
        formData.set('payload', JSON.stringify(payload))
        fetcher.submit(formData, { method: 'post' })
      } catch (error) {
        setLocalMessages([{ message: error instanceof Error ? error.message : '保存 payload の作成に失敗しました' }])
        setSaveState('dirty')
      }
    },
    [buildPayload, fetcher]
  )

  useEffect(() => {
    if (!fetcher.data) return
    if (fetcher.data.conflict) {
      setSaveState('conflict')
      return
    }
    if (!fetcher.data.template) return

    const returned = fetcher.data.template
    const currentSignature = createContentSignature(templateRef.current)
    const pendingSignature = pendingSignatureRef.current
    lastSavedSignatureRef.current = pendingSignature ?? createContentSignature(returned)
    pendingSignatureRef.current = null

    if (pendingSignature && currentSignature !== pendingSignature) {
      setTemplate((current) => ({ ...current, draftRevision: returned.draftRevision, updatedAt: returned.updatedAt }))
      setSaveState('dirty')
      return
    }

    setTemplate(returned)
    setTablesText(stringifyTables(returned.tables))
    setSaveState('saved')
  }, [fetcher.data])

  useEffect(() => {
    const signature = createContentSignature(template)
    if (signature === lastSavedSignatureRef.current || saveState === 'conflict' || saveState === 'saving') return
    setSaveState('dirty')

    const timeout = window.setTimeout(() => {
      submitDraft('autosave')
    }, 1800)

    return () => window.clearTimeout(timeout)
  }, [saveState, submitDraft, template])

  useEffect(() => {
    try {
      localStorage.setItem(
        `ct.templateDraft.v3.${template.templateId}`,
        JSON.stringify({ template, cachedAt: new Date().toISOString() })
      )
    } catch {
      // 復旧キャッシュなので保存できなくてもサーバー draft の編集は継続する。
    }
  }, [template])

  const updateTemplate = (patch: Partial<CharacterSheetTemplateEntity>) => {
    setTemplate((current) => ({ ...current, ...patch }))
  }

  const updateSection = (sectionId: string, patch: Partial<SheetSection>) => {
    setTemplate((current) => ({
      ...current,
      sections: current.sections.map((section) => (section.id === sectionId ? { ...section, ...patch } : section))
    }))
  }

  const updateField = (fieldUid: string, patch: Partial<SheetField>) => {
    setTemplate((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) => (field.uid === fieldUid ? ({ ...field, ...patch } as SheetField) : field))
      }))
    }))
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
    setTemplate((current) => ({
      ...current,
      sections: current.sections.map((section) =>
        section.id === activeSection.id ? { ...section, fields: [...section.fields, field] } : section
      )
    }))
    setSelectedFieldUid(field.uid)
    setNewFieldLabel('')
  }

  const deleteField = (fieldUid: string) => {
    setTemplate((current) => ({
      ...current,
      sections: current.sections.map((section) => ({
        ...section,
        fields: section.fields.filter((field) => field.uid !== fieldUid)
      }))
    }))
    setSelectedFieldUid(null)
  }

  const runValidation = () => {
    try {
      const payload = buildPayload()
      const localErrors = validateLocalTemplate(payload).map((message) => ({ message }))
      const publishResult = validatePublishTemplate(toSheetTemplate(payload))
      const publishErrors = publishResult.issues.map((issue) => ({
        fieldId: extractFieldId(issue.path),
        message: issue.message
      }))
      setLocalMessages([...localErrors, ...publishErrors])
    } catch (error) {
      setLocalMessages([{ message: error instanceof Error ? error.message : '検証に失敗しました' }])
    }
  }

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
          <Button component={Link} to="/templates" variant="subtle">
            一覧
          </Button>
          <Button
            variant="outline"
            leftSection={<IconDeviceFloppy size={16} />}
            loading={isSaving && fetcher.data?.intent !== 'publish'}
            onClick={() => submitDraft('save')}
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
            onClick={() => submitDraft('publish')}
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
              ? '未保存の変更があります。autosave を待機中です。'
              : saveState === 'saved'
                ? '保存しました。'
                : '編集できます。'}
        {saveState === 'conflict' && (
          <Button ml="md" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => window.location.reload()}>
            再読み込み
          </Button>
        )}
      </Alert>

      {(localMessages.length > 0 || actionMessages.length > 0) && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="検証/保存エラー">
          <Stack gap={4}>
            {[
              ...localMessages,
              ...actionMessages.map((message) => ({ message, fieldId: extractFieldId(message) }))
            ].map((message, index) => (
              <Text key={`${message.message}-${index}`} size="sm">
                {message.fieldId ? `[${message.fieldId}] ` : ''}
                {message.message}
              </Text>
            ))}
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

            <Tabs mt="md" value={activeSection?.id ?? ''} onChange={(value) => value && setActiveSectionId(value)}>
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
                      { value: 'roll', label: 'roll' }
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
          <TemplatePreviewV3
            template={{ ...template, tables: parseTablesOrKeepCurrent(tablesText, template.tables) }}
          />
        </Card>
      </SimpleGrid>
    </Stack>
  )
}

function createContentSignature(template: CharacterSheetTemplateEntity): string {
  const { draftRevision, updatedAt, createdAt, publishedAt, status, ...content } = template
  return JSON.stringify(content)
}

function extractFieldId(value?: string): string | undefined {
  if (!value) return undefined
  const bracket = value.match(/field ([a-z][a-z0-9_]{0,31})/)
  if (bracket) return bracket[1]
  const path = value.match(/sections\.\d+\.fields\.\d+\.([a-zA-Z0-9_]+)/)
  return path?.[1]
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
