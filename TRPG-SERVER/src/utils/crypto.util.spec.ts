import { CryptoUtil } from './crypto.util'

// テスト用の環境変数を設定
process.env.DISCORD_TOKEN_ENCRYPTION_KEY = 'test-encryption-key-for-testing'

describe('CryptoUtil', () => {
  const testText = 'test-encryption-text'
  const testToken = 'discord-access-token-12345'

  describe('encrypt', () => {
    it('should encrypt text successfully', () => {
      const encrypted = CryptoUtil.encrypt(testText)

      expect(encrypted).toBeDefined()
      expect(encrypted).not.toBe(testText)
      expect(encrypted.length).toBeGreaterThan(testText.length)
    })

    it('should return empty string for empty input', () => {
      const encrypted = CryptoUtil.encrypt('')
      expect(encrypted).toBe('')
    })

    it('should return empty string for null/undefined input', () => {
      expect(CryptoUtil.encrypt(null as any)).toBe('')
      expect(CryptoUtil.encrypt(undefined as any)).toBe('')
    })
  })

  describe('decrypt', () => {
    it('should decrypt encrypted text successfully', () => {
      const encrypted = CryptoUtil.encrypt(testText)
      const decrypted = CryptoUtil.decrypt(encrypted)

      expect(decrypted).toBe(testText)
    })

    it('should decrypt token successfully', () => {
      const encrypted = CryptoUtil.encrypt(testToken)
      const decrypted = CryptoUtil.decrypt(encrypted)

      expect(decrypted).toBe(testToken)
    })

    it('should return empty string for empty input', () => {
      const decrypted = CryptoUtil.decrypt('')
      expect(decrypted).toBe('')
    })

    it('should return empty string for null/undefined input', () => {
      expect(CryptoUtil.decrypt(null as any)).toBe('')
      expect(CryptoUtil.decrypt(undefined as any)).toBe('')
    })
  })

  describe('isValidEncryptedToken', () => {
    it('should return true for valid encrypted token', () => {
      const encrypted = CryptoUtil.encrypt(testToken)
      const isValid = CryptoUtil.isValidEncryptedToken(encrypted)

      expect(isValid).toBe(true)
    })

    it('should return false for invalid encrypted token', () => {
      const isValid = CryptoUtil.isValidEncryptedToken('invalid-token')

      expect(isValid).toBe(false)
    })

    it('should return false for empty input', () => {
      expect(CryptoUtil.isValidEncryptedToken('')).toBe(false)
      expect(CryptoUtil.isValidEncryptedToken(null as any)).toBe(false)
      expect(CryptoUtil.isValidEncryptedToken(undefined as any)).toBe(false)
    })
  })

  describe('round trip encryption', () => {
    it('should handle special characters', () => {
      const specialText = 'test@#$%^&*()_+-=[]{}|;:,.<>?'
      const encrypted = CryptoUtil.encrypt(specialText)
      const decrypted = CryptoUtil.decrypt(encrypted)

      expect(decrypted).toBe(specialText)
    })

    it('should handle unicode characters', () => {
      const unicodeText = 'テスト文字列🎉🚀'
      const encrypted = CryptoUtil.encrypt(unicodeText)
      const decrypted = CryptoUtil.decrypt(encrypted)

      expect(decrypted).toBe(unicodeText)
    })

    it('should handle long text', () => {
      const longText = 'a'.repeat(1000)
      const encrypted = CryptoUtil.encrypt(longText)
      const decrypted = CryptoUtil.decrypt(encrypted)

      expect(decrypted).toBe(longText)
    })
  })
})
