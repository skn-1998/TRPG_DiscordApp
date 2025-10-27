import { Text } from '@mantine/core'
import type { ReferencePart, NumberConfig } from '../types/formula'

interface FormulaPreviewProps {
  numberConfig: NumberConfig
}

export const FormulaPreview = ({ numberConfig }: FormulaPreviewProps) => {
  // 参照式を構築
  const buildReferenceFormula = (parts: ReferencePart[]): string => {
    console.log('🔧 buildReferenceFormula開始:', { parts })

    const filteredParts = parts.filter((part) => part.field || part.value !== undefined)
    console.log('📝 フィルタ後のパーツ:', { filteredParts })

    if (filteredParts.length === 0) {
      console.log('❌ フィルタ後のパーツが空のため空文字を返す')
      return ''
    }

    const resultParts: string[] = []

    filteredParts.forEach((part, index) => {
      console.log(`🔄 パーツ処理中 (${index}):`, { part })

      // 最初のパートでない場合、前のパートの演算子を追加（パート間の結合）
      if (index > 0 && filteredParts[index - 1].operator) {
        resultParts.push(filteredParts[index - 1].operator!)
        console.log(`➕ パート間結合演算子追加: ${filteredParts[index - 1].operator!}`)
      }

      // 現在のパートの内容を追加（field operator value の形式）
      let partResult = ''
      if (part.field) partResult += `{${part.field}}`
      if (part.operator) partResult += ` ${part.operator}`
      if (part.value !== undefined) partResult += ` ${part.value}`

      if (partResult.trim()) {
        resultParts.push(partResult.trim())
        console.log(`📦 パート結果追加: ${partResult.trim()}`)
      }
    })

    const finalResult = resultParts.join(' ')
    console.log('✅ 参照式構築完了:', {
      resultParts,
      finalResult,
      explanation:
        filteredParts.length === 1
          ? 'パートが1つのため演算子は表示されません（正常）'
          : '複数パートの場合、前のパートの演算子が表示されます'
    })

    return finalResult
  }

  // プレビュー式を生成
  const generatePreviewFormula = (): string => {
    console.log('🎯 generatePreviewFormula開始:', { numberConfig })

    const { diceFormula, operation, referenceParts } = numberConfig

    if (diceFormula && referenceParts && referenceParts.length > 0) {
      const referenceFormula = buildReferenceFormula(referenceParts)
      const result = `[${diceFormula}] ${operation} ${referenceFormula}`
      console.log('🎲 ダイス + 参照式:', { diceFormula, operation, referenceFormula, result })
      return result
    } else if (diceFormula) {
      const result = `[${diceFormula}]`
      console.log('🎲 ダイスのみ:', { diceFormula, result })
      return result
    } else if (referenceParts && referenceParts.length > 0) {
      const result = buildReferenceFormula(referenceParts)
      console.log('🔗 参照式のみ:', { referenceParts, result })
      return result
    }

    console.log('❌ プレビュー式なし - 空文字を返す')
    return ''
  }

  // プレビューが表示可能かチェック
  const shouldShowPreview = (): boolean => {
    return !!(numberConfig.diceFormula || (numberConfig.referenceParts && numberConfig.referenceParts.length > 0))
  }

  if (!shouldShowPreview()) {
    return null
  }

  return (
    <div style={{ padding: 8, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
      <Text size="xs" c="dimmed">
        結果例:
      </Text>
      <Text size="sm">{generatePreviewFormula()}</Text>
    </div>
  )
}
