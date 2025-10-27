import { useState, useEffect } from 'react'
import { Modal, TextInput, Select, Button, Stack, Group, Text, NumberInput, Divider } from '@mantine/core'
import type { Field, FieldType, TabType } from '../types'
import type { NumberConfig, ReferencePart } from '../types/formula'
import { FormulaPreview } from './FormulaPreview'

interface FieldAddModalProps {
  opened: boolean
  onClose: () => void
  onAddField: (field: Field) => void
  activeTab: TabType
  existingFields: Field[]
}

export const FieldAddModal = ({ opened, onClose, onAddField, activeTab, existingFields }: FieldAddModalProps) => {
  const [title, setTitle] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [numberConfig, setNumberConfig] = useState<NumberConfig>({})

  // 既存のNumberフィールドを取得
  const numberFields = existingFields.filter((f) => f.type === 'number' || f.type === 'computed' || f.type === 'roll')

  useEffect(() => {
    if (!opened) {
      resetForm()
    }
  }, [opened])

  // フォームをリセット
  const resetForm = () => {
    setTitle('')
    setFieldType('text')
    setNumberConfig({})
  }

  // 参照部分を追加
  const addReferencePart = () => {
    console.log('➕ 参照部分追加開始:', { currentParts: numberConfig.referenceParts })
    const newParts = [...(numberConfig.referenceParts || [])]
    newParts.push({ operator: '+' })
    console.log('➕ 参照部分追加完了:', { newParts })
    setNumberConfig({ ...numberConfig, referenceParts: newParts })
  }

  // 参照部分を削除
  const removeReferencePart = (index: number) => {
    console.log('➖ 参照部分削除開始:', { index, currentParts: numberConfig.referenceParts })
    const newParts = [...(numberConfig.referenceParts || [])]
    newParts.splice(index, 1)
    console.log('➖ 参照部分削除完了:', { newParts })
    setNumberConfig({ ...numberConfig, referenceParts: newParts })
  }

  // 参照部分を更新
  const updateReferencePart = (index: number, updates: Partial<ReferencePart>) => {
    console.log('🔄 参照部分更新開始:', { index, updates, currentParts: numberConfig.referenceParts })
    const newParts = [...(numberConfig.referenceParts || [])]
    newParts[index] = { ...newParts[index], ...updates }
    console.log('🔄 参照部分更新完了:', { newParts })
    setNumberConfig({ ...numberConfig, referenceParts: newParts })
  }

  // 四則演算セレクトが表示可能かチェック
  const shouldShowOperationSelect = (): boolean => {
    return !!(numberConfig.diceFormula && numberConfig.referenceParts && numberConfig.referenceParts.length > 0)
  }

  // ベースフィールドを生成
  const createBaseField = () => ({
    id: `field_${Math.random().toString(36).slice(2, 9)}`,
    label: title.trim(),
    tab: activeTab
  })

  // フィールドタイプに基づいてフィールドを生成
  const createFieldByType = (baseField: any): Field => {
    switch (fieldType) {
      case 'text':
        return { ...baseField, type: 'text', defaultValue: '' }

      case 'textarea':
        return { ...baseField, type: 'textarea', defaultValue: '', rows: 3 }

      case 'number':
        return createNumberField(baseField)

      default:
        return { ...baseField, type: 'text', defaultValue: '' }
    }
  }

  // 参照式を構築（フィールド生成用）
  const buildReferenceFormula = (parts: ReferencePart[]): string => {
    const filteredParts = parts.filter((part) => part.field || part.value !== undefined)

    if (filteredParts.length === 0) {
      return ''
    }

    const resultParts: string[] = []

    filteredParts.forEach((part, index) => {
      // 最初のパートでない場合、前のパートの演算子を追加（パート間の結合）
      if (index > 0 && filteredParts[index - 1].operator) {
        resultParts.push(filteredParts[index - 1].operator!)
      }

      // 現在のパートの内容を追加（field operator value の形式）
      let partResult = ''
      if (part.field) partResult += `{${part.field}}`
      if (part.operator) partResult += ` ${part.operator}`
      if (part.value !== undefined) partResult += ` ${part.value}`

      if (partResult.trim()) {
        resultParts.push(partResult.trim())
      }
    })

    return resultParts.join(' ')
  }

  // Numberフィールドを生成
  const createNumberField = (baseField: any): Field => {
    console.log('🏗️ createNumberField開始:', { baseField, numberConfig })

    const referenceParts = numberConfig.referenceParts || []
    const hasReference = referenceParts.length > 0 && referenceParts.some((part) => part.field)

    console.log('🔍 参照チェック:', { referenceParts, hasReference })

    if (numberConfig.diceFormula && hasReference) {
      // ダイス + 他ステータス参照
      const dicePart = `[${numberConfig.diceFormula}]`
      const referenceFormula = buildReferenceFormula(referenceParts)
      const formula = `${dicePart} ${numberConfig.operation || '+'} ${referenceFormula}`
      const result = { ...baseField, type: 'computed', formula }
      console.log('🎲➕🔗 ダイス + 参照式フィールド生成:', { dicePart, referenceFormula, formula, result })
      return result
    } else if (numberConfig.diceFormula) {
      // ダイスのみ
      const result = { ...baseField, type: 'roll', diceFormula: `[${numberConfig.diceFormula}]` }
      console.log('🎲 ダイスのみフィールド生成:', { result })
      return result
    } else if (hasReference) {
      // 他ステータス参照のみ
      const formula = buildReferenceFormula(referenceParts)
      const result = { ...baseField, type: 'computed', formula }
      console.log('🔗 参照式のみフィールド生成:', { formula, result })
      return result
    } else {
      // 通常のNumber
      const result = { ...baseField, type: 'number' }
      console.log('🔢 通常Numberフィールド生成:', { result })
      return result
    }
  }

  // フィールド追加処理
  const handleAdd = () => {
    console.log('🚀 handleAdd開始:', { title, fieldType, numberConfig })

    if (!title.trim()) {
      console.log('❌ タイトルが空のため処理を中断')
      return
    }

    const baseField = createBaseField()
    console.log('📝 ベースフィールド生成:', { baseField })

    const newField = createFieldByType(baseField)
    console.log('🎯 最終フィールド生成:', { newField })

    onAddField(newField)
    onClose()

    console.log('✅ フィールド追加完了')
  }

  return (
    <Modal opened={opened} onClose={onClose} title="フィールド追加" size="md">
      <Stack gap="md">
        <TextInput
          label="Inputタイトル"
          placeholder="フィールド名を入力"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <Select
          label="入力形式"
          placeholder="形式を選択"
          data={[
            { value: 'text', label: 'Text' },
            { value: 'textarea', label: 'Textarea' },
            { value: 'number', label: 'Number' }
          ]}
          value={fieldType}
          onChange={(value) => setFieldType(value as FieldType)}
        />

        {fieldType === 'number' && (
          <Stack gap="md">
            <Text size="sm" fw={500}>
              Number詳細設定
            </Text>

            {/* 1Dice */}
            <TextInput
              label="1Dice"
              placeholder="1d6+3"
              description="ダイス式を入力（例: 1d6+3, 2d6, 1d20-1）"
              value={numberConfig.diceFormula || ''}
              onChange={(e) => {
                console.log('🎲 ダイス式変更:', { oldValue: numberConfig.diceFormula, newValue: e.target.value })
                setNumberConfig({ ...numberConfig, diceFormula: e.target.value })
              }}
            />

            {/* 四則演算セレクト */}
            {shouldShowOperationSelect() && (
              <Select
                label="四則演算"
                placeholder="演算子を選択"
                data={[
                  { value: '+', label: '+' },
                  { value: '-', label: '-' },
                  { value: '*', label: '×' },
                  { value: '/', label: '÷' }
                ]}
                value={numberConfig.operation}
                onChange={(value) => {
                  console.log('🔢 演算子変更:', { oldValue: numberConfig.operation, newValue: value })
                  setNumberConfig({ ...numberConfig, operation: value as '+' | '-' | '*' | '/' })
                }}
              />
            )}

            {/* 2他ステータス名参照（複数対応） */}
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" fw={500}>
                  2他ステータス名参照
                </Text>
                <Button size="xs" onClick={addReferencePart} variant="outline">
                  + 追加
                </Button>
              </Group>

              {(numberConfig.referenceParts || []).map((part, index) => (
                <Group key={index} align="flex-end">
                  <Select
                    label={index === 0 ? '参照フィールド' : ''}
                    placeholder="フィールド選択"
                    data={numberFields.map((f) => ({ value: f.id, label: f.label }))}
                    value={part.field}
                    onChange={(value) => {
                      console.log('🔗 参照フィールド変更:', { index, oldValue: part.field, newValue: value })
                      updateReferencePart(index, { field: value || undefined })
                    }}
                    clearable
                    style={{ flex: 1 }}
                  />

                  <Select
                    label={index === 0 ? '演算子' : ''}
                    placeholder="演算子"
                    data={[
                      { value: '+', label: '+' },
                      { value: '-', label: '-' },
                      { value: '*', label: '×' },
                      { value: '/', label: '÷' }
                    ]}
                    value={part.operator}
                    onChange={(value) => {
                      console.log('➕ 参照演算子変更:', { index, oldValue: part.operator, newValue: value })
                      updateReferencePart(index, { operator: value as '+' | '-' | '*' | '/' })
                    }}
                    style={{ flex: 0.5 }}
                  />

                  <NumberInput
                    label={index === 0 ? '数値' : ''}
                    placeholder="数値"
                    value={part.value}
                    onChange={(value) => {
                      console.log('🔢 参照数値変更:', { index, oldValue: part.value, newValue: value })
                      updateReferencePart(index, { value: typeof value === 'number' ? value : undefined })
                    }}
                    style={{ flex: 0.5 }}
                  />

                  <Button
                    size="xs"
                    color="red"
                    variant="outline"
                    onClick={() => removeReferencePart(index)}
                    style={{ marginBottom: 4 }}
                  ></Button>
                </Group>
              ))}
            </Stack>

            {/* プレビュー */}
            <FormulaPreview numberConfig={numberConfig} />
          </Stack>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleAdd} disabled={!title.trim()}>
            追加
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
