import { formatPaletteLabel, stripMatchingPaletteValueSuffix } from '..'

describe('palette label', () => {
  it('数値と文字列の値を同じ書式で組み立てる', () => {
    expect(formatPaletteLabel('HP', 10)).toBe('HP (10)')
    expect(formatPaletteLabel('状態', '負傷')).toBe('状態 (負傷)')
  })

  it('真偽値の値を文字列として組み立てる', () => {
    expect(formatPaletteLabel('公開', true)).toBe('公開 (true)')
    expect(formatPaletteLabel('公開', false)).toBe('公開 (false)')
  })

  it('末尾の値が厳密一致する場合だけ除去する', () => {
    expect(stripMatchingPaletteValueSuffix('HP (11)', '11')).toBe('HP')
    expect(stripMatchingPaletteValueSuffix('HP (11)', '10')).toBe('HP (11)')
  })

  it('プレースホルダは一致しても除去しない', () => {
    expect(stripMatchingPaletteValueSuffix('HP (—)', '—')).toBe('HP (—)')
  })

  it('括弧を含むラベルと負数を保持して往復する', () => {
    const label = 'HP (最大値)'
    const materializedLabel = formatPaletteLabel(label, -5)

    expect(materializedLabel).toBe('HP (最大値) (-5)')
    expect(stripMatchingPaletteValueSuffix(materializedLabel, '-5')).toBe(label)
  })
})
