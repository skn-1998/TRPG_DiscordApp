// 動的シート表示コンポーネント

import { useState, useEffect } from 'react'
import { Grid, Box, Text, Button, Group, Card, Container } from '@mantine/core'
import { IconRefresh, IconSave } from '@tabler/icons-react'
import { CellRenderer } from './CellRenderer'
import { 
  GridTemplate, 
  CharacterSheet, 
  createCellKey, 
  setCellValue, 
  getCellValueWithDefault,
  createEmptySheet
} from '../../types'
import { cellCalculator } from '../../utils'

interface DynamicSheetProps {
  template: GridTemplate
  sheet?: CharacterSheet
  onSheetChange?: (sheet: CharacterSheet) => void
  onSave?: (sheet: CharacterSheet) => void
  readOnly?: boolean
}

export function DynamicSheet({ 
  template, 
  sheet, 
  onSheetChange, 
  onSave,
  readOnly = false 
}: DynamicSheetProps) {
  const [currentSheet, setCurrentSheet] = useState<CharacterSheet>(
    sheet || createEmptySheet(template.id, '')
  )
  const [isCalculating, setIsCalculating] = useState(false)

  useEffect(() => {
    if (sheet) {
      setCurrentSheet(sheet)
    }
  }, [sheet])

  const handleCellValueChange = (cellId: string, value: string | number) => {
    const updatedSheet = setCellValue(currentSheet, cellId, value)
    setCurrentSheet(updatedSheet)
    onSheetChange?.(updatedSheet)
  }

  const handleRecalculate = async () => {
    setIsCalculating(true)
    try {
      const calculatedSheet = cellCalculator.calculateSheet(template, currentSheet)
      setCurrentSheet(calculatedSheet)
      onSheetChange?.(calculatedSheet)
    } catch (error) {
      console.error('計算エラー:', error)
    } finally {
      setIsCalculating(false)
    }
  }

  const handleSave = () => {
    onSave?.(currentSheet)
  }

  const renderGrid = () => {
    const gridCells = []
    
    for (let row = 0; row < template.dimensions.rows; row++) {
      const rowCells = []
      
      for (let col = 0; col < template.dimensions.cols; col++) {
        const cellKey = createCellKey(row, col)
        const cellTemplate = template.cells.get(cellKey)
        
        if (cellTemplate) {
          const cellValue = currentSheet.values.get(cellTemplate.id)
          
          rowCells.push(
            <Grid.Col key={cellKey} span={2}>
              <CellRenderer
                cellTemplate={cellTemplate}
                cellValue={cellValue}
                onValueChange={(value) => handleCellValueChange(cellTemplate.id, value)}
                readOnly={readOnly}
              />
            </Grid.Col>
          )
        } else {
          // 空のセル
          rowCells.push(
            <Grid.Col key={cellKey} span={2}>
              <Box h={60} />
            </Grid.Col>
          )
        }
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
    <Container size="xl">
      <Card withBorder radius="md" p="lg">
        {/* ヘッダー */}
        <Group justify="space-between" mb="md">
          <div>
            <Text size="lg" fw={600}>
              {template.name}
            </Text>
            <Text size="sm" c="dimmed">
              {template.description}
            </Text>
          </div>
          
          <Group>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={handleRecalculate}
              loading={isCalculating}
              disabled={readOnly}
            >
              再計算
            </Button>
            
            {onSave && (
              <Button
                leftSection={<IconSave size={16} />}
                onClick={handleSave}
                disabled={readOnly}
              >
                保存
              </Button>
            )}
          </Group>
        </Group>
        
        {/* グリッド */}
        <Box>
          {renderGrid()}
        </Box>
        
        {/* フッター情報 */}
        <Group justify="space-between" mt="md" pt="md" style={{ borderTop: '1px solid #e9ecef' }}>
          <Text size="xs" c="dimmed">
            最終計算: {currentSheet.lastCalculated.toLocaleString()}
          </Text>
          <Text size="xs" c="dimmed">
            セル数: {template.cells.size}
          </Text>
        </Group>
      </Card>
    </Container>
  )
}