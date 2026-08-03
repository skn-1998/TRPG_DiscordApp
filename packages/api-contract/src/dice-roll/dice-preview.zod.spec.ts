import { dicePreviewRequestSchema, dicePreviewResponseSchema } from './dice-preview.zod'

describe('dice preview contract', () => {
  it('accepts the request and response wire shapes', () => {
    expect(dicePreviewRequestSchema.parse({ notation: '2d6+1', gameSystemId: 'Cthulhu7th' })).toEqual({
      notation: '2d6+1',
      gameSystemId: 'Cthulhu7th'
    })
    expect(dicePreviewResponseSchema.parse({ total: 7, details: '(2D6) ＞ 7[3,4]' })).toEqual({
      total: 7,
      details: '(2D6) ＞ 7[3,4]'
    })
  })

  it('rejects empty request fields and non-finite totals', () => {
    expect(dicePreviewRequestSchema.safeParse({ notation: '', gameSystemId: '' }).success).toBe(false)
    expect(dicePreviewResponseSchema.safeParse({ total: Number.NaN, details: 'invalid' }).success).toBe(false)
  })
})
