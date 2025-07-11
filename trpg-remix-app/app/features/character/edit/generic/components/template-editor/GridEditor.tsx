// グリッドエディタコンポーネント

import { useState } from 'react'
import { 
  Grid, 
  Box, 
  Button, 
  Group, 
  Text, 
  NumberInput, 
  TextInput, 
  Textarea, 
  Select,
  Card,
  Stack,
  ActionIcon,
  Badge
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconEye } from '@tabler/icons-react'
import { CellEditor } from './CellEditor'
import { DynamicSheet } from '../sheet-renderer'
import { 
  GridTemplate, 
  CellTemplate, 
  createCellKey, 
  createEmptySheet
} from '../../types'

interface GridEditorProps {
  template: GridTemplate
  onTemplateChange: (template: GridTemplate) => void
  onSave: () => void
}

export function GridEditor({ template, onTemplateChange, onSave }: GridEditorProps) {
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [editingCell, setEditingCell] = useState<CellTemplate | null>(null)
  const [showCellEditor, setShowCellEditor] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const handleTemplateInfoChange = (field: keyof GridTemplate, value: any) => {
    onTemplateChange({
      ...template,
      [field]: value,
      updatedAt: new Date()
    })
  }

  const handleDimensionChange = (field: 'rows' | 'cols', value: number) => {
    onTemplateChange({
      ...template,
      dimensions: {
        ...template.dimensions,
        [field]: value
      },
      updatedAt: new Date()
    })
  }

  const handleCellClick = (row: number, col: number) => {
    setSelectedCell({ row, col })
    const cellKey = createCellKey(row, col)
    const existingCell = template.cells.get(cellKey)
    
    if (existingCell) {
      setEditingCell(existingCell)
    } else {
      setEditingCell(null)
    }
  }

  const handleAddCell = () => {
    if (!selectedCell) return
    
    setEditingCell(null)
    setShowCellEditor(true)
  }

  const handleEditCell = () => {
    if (!selectedCell) return
    
    const cellKey = createCellKey(selectedCell.row, selectedCell.col)
    const existingCell = template.cells.get(cellKey)
    
    if (existingCell) {
      setEditingCell(existingCell)
      setShowCellEditor(true)
    }
  }

  const handleDeleteCell = () => {
    if (!selectedCell) return
    
    const cellKey = createCellKey(selectedCell.row, selectedCell.col)
    const newCells = new Map(template.cells)
    newCells.delete(cellKey)
    
    onTemplateChange({
      ...template,
      cells: newCells,
      updatedAt: new Date()
    })
    
    setSelectedCell(null)
    setEditingCell(null)
  }

  const handleSaveCell = (cell: CellTemplate) => {
    if (!selectedCell) return
    
    const cellKey = createCellKey(selectedCell.row, selectedCell.col)
    const newCells = new Map(template.cells)
    newCells.set(cellKey, cell)
    
    onTemplateChange({
      ...template,
      cells: newCells,
      updatedAt: new Date()
    })
    
    setShowCellEditor(false)
    setEditingCell(null)
  }

  const handleCancelCellEdit = () => {
    setShowCellEditor(false)
    setEditingCell(null)
  }

  const getAvailableReferences = (): string[] => {
    const references: string[] = []
    for (const cell of template.cells.values()) {
      if (cell.type === 'number' || cell.type === 'text') {
        references.push(cell.name)
      }
    }
    return references
  }

  const renderGrid = () => {
    const gridCells = []
    
    for (let row = 0; row < template.dimensions.rows; row++) {
      const rowCells = []
      
      for (let col = 0; col < template.dimensions.cols; col++) {
        const cellKey = createCellKey(row, col)
        const cellTemplate = template.cells.get(cellKey)
        const isSelected = selectedCell?.row === row && selectedCell?.col === col
        
        rowCells.push(
          <Grid.Col key={cellKey} span={2}>
            <Box
              onClick={() => handleCellClick(row, col)}
              style={{
                height: 80,
                border: `2px solid ${isSelected ? '#1976d2' : '#e0e0e0'}`,
                borderRadius: 4,
                padding: 8,
                cursor: 'pointer',
                backgroundColor: isSelected ? '#f5f5f5' : 'white'
              }}
            >
              {cellTemplate ? (
                <div>
                  <Text size="xs" fw={500} mb={2}>
                    {cellTemplate.name}
                  </Text>
                  <Badge size="xs" color="blue">
                    {cellTemplate.type}
                  </Badge>
                  {cellTemplate.formula && (
                    <Text size="xs" c="dimmed" mt={2}>
                      {cellTemplate.formula}
                    </Text>
                  )}
                </div>
              ) : (
                <Text size="xs" c="dimmed" ta="center" mt={20}>
                  空のセル
                </Text>
              )}
            </Box>
          </Grid.Col>
        )
      }
      
      gridCells.push(
        <Grid key={row} gutter="xs" mb="xs">
          {rowCells}
        </Grid>
      )
    }
    
    return gridCells
  }

  return (
    <Stack gap="md">
      {/* テンプレート情報 */}
      <Card withBorder p="md">
        <Text size="sm" fw={500} mb="md">テンプレート情報</Text>
        
        <Grid gutter="md">
          <Grid.Col span={6}>
            <TextInput
              label="テンプレート名"
              value={template.name}
              onChange={(e: any) => handleTemplateInfoChange('name', e.target.value)}
              required
            />
          </Grid.Col>
          
          <Grid.Col span={6}>
            <Select
              label="ゲームシステム"
              value={template.gameSystem}
              onChange={(value: any) => handleTemplateInfoChange('gameSystem', value)}
              data={[
                { value: 'Generic', label: '汎用' },
                { value: 'CoC', label: 'クトゥルフ神話TRPG' },
                { value: 'D&D5e', label: 'D&D 5e' },
                { value: 'SW2.5', label: 'ソードワールド2.5' }
              ]}
            />
          </Grid.Col>
          
          <Grid.Col span={12}>
            <Textarea
              label="説明"
              value={template.description}
              onChange={(e: any) => handleTemplateInfoChange('description', e.target.value)}
              minRows={2}
            />
          </Grid.Col>
        </Grid>
      </Card>

      {/* グリッド設定 */}
      <Card withBorder p="md">
        <Text size="sm" fw={500} mb="md">グリッド設定</Text>
        
        <Group>
          <NumberInput
            label="行数"
            value={template.dimensions.rows}
            onChange={(value: any) => handleDimensionChange('rows', value || 1)}
            min={1}
            max={20}
          />
          
          <NumberInput
            label="列数"
            value={template.dimensions.cols}
            onChange={(value: any) => handleDimensionChange('cols', value || 1)}
            min={1}
            max={12}
          />
        </Group>
      </Card>

      {/* セル操作 */}
      <Card withBorder p="md">
        <Group justify="space-between" mb="md">
          <Text size="sm" fw={500}>セル操作</Text>
          
          <Group>
            <ActionIcon
              variant="filled"
              color="blue"
              onClick={handleAddCell}
              disabled={!selectedCell}
            >
              <IconPlus size={16} />
            </ActionIcon>
            
            <ActionIcon
              variant="filled"
              color="green"
              onClick={handleEditCell}
              disabled={!selectedCell || !editingCell}
            >
              <IconEdit size={16} />
            </ActionIcon>
            
            <ActionIcon
              variant="filled"
              color="red"
              onClick={handleDeleteCell}
              disabled={!selectedCell || !editingCell}
            >
              <IconTrash size={16} />
            </ActionIcon>
            
            <Button
              variant="light"
              leftSection={<IconEye size={16} />}
              onClick={() => setShowPreview(true)}
            >
              プレビュー
            </Button>
          </Group>
        </Group>
        
        {selectedCell && (
          <Text size="xs" c="dimmed">
            選択中: 行 {selectedCell.row + 1}, 列 {selectedCell.col + 1}
          </Text>
        )}
      </Card>

      {/* グリッド表示 */}
      <Card withBorder p="md">
        <Text size="sm" fw={500} mb="md">グリッド</Text>
        
        <Box>
          {renderGrid()}
        </Box>
      </Card>

      {/* 保存ボタン */}
      <Group justify="flex-end">
        <Button onClick={onSave} size="lg">
          テンプレートを保存
        </Button>
      </Group>

      {/* セルエディタ */}
      <CellEditor
        cell={editingCell}
        onSave={handleSaveCell}
        onCancel={handleCancelCellEdit}
        availableReferences={getAvailableReferences()}
        opened={showCellEditor}
      />

      {/* プレビューモーダル */}
      {showPreview && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000 }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 800, backgroundColor: 'white', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: 16, borderBottom: '1px solid #e0e0e0' }}>
              <Group justify="space-between">
                <Text size="lg" fw={500}>プレビュー</Text>
                <Button onClick={() => setShowPreview(false)}>閉じる</Button>
              </Group>
            </div>
            <div style={{ maxHeight: 600, overflow: 'auto' }}>
              <DynamicSheet
                template={template}
                sheet={createEmptySheet(template.id, 'preview')}
                readOnly={true}
              />
            </div>
          </div>
        </div>
      )}
    </Stack>
  )
}