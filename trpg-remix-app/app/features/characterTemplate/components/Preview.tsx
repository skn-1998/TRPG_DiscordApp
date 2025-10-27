import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  Tabs,
  Button,
  Stack,
  TextInput,
  NumberInput,
  Textarea,
  Select,
  Checkbox,
  Group,
  Text,
  Code,
  Alert,
  Loader
} from '@mantine/core'
import { IconDice, IconAlertCircle, IconCheck } from '@tabler/icons-react'
import type { Template, TabType, Field, EvaluationContext } from '../types'
import { useTemplateStore } from '../store/templateStore'
import { rollDice } from '../utils/diceRoller'
import { useFieldCalculation } from '../hooks/useFieldCalculation'

export const Preview = () => {
  const { current, activeTab, setActiveTab } = useTemplateStore()
  const [values, setValues] = useState<EvaluationContext>({})
  const [isCalculating, setIsCalculating] = useState(false)
  const [calculationErrors, setCalculationErrors] = useState<string[]>([])
  const { recalculate, evaluateAll, batchUpdate, validateDependencies } = useFieldCalculation()

  const template: Template | undefined = useMemo(() => current, [current])

  // 初期値設定と計算フィールド評価
  useEffect(() => {
    if (!template) return

    setIsCalculating(true)
    setCalculationErrors([])

    try {
      // 依存関係の検証
      const validation = validateDependencies(template.fields)
      if (!validation.valid) {
        setCalculationErrors(validation.errors)
        setIsCalculating(false)
        return
      }

      const initialValues: EvaluationContext = {}
      for (const f of template.fields) {
        if (f.type === 'text' || f.type === 'textarea') initialValues[f.id] = f.defaultValue ?? ''
        if (f.type === 'number') initialValues[f.id] = f.defaultValue ?? undefined
        if (f.type === 'select') initialValues[f.id] = f.defaultValue ?? ''
        if (f.type === 'checkbox') initialValues[f.id] = f.defaultValue ?? false
      }

      const evaluatedValues = evaluateAll(template.fields, initialValues)
      setValues(evaluatedValues)
      setCalculationErrors([])
    } catch (error) {
      console.error('初期値設定エラー:', error)
      setCalculationErrors([`初期値設定エラー: ${error instanceof Error ? error.message : '不明なエラー'}`])
    } finally {
      setIsCalculating(false)
    }
  }, [template, evaluateAll, validateDependencies])

  const handleValueChange = useCallback(
    (fieldId: string, newValue: number | string | boolean | undefined) => {
      if (!template) return

      setIsCalculating(true)
      setCalculationErrors([])

      try {
        console.log('🔄 フィールド値変更:', { fieldId, newValue, currentValues: values })

        const updated = recalculate(fieldId, newValue, template.fields, values)
        setValues(updated)

        console.log('✅ フィールド値変更完了:', { fieldId, updatedValues: updated })
      } catch (error) {
        console.error('フィールド値変更エラー:', error)
        setCalculationErrors([`フィールド値変更エラー: ${error instanceof Error ? error.message : '不明なエラー'}`])
      } finally {
        setIsCalculating(false)
      }
    },
    [template, values, recalculate]
  )

  const handleRoll = useCallback(
    (field: Field) => {
      if (field.type !== 'roll') return
      const result = rollDice(field.diceFormula)
      if (result) {
        handleValueChange(field.id, result.total)
      }
    },
    [handleValueChange]
  )

  const handleBulkRoll = useCallback(() => {
    if (!template) return

    setIsCalculating(true)
    setCalculationErrors([])

    try {
      console.log('🎲 一括ロール開始:', { activeTab })

      const rollFields = template.fields.filter((f) => f.type === 'roll' && f.tab === activeTab)
      const updates: Record<string, number> = {}

      for (const f of rollFields) {
        if (f.type === 'roll') {
          const result = rollDice(f.diceFormula)
          if (result) {
            updates[f.id] = result.total
            console.log(`🎲 ${f.label}: ${f.diceFormula} = ${result.total}`)
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        const updated = batchUpdate(updates, template.fields, values)
        setValues(updated)
        console.log('✅ 一括ロール完了:', { updates, updatedValues: updated })
      }
    } catch (error) {
      console.error('一括ロールエラー:', error)
      setCalculationErrors([`一括ロールエラー: ${error instanceof Error ? error.message : '不明なエラー'}`])
    } finally {
      setIsCalculating(false)
    }
  }, [template, activeTab, values, batchUpdate])

  if (!template) return <div>テンプレートがありません</div>

  const fieldsInTab = template.fields.filter((f) => f.tab === activeTab)
  const hasRollFields = fieldsInTab.some((f) => f.type === 'roll')

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Text size="lg" fw={600}>
          プレビュー
        </Text>
        {isCalculating && (
          <Group gap="xs">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">
              計算中...
            </Text>
          </Group>
        )}
      </Group>

      {calculationErrors.length > 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="計算エラー">
          <Stack gap="xs">
            {calculationErrors.map((error, index) => (
              <Text key={index} size="sm">
                {error}
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

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

      {hasRollFields && (
        <Button
          onClick={handleBulkRoll}
          leftSection={<IconDice size={16} />}
          size="sm"
          loading={isCalculating}
          disabled={isCalculating}
        >
          全てロール
        </Button>
      )}

      <Stack gap="sm">
        {fieldsInTab.map((f) => {
          if (f.type === 'text')
            return (
              <TextInput
                key={f.id}
                label={f.label}
                description={f.description}
                required={f.required}
                value={(values[f.id] as string) ?? ''}
                onChange={(e) => handleValueChange(f.id, e.target.value)}
              />
            )

          if (f.type === 'textarea')
            return (
              <Textarea
                key={f.id}
                label={f.label}
                description={f.description}
                required={f.required}
                rows={f.rows}
                value={(values[f.id] as string) ?? ''}
                onChange={(e) => handleValueChange(f.id, e.target.value)}
              />
            )

          if (f.type === 'number')
            return (
              <NumberInput
                key={f.id}
                label={f.label}
                description={f.description}
                required={f.required}
                min={f.min}
                max={f.max}
                value={(values[f.id] as number | undefined) ?? undefined}
                onChange={(v) => handleValueChange(f.id, v as number | undefined)}
              />
            )

          if (f.type === 'select')
            return (
              <Select
                key={f.id}
                label={f.label}
                description={f.description}
                required={f.required}
                data={f.options.map((o) => ({ value: o.value, label: o.label }))}
                value={(values[f.id] as string) ?? ''}
                onChange={(v) => handleValueChange(f.id, v ?? '')}
              />
            )

          if (f.type === 'checkbox')
            return (
              <Checkbox
                key={f.id}
                label={f.label}
                description={f.description}
                checked={Boolean(values[f.id])}
                onChange={(e) => handleValueChange(f.id, e.target.checked)}
              />
            )

          if (f.type === 'computed')
            return (
              <TextInput
                key={f.id}
                label={f.label}
                description={f.description + ` (計算式: ${f.formula})`}
                value={values[f.id]?.toString() ?? 'Error'}
                readOnly
                styles={{
                  input: {
                    backgroundColor: '#f0f0f0',
                    color: values[f.id] === undefined ? '#d32f2f' : 'inherit'
                  }
                }}
                rightSection={
                  values[f.id] !== undefined ? (
                    <IconCheck size={16} color="#4caf50" />
                  ) : (
                    <IconAlertCircle size={16} color="#d32f2f" />
                  )
                }
              />
            )

          if (f.type === 'roll')
            return (
              <Group key={f.id} align="flex-end">
                <NumberInput
                  label={f.label}
                  description={f.description + ` (ダイス: ${f.diceFormula})`}
                  required={f.required}
                  value={(values[f.id] as number | undefined) ?? undefined}
                  onChange={(v) => handleValueChange(f.id, v as number | undefined)}
                  style={{ flex: 1 }}
                />
                <Button
                  onClick={() => handleRoll(f)}
                  leftSection={<IconDice size={16} />}
                  size="sm"
                  loading={isCalculating}
                  disabled={isCalculating}
                >
                  ロール
                </Button>
              </Group>
            )

          return null
        })}
      </Stack>

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>入力データ（JSON）</summary>
        <Code block mt="sm">
          {JSON.stringify(values, null, 2)}
        </Code>
      </details>
    </Stack>
  )
}
