// セル表示コンポーネント

import { useState, useEffect } from 'react'
import { TextInput, NumberInput, Badge, Box, Text } from '@mantine/core'
import type { CellTemplate, CellValue } from '../../types'

interface CellRendererProps {
  cellTemplate: CellTemplate
  cellValue?: CellValue
  onValueChange: (value: string | number) => void
  readOnly?: boolean
  className?: string
}

export function CellRenderer({ 
  cellTemplate, 
  cellValue, 
  onValueChange, 
  readOnly = false,
  className 
}: CellRendererProps) {
  const [localValue, setLocalValue] = useState<string | number>('')

  useEffect(() => {
    if (cellValue) {
      // 計算セルの場合は計算結果を表示
      if (cellTemplate.type === 'formula' || cellTemplate.type === 'dice') {
        setLocalValue(cellValue.calculatedValue ?? cellValue.value)
      } else {
        setLocalValue(cellValue.value)
      }
    } else if (cellTemplate.defaultValue !== undefined) {
      setLocalValue(cellTemplate.defaultValue)
    }
  }, [cellValue, cellTemplate])

  const handleChange = (value: string | number) => {
    setLocalValue(value)
    onValueChange(value)
  }

  const renderInput = () => {
    const style = {
      backgroundColor: cellTemplate.style?.backgroundColor,
      color: cellTemplate.style?.textColor,
      fontSize: cellTemplate.style?.fontSize
    }

    switch (cellTemplate.type) {
      case 'number':
        return (
          <NumberInput
            value={typeof localValue === 'number' ? localValue : parseFloat(localValue.toString()) || 0}
            onChange={(value: string | number) => handleChange(value || 0)}
            disabled={readOnly}
            min={cellTemplate.validation?.min}
            max={cellTemplate.validation?.max}
            style={style}
            size="xs"
          />
        )

      case 'text':
        return (
          <TextInput
            value={localValue.toString()}
            onChange={(event: any) => handleChange(event.target.value)}
            disabled={readOnly}
            style={style}
            size="xs"
          />
        )

      case 'formula':
        return (
          <Box style={style}>
            <Text size="xs" c="dimmed">
              {cellTemplate.formula}
            </Text>
            <Text size="sm" fw={500}>
              {cellValue?.calculatedValue ?? '-'}
            </Text>
          </Box>
        )

      case 'dice':
        return (
          <Box style={style}>
            <Text size="xs" c="dimmed">
              {cellTemplate.formula}
            </Text>
            <Text size="sm" fw={500}>
              {cellValue?.calculatedValue ?? '-'}
            </Text>
          </Box>
        )

      default:
        return (
          <TextInput
            value={localValue.toString()}
            onChange={(event) => handleChange(event.target.value)}
            disabled={readOnly}
            size="xs"
          />
        )
    }
  }

  return (
    <Box className={className}>
      {/* セル名 */}
      <Text size="xs" fw={500} mb={2}>
        {cellTemplate.name}
      </Text>
      
      {/* 入力フィールド */}
      {renderInput()}
      
      {/* エラー表示 */}
      {cellValue?.error && (
        <Badge color="red" size="xs" mt={2}>
          {cellValue.error}
        </Badge>
      )}
      
      {/* 必須項目マーク */}
      {cellTemplate.validation?.required && (
        <Badge color="orange" size="xs" mt={2}>
          必須
        </Badge>
      )}
    </Box>
  )
}