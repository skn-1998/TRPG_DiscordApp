// セル設定エディタコンポーネント

import { useState, useEffect } from 'react'
import { 
  Modal, 
  TextInput, 
  Select, 
  NumberInput, 
  Switch, 
  ColorInput, 
  Button, 
  Group, 
  Stack, 
  Text, 
  Textarea,
  Card,
  Divider
} from '@mantine/core'
import { IconDeviceFloppy, IconX } from '@tabler/icons-react'
import { CellTemplate, createCellTemplate } from '../../types'

interface CellEditorProps {
  cell?: CellTemplate
  onSave: (cell: CellTemplate) => void
  onCancel: () => void
  availableReferences: string[]
  opened: boolean
}

export function CellEditor({ 
  cell, 
  onSave, 
  onCancel, 
  availableReferences, 
  opened 
}: CellEditorProps) {
  const [formData, setFormData] = useState<CellTemplate>(
    cell || createCellTemplate('', '', 'text')
  )

  useEffect(() => {
    if (cell) {
      setFormData(cell)
    }
  }, [cell])

  const handleSave = () => {
    if (!formData.name.trim()) {
      return
    }
    onSave(formData)
  }

  const handleFieldChange = (field: keyof CellTemplate, value: any) => {
    setFormData((prev: CellTemplate) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleValidationChange = (field: string, value: any) => {
    setFormData((prev: CellTemplate) => ({
      ...prev,
      validation: {
        ...prev.validation,
        [field]: value
      }
    }))
  }

  const handleStyleChange = (field: string, value: any) => {
    setFormData((prev: CellTemplate) => ({
      ...prev,
      style: {
        ...prev.style,
        [field]: value
      }
    }))
  }

  const insertReference = (reference: string) => {
    const formula = formData.formula || ''
    const newFormula = formula + `[${reference}]`
    handleFieldChange('formula', newFormula)
  }

  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={cell ? 'セル編集' : 'セル作成'}
      size="lg"
    >
      <Stack gap="md">
        {/* 基本設定 */}
        <Card withBorder p="md">
          <Text size="sm" fw={500} mb="md">基本設定</Text>
          
          <Stack gap="sm">
            <TextInput
              label="セル名"
              placeholder="例: STR, INT, HP"
              value={formData.name}
              onChange={(e: any) => handleFieldChange('name', e.target.value)}
              required
            />
            
            <TextInput
              label="セルID"
              placeholder="例: str, int, hp"
              value={formData.id}
              onChange={(e: any) => handleFieldChange('id', e.target.value)}
              description="英数字とアンダースコアのみ使用可能"
              required
            />
            
            <Select
              label="入力タイプ"
              value={formData.type}
              onChange={(value: any) => handleFieldChange('type', value)}
              data={[
                { value: 'text', label: 'テキスト' },
                { value: 'number', label: '数値' },
                { value: 'formula', label: '計算式' },
                { value: 'dice', label: 'ダイス' }
              ]}
            />
            
            {formData.type === 'number' && (
              <NumberInput
                label="デフォルト値"
                value={typeof formData.defaultValue === 'number' ? formData.defaultValue : 0}
                onChange={(value: any) => handleFieldChange('defaultValue', value)}
              />
            )}
            
            {formData.type === 'text' && (
              <TextInput
                label="デフォルト値"
                value={formData.defaultValue?.toString() || ''}
                onChange={(e: any) => handleFieldChange('defaultValue', e.target.value)}
              />
            )}
          </Stack>
        </Card>

        {/* 計算式設定 */}
        {(formData.type === 'formula' || formData.type === 'dice') && (
          <Card withBorder p="md">
            <Text size="sm" fw={500} mb="md">
              {formData.type === 'formula' ? '計算式' : 'ダイス記法'}
            </Text>
            
            <Stack gap="sm">
              <Textarea
                label={formData.type === 'formula' ? '計算式' : 'ダイス記法'}
                placeholder={
                  formData.type === 'formula' 
                    ? '例: [STR] * 5, [STR] + [CON]' 
                    : '例: 1d6, 2d10+5'
                }
                value={formData.formula || ''}
                onChange={(e: any) => handleFieldChange('formula', e.target.value)}
                minRows={3}
              />
              
              {formData.type === 'formula' && availableReferences.length > 0 && (
                <div>
                  <Text size="xs" c="dimmed" mb="xs">
                    参照可能なセル:
                  </Text>
                  <Group gap="xs">
                    {availableReferences.map(ref => (
                      <Button
                        key={ref}
                        size="xs"
                        variant="light"
                        onClick={() => insertReference(ref)}
                      >
                        {ref}
                      </Button>
                    ))}
                  </Group>
                </div>
              )}
            </Stack>
          </Card>
        )}

        {/* バリデーション設定 */}
        <Card withBorder p="md">
          <Text size="sm" fw={500} mb="md">バリデーション</Text>
          
          <Stack gap="sm">
            <Switch
              label="必須項目"
              checked={formData.validation?.required || false}
              onChange={(e: any) => handleValidationChange('required', e.target.checked)}
            />
            
            {formData.type === 'number' && (
              <>
                <NumberInput
                  label="最小値"
                  value={formData.validation?.min}
                  onChange={(value: any) => handleValidationChange('min', value)}
                />
                <NumberInput
                  label="最大値"
                  value={formData.validation?.max}
                  onChange={(value: any) => handleValidationChange('max', value)}
                />
              </>
            )}
          </Stack>
        </Card>

        {/* スタイル設定 */}
        <Card withBorder p="md">
          <Text size="sm" fw={500} mb="md">スタイル</Text>
          
          <Stack gap="sm">
            <ColorInput
              label="背景色"
              value={formData.style?.backgroundColor || '#ffffff'}
              onChange={(value: any) => handleStyleChange('backgroundColor', value)}
            />
            
            <ColorInput
              label="文字色"
              value={formData.style?.textColor || '#000000'}
              onChange={(value: any) => handleStyleChange('textColor', value)}
            />
            
            <NumberInput
              label="フォントサイズ"
              value={formData.style?.fontSize || 14}
              onChange={(value: any) => handleStyleChange('fontSize', value)}
              min={8}
              max={24}
            />
          </Stack>
        </Card>

        {/* ボタン */}
        <Group justify="flex-end">
          <Button 
            variant="light" 
            leftSection={<IconX size={16} />}
            onClick={onCancel}
          >
            キャンセル
          </Button>
          <Button 
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            disabled={!formData.name.trim()}
          >
            保存
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}