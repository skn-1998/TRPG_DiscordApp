import generateColors from './generateColors'

describe('generateColors', () => {
  it('旧実装と同じアクセントカラーパレットを生成する', () => {
    expect(generateColors('#673AB7', 5)).toEqual([
      '#b8a2dd',
      '#a88fd6',
      '#997bcf',
      '#8a67c8',
      '#7b54c0',
      '#6c40b9',
      '#5a329f',
      '#4f2d8d',
      '#45277b',
      '#3b2168'
    ])
  })
})
