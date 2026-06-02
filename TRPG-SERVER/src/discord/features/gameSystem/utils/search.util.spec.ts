import { convertSearchText } from './search.util'

describe('search.util', () => {
  describe('convertSearchText', () => {
    it('元文字列・ひらがな化・カタカナ化の3要素を配列で返す', () => {
      const result = convertSearchText('カタカナ')

      expect(result).toHaveLength(3)
      expect(result[0]).toBe('カタカナ')
    })

    it('カタカナはひらがなに変換され、カタカナ化要素は元のまま', () => {
      // Arrange / Act
      const result = convertSearchText('カタカナ')

      // Assert: [原文, KK→HG, HG→KK]
      expect(result).toEqual(['カタカナ', 'かたかな', 'カタカナ'])
    })

    it('ひらがなはカタカナに変換され、ひらがな化要素は元のまま', () => {
      const result = convertSearchText('ひらがな')

      expect(result).toEqual(['ひらがな', 'ひらがな', 'ヒラガナ'])
    })

    it('かな以外（英数字）はいずれの要素でも変換されない', () => {
      const result = convertSearchText('abc123')

      expect(result).toEqual(['abc123', 'abc123', 'abc123'])
    })

    it('かなと英字が混在する場合、かな部分のみ変換される', () => {
      const result = convertSearchText('テストtest')

      expect(result).toEqual(['テストtest', 'てすとtest', 'テストtest'])
    })

    it('小書き文字（っ）もひらがな⇔カタカナで変換される', () => {
      const result = convertSearchText('っ')

      expect(result).toEqual(['っ', 'っ', 'ッ'])
    })

    it('半角カタカナは全角変換対象外のため変換されない', () => {
      const result = convertSearchText('ｶﾀｶﾅ')

      expect(result).toEqual(['ｶﾀｶﾅ', 'ｶﾀｶﾅ', 'ｶﾀｶﾅ'])
    })

    it('空文字列は3つの空文字列を返す', () => {
      const result = convertSearchText('')

      expect(result).toEqual(['', '', ''])
    })
  })
})
