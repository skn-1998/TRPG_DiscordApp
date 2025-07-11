import * as React from 'react'
import { useState, useCallback, useEffect } from 'react'
import {
  Paper,
  Grid,
  TextInput,
  Select,
  Button,
  Modal,
  Title,
  Group,
  Stack,
  Card,
  Text,
  ActionIcon,
  Tooltip,
  NumberInput,
  ColorInput,
  Switch,
  Textarea,
  Badge,
  Container,
  Box,
  Tabs,
  ScrollArea
} from '@mantine/core'
import {
  IconPlus,
  IconTrash,
  IconEdit,
  IconSave,
  IconEye,
  IconGrid3X3,
  IconSettings,
  IconCalculator,
  IconDice,
  IconCopy,
  IconDownload,
  IconUpload
} from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { CellData, CharacterSheetTemplate } from '~/types/characterSheet'
import { calculateAllCellValues, hasCircularReference } from '~/utils/formulaEngine'

interface CharacterSheetEditorProps {
  template?: CharacterSheetTemplate
  onSave?: (template: CharacterSheetTemplate) => void
  onPreview?: (template: CharacterSheetTemplate) => void
}

export function CharacterSheetEditor({ template, onSave, onPreview }: CharacterSheetEditorProps) {
  const [editingTemplate, setEditingTemplate] = useState<CharacterSheetTemplate>(
    template || {
      id: '',
      name: '',
      gameSystemId: '',
      version: '1.0',
      author: '',
      description: '',
      gridSize: { rows: 10, cols: 8 },
      cells: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  )

  const [selectedCell, setSelectedCell] = useState<CellData | null>(null)
  const [cellModalOpened, { open: openCellModal, close: closeCellModal }] = useDisclosure(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [calculatedValues, setCalculatedValues] = useState<Record<string, any>>({})

  // セル編集用の状態
  const [editingCell, setEditingCell] = useState<Partial<CellData>>({})

  // 計算値を更新
  const updateCalculatedValues = useCallback(() => {
    const values = calculateAllCellValues(editingTemplate.cells)
    setCalculatedValues(values)
  }, [editingTemplate.cells])

  useEffect(() => {
    updateCalculatedValues()
  }, [updateCalculatedValues])

  // セルを追加
  const addCell = useCallback((row: number, col: number) => {
    const newCell: CellData = {
      id: `cell_${Date.now()}`,
      name: `Cell_${row}_${col}`,
      value: '',
      type: 'text',
      row,
      col,
      rowSpan: 1,
      colSpan: 1
    }
    setEditingCell(newCell)
    setSelectedCell(newCell)
    openCellModal()
  }, [openCellModal])

  // セルを編集
  const editCell = useCallback((cell: CellData) => {
    setEditingCell({ ...cell })
    setSelectedCell(cell)
    openCellModal()
  }, [openCellModal])

  // セルを削除
  const deleteCell = useCallback((cellId: string) => {
    setEditingTemplate(prev => ({
      ...prev,
      cells: prev.cells.filter(cell => cell.id !== cellId)
    }))
  }, [])

  // セルを保存
  const saveCell = useCallback(() => {
    if (!editingCell.name?.trim()) {
      notifications.show({
        title: 'エラー',
        message: 'セル名を入力してください',
        color: 'red'
      })
      return
    }

      // 循環参照チェック
  const testCells = editingTemplate.cells.map((cell: CellData) => 
    cell.id === editingCell.id ? { ...cell, ...editingCell } : cell
  )
  
  if (!editingCell.id) {
    testCells.push(editingCell as CellData)
  }

  if (hasCircularReference(testCells)) {
    notifications.show({
      title: 'エラー',
      message: '循環参照が発生しています',
      color: 'red'
    })
    return
  }

  setEditingTemplate((prev: CharacterSheetTemplate) => {
    const newCells = [...prev.cells]
    const existingIndex = newCells.findIndex((cell: CellData) => cell.id === editingCell.id)
    
    if (existingIndex >= 0) {
      newCells[existingIndex] = { ...newCells[existingIndex], ...editingCell }
    } else {
      newCells.push(editingCell as CellData)
    }

    return {
      ...prev,
      cells: newCells,
      updatedAt: new Date().toISOString()
    }
  })

    closeCellModal()
    setEditingCell({})
  }, [editingCell, editingTemplate.cells, closeCellModal])

  // グリッドサイズを変更
  const updateGridSize = useCallback((rows: number, cols: number) => {
    setEditingTemplate(prev => ({
      ...prev,
      gridSize: { rows, cols }
    }))
  }, [])

  // テンプレートを保存
  const saveTemplate = useCallback(() => {
    if (!editingTemplate.name.trim()) {
      notifications.show({
        title: 'エラー',
        message: 'テンプレート名を入力してください',
        color: 'red'
      })
      return
    }

    onSave?.(editingTemplate)
    notifications.show({
      title: '保存完了',
      message: 'テンプレートを保存しました',
      color: 'green'
    })
  }, [editingTemplate, onSave])

  // セルが存在するかチェック
  const getCellAt = useCallback((row: number, col: number) => {
    return editingTemplate.cells.find(cell => 
      cell.row === row && cell.col === col
    )
  }, [editingTemplate.cells])

  // グリッドを描画
  const renderGrid = () => {
    const grid = []
    
    for (let row = 0; row < editingTemplate.gridSize.rows; row++) {
      const rowCells = []
      
      for (let col = 0; col < editingTemplate.gridSize.cols; col++) {
        const cell = getCellAt(row, col)
        
        rowCells.push(
          <Grid.Col key={`${row}-${col}`} span={1}>
            <Card
              h={60}
              withBorder
              style={{
                cursor: 'pointer',
                backgroundColor: cell?.style?.backgroundColor || 'transparent',
                color: cell?.style?.textColor || 'inherit'
              }}
              onClick={() => cell ? editCell(cell) : addCell(row, col)}
            >
              {cell ? (
                <Stack gap={2}>
                  <Text size="xs" fw={500} truncate>
                    {cell.name}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {previewMode ? (
                      calculatedValues[cell.id] || cell.value
                    ) : (
                      cell.value
                    )}
                  </Text>
                  {cell.type === 'calculated' && (
                    <Badge size="xs" color="blue">計算</Badge>
                  )}
                </Stack>
              ) : (
                <Box
                  h="100%"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.3
                  }}
                >
                  <IconPlus size={16} />
                </Box>
              )}
            </Card>
          </Grid.Col>
        )
      }
      
      grid.push(
        <Grid key={row} gutter="xs">
          {rowCells}
        </Grid>
      )
    }
    
    return grid
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        {/* ヘッダー */}
        <Group justify="space-between">
          <Title order={2}>キャラクターシートエディタ</Title>
          <Group>
            <Switch
              label="プレビューモード"
              checked={previewMode}
              onChange={(event) => setPreviewMode(event.currentTarget.checked)}
              leftSection={<IconEye size={16} />}
            />
            <Button
              leftSection={<IconSave size={16} />}
              onClick={saveTemplate}
            >
              保存
            </Button>
            <Button
              variant="outline"
              leftSection={<IconEye size={16} />}
              onClick={() => onPreview?.(editingTemplate)}
            >
              プレビュー
            </Button>
          </Group>
        </Group>

        {/* 設定タブ */}
        <Tabs defaultValue="basic">
          <Tabs.List>
            <Tabs.Tab value="basic" leftSection={<IconSettings size={16} />}>
              基本設定
            </Tabs.Tab>
            <Tabs.Tab value="grid" leftSection={<IconGrid3X3 size={16} />}>
              グリッド
            </Tabs.Tab>
            <Tabs.Tab value="preview" leftSection={<IconEye size={16} />}>
              プレビュー
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="basic">
            <Card withBorder mt="md">
              <Stack gap="md">
                <TextInput
                  label="テンプレート名"
                  placeholder="例：クトゥルフ神話TRPG キャラクターシート"
                  value={editingTemplate.name}
                  onChange={(e) => setEditingTemplate(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                  required
                />
                <TextInput
                  label="ゲームシステムID"
                  placeholder="例：Cthulhu"
                  value={editingTemplate.gameSystemId}
                  onChange={(e) => setEditingTemplate(prev => ({
                    ...prev,
                    gameSystemId: e.target.value
                  }))}
                />
                <TextInput
                  label="作成者"
                  placeholder="作成者名"
                  value={editingTemplate.author}
                  onChange={(e) => setEditingTemplate(prev => ({
                    ...prev,
                    author: e.target.value
                  }))}
                />
                <Textarea
                  label="説明"
                  placeholder="テンプレートの説明"
                  value={editingTemplate.description}
                  onChange={(e) => setEditingTemplate(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                />
                <Group>
                  <NumberInput
                    label="行数"
                    value={editingTemplate.gridSize.rows}
                    onChange={(value) => updateGridSize(value || 10, editingTemplate.gridSize.cols)}
                    min={1}
                    max={50}
                    w={100}
                  />
                  <NumberInput
                    label="列数"
                    value={editingTemplate.gridSize.cols}
                    onChange={(value) => updateGridSize(editingTemplate.gridSize.rows, value || 8)}
                    min={1}
                    max={20}
                    w={100}
                  />
                </Group>
              </Stack>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="grid">
            <Card withBorder mt="md">
              <ScrollArea h={600}>
                {renderGrid()}
              </ScrollArea>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel value="preview">
            <Card withBorder mt="md">
              <Text mb="md" c="dimmed">
                プレビューモード: 計算式の結果が表示されます
              </Text>
              <ScrollArea h={600}>
                {/* プレビュー用のグリッド */}
                <div style={{ opacity: 0.8 }}>
                  {renderGrid()}
                </div>
              </ScrollArea>
            </Card>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* セル編集モーダル */}
      <Modal
        opened={cellModalOpened}
        onClose={closeCellModal}
        title="セル編集"
        size="lg"
      >
        <Stack gap="md">
          <TextInput
            label="セル名"
            placeholder="例：STR, INT, HP"
            value={editingCell.name || ''}
            onChange={(e) => setEditingCell(prev => ({ ...prev, name: e.target.value }))}
            required
          />
          
          <Select
            label="セルタイプ"
            value={editingCell.type || 'text'}
            onChange={(value) => setEditingCell(prev => ({ ...prev, type: value as any }))}
            data={[
              { value: 'text', label: 'テキスト' },
              { value: 'number', label: '数値' },
              { value: 'stat', label: '能力値' },
              { value: 'skill', label: '技能' },
              { value: 'attribute', label: '属性' },
              { value: 'calculated', label: '計算値' }
            ]}
          />

          <Textarea
            label="値・計算式"
            placeholder="例：1d6, [STR]×5, 10+[INT]"
            value={editingCell.value || ''}
            onChange={(e) => setEditingCell(prev => ({ ...prev, value: e.target.value }))}
            description="ダイス（1d6）、セル参照（[セル名]）、計算式（+, -, *, /）が使用可能です"
          />

          <Group>
            <NumberInput
              label="行"
              value={editingCell.row || 0}
              onChange={(value) => setEditingCell(prev => ({ ...prev, row: value || 0 }))}
              min={0}
              max={editingTemplate.gridSize.rows - 1}
              w={80}
            />
            <NumberInput
              label="列"
              value={editingCell.col || 0}
              onChange={(value) => setEditingCell(prev => ({ ...prev, col: value || 0 }))}
              min={0}
              max={editingTemplate.gridSize.cols - 1}
              w={80}
            />
            <NumberInput
              label="行結合"
              value={editingCell.rowSpan || 1}
              onChange={(value) => setEditingCell(prev => ({ ...prev, rowSpan: value || 1 }))}
              min={1}
              max={5}
              w={80}
            />
            <NumberInput
              label="列結合"
              value={editingCell.colSpan || 1}
              onChange={(value) => setEditingCell(prev => ({ ...prev, colSpan: value || 1 }))}
              min={1}
              max={5}
              w={80}
            />
          </Group>

          <Group>
            <ColorInput
              label="背景色"
              value={editingCell.style?.backgroundColor || ''}
              onChange={(value) => setEditingCell(prev => ({
                ...prev,
                style: { ...prev.style, backgroundColor: value }
              }))}
            />
            <ColorInput
              label="文字色"
              value={editingCell.style?.textColor || ''}
              onChange={(value) => setEditingCell(prev => ({
                ...prev,
                style: { ...prev.style, textColor: value }
              }))}
            />
          </Group>

          <Switch
            label="読み取り専用"
            checked={editingCell.readonly || false}
            onChange={(event) => setEditingCell(prev => ({
              ...prev,
              readonly: event.currentTarget.checked
            }))}
          />

          <Group justify="flex-end">
            <Button variant="outline" onClick={closeCellModal}>
              キャンセル
            </Button>
            <Button onClick={saveCell}>
              保存
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  )
}