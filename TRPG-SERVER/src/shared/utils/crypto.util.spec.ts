import { CryptoUtil } from './crypto.util'

// テスト用の暗号化キー（32文字以上）
const KEY = 'test-encryption-key-of-32-characters!!'

describe('CryptoUtil', () => {
  const testText = 'test-encryption-text'
  const testToken = 'discord-access-token-12345'

  describe('encrypt', () => {
    it('should encrypt text successfully', () => {
      const encrypted = CryptoUtil.encrypt(testText, KEY)

      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(testText)
      expect(encrypted.length).toBeGreaterThan(testText.length)
    })

    it('should return empty string for empty input', () => {
      const encrypted = CryptoUtil.encrypt('', KEY)
      expect(encrypted).toBe('')
    })

    it('should return empty string for null/undefined input', () => {
      expect(CryptoUtil.encrypt(null as any, KEY)).toBe('')
      expect(CryptoUtil.encrypt(undefined as any, KEY)).toBe('')
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted text successfully', () => {
      const encrypted = CryptoUtil.encrypt(testText, KEY)
      const decrypted = CryptoUtil.decrypt(encrypted, KEY)

      expect(decrypted).toBe(testText)
    })

    it('should decrypt token successfully', () => {
      const encrypted = CryptoUtil.encrypt(testToken, KEY)
      const decrypted = CryptoUtil.decrypt(encrypted, KEY)

      expect(decrypted).toBe(testToken)
    })

    it('should return empty string for empty input', () => {
      const decrypted = CryptoUtil.decrypt('', KEY)
      expect(decrypted).toBe('')
    })

    it('should return empty string for null/undefined input', () => {
      expect(CryptoUtil.decrypt(null as any, KEY)).toBe('')
      expect(CryptoUtil.decrypt(undefined as any, KEY)).toBe('')
    })
  })

  describe('isValidEncryptedToken', () => {
    it('should return true for valid encrypted token', () => {
      const encrypted = CryptoUtil.encrypt(testToken, KEY)
      const isValid = CryptoUtil.isValidEncryptedToken(encrypted, KEY)

      expect(isValid).toBe(true)
    })

    it('should return false for invalid encrypted token', () => {
      const isValid = CryptoUtil.isValidEncryptedToken('invalid-token', KEY)

      expect(isValid).toBe(false)
    })

    it('should return false for empty input', () => {
      expect(CryptoUtil.isValidEncryptedToken('', KEY)).toBe(false)
      expect(CryptoUtil.isValidEncryptedToken(null as any, KEY)).toBe(false)
      expect(CryptoUtil.isValidEncryptedToken(undefined as any, KEY)).toBe(false)
    })
  })

  describe('round trip encryption', () => {
    it('should handle special characters', () => {
      const specialText = 'test@#$%^&*()_+-=[]{}|;:,.<>?'
      const encrypted = CryptoUtil.encrypt(specialText, KEY)
      const decrypted = CryptoUtil.decrypt(encrypted, KEY)

      expect(decrypted).toBe(specialText)
    })

    it('should handle unicode characters', () => {
      const unicodeText = 'テスト文字列🎉🚀'
      const encrypted = CryptoUtil.encrypt(unicodeText, KEY)
      const decrypted = CryptoUtil.decrypt(encrypted, KEY)

      expect(decrypted).toBe(unicodeText)
    })

    it('should handle long text', () => {
      const longText = 'a'.repeat(1000)
      const encrypted = CryptoUtil.encrypt(longText, KEY)
      const decrypted = CryptoUtil.decrypt(encrypted, KEY)

      expect(decrypted).toBe(longText)
    })
  })
})
