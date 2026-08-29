import { createStableUid } from './stable-uid'

describe('createStableUid', () => {
  const originalCrypto = globalThis.crypto

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto
    })
    jest.restoreAllMocks()
  })

  it('crypto.randomUUID から prefix 付き uid を発行する', () => {
    const randomUUID = jest.fn().mockReturnValue('aaaaaaaa-1111-2222-3333-444444444444')
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID }
    })

    expect(createStableUid(new Set(), 'field')).toBe('field_aaaaaaaa1111')
    expect(randomUUID).toHaveBeenCalledTimes(1)
  })

  it('crypto がない環境では Math.random 由来の uid を発行する', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined
    })
    jest.spyOn(Math, 'random').mockReturnValue(0.5)

    expect(createStableUid(new Set(), 'fallback')).toBe('fallback_i')
  })

  it('生成した uid が衝突した場合は同じ prefix で再発行する', () => {
    const randomUUID = jest
      .fn()
      .mockReturnValueOnce('aaaaaaaa-1111-2222-3333-444444444444')
      .mockReturnValueOnce('bbbbbbbb-1111-2222-3333-444444444444')
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID }
    })

    expect(createStableUid(new Set(['field_aaaaaaaa1111']), 'field')).toBe('field_bbbbbbbb1111')
    expect(randomUUID).toHaveBeenCalledTimes(2)
  })
})
