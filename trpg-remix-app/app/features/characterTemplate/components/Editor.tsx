import { useMemo, useState } from 'react'
import { Tabs, Button, Stack, Group, Alert, Text } from '@mantine/core'
import { IconAlertCircle, IconPlus } from '@tabler/icons-react'
import type { Template, TabType, FieldType, Field } from '../types'
import { useTemplateStore } from '../store/templateStore'
import { useTemplateValidation } from '../hooks/useTemplateValidation'
import { useLocalPersistence } from '../hooks/useLocalPersistence'
import { FieldAddModal } from './FieldAddModal'

export const Editor = () => {
  const { current, activeTab, setTemplate, setActiveTab, validationErrors, setValidationErrors } = useTemplateStore()
  const { validate } = useTemplateValidation()
  const { saveTemplate } = useLocalPersistence()
  const [modalOpened, setModalOpened] = useState(false)

  const template: Template = useMemo(
    () =>
      current ?? {
        id: `tpl_${Math.random().toString(36).slice(2, 9)}`,
        name: 'New Template',
        version: '0.1.0',
        schemaVersion: 2,
        fields: [],
        layout: [
          { tab: 'basic', rows: [] },
          { tab: 'status', rows: [] },
          { tab: 'parameter', rows: [] },
          { tab: 'skill', rows: [] }
        ]
      },
    [current]
  )

  const addField = (field: Field) => {
    const next: Template = { ...template, fields: [...template.fields, field] }
    setTemplate(next)
  }

  const onSave = () => {
    const errors = validate(template)
    setValidationErrors(errors)
    if (errors.length === 0) {
      saveTemplate(template)
      alert('保存しました')
    }
  }

  const fieldsInTab = template.fields.filter((f) => f.tab === activeTab)

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>
        テンプレートエディタ
      </Text>

      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as TabType)}>
        <Tabs.List>
          <Tabs.Tab
            value="basic"
            styles={{
              tab: {
                fontWeight: activeTab === 'basic' ? 600 : 400,
                backgroundColor: activeTab === 'basic' ? '#e3f2fd' : 'transparent',
                border: activeTab === 'basic' ? '2px solid #2196f3' : '2px solid transparent'
              }
            }}
          >
            基本情報
          </Tabs.Tab>
          <Tabs.Tab
            value="status"
            styles={{
              tab: {
                fontWeight: activeTab === 'status' ? 600 : 400,
                backgroundColor: activeTab === 'status' ? '#e8f5e8' : 'transparent',
                border: activeTab === 'status' ? '2px solid #4caf50' : '2px solid transparent'
              }
            }}
          >
            ステータス
          </Tabs.Tab>
          <Tabs.Tab
            value="parameter"
            styles={{
              tab: {
                fontWeight: activeTab === 'parameter' ? 600 : 400,
                backgroundColor: activeTab === 'parameter' ? '#fff3e0' : 'transparent',
                border: activeTab === 'parameter' ? '2px solid #ff9800' : '2px solid transparent'
              }
            }}
          >
            パラメータ
          </Tabs.Tab>
          <Tabs.Tab
            value="skill"
            styles={{
              tab: {
                fontWeight: activeTab === 'skill' ? 600 : 400,
                backgroundColor: activeTab === 'skill' ? '#f3e5f5' : 'transparent',
                border: activeTab === 'skill' ? '2px solid #9c27b0' : '2px solid transparent'
              }
            }}
          >
            スキル
          </Tabs.Tab>
        </Tabs.List>
      </Tabs>

      <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpened(true)} variant="outline">
        フィールド追加
      </Button>

      <Button onClick={onSave}>保存</Button>

      <Stack gap="xs">
        {fieldsInTab.map((f) => (
          <div key={f.id} style={{ padding: 8, border: '1px solid #ccc', borderRadius: 4 }}>
            <strong>{f.type}</strong>: {f.id} — {f.label}
            {f.type === 'computed' && <div style={{ fontSize: 12, color: '#666' }}>式: {f.formula}</div>}
            {f.type === 'roll' && <div style={{ fontSize: 12, color: '#666' }}>ダイス: {f.diceFormula}</div>}
          </div>
        ))}
      </Stack>

      {validationErrors.length > 0 && (
        <Alert icon={<IconAlertCircle />} title="バリデーションエラー" color="red">
          <ul>
            {validationErrors.map((e, i) => (
              <li key={i}>
                {e.field && `[${e.field}] `}
                {e.message}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <FieldAddModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        onAddField={addField}
        activeTab={activeTab}
        existingFields={template.fields}
      />
    </Stack>
  )
}
