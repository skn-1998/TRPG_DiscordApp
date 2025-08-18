import { IdGeneratorUtil } from './id-generator.util'

describe('IdGeneratorUtil', () => {
  describe('generateShortId', () => {
    it('should generate ID with default prefix and length', () => {
      const id = IdGeneratorUtil.generateShortId()
      expect(id).toHaveLength(8)
      expect(id).toMatch(/^[a-z0-9]{8}$/)
    })

    it('should generate ID with custom prefix', () => {
      const prefix = 'test_'
      const id = IdGeneratorUtil.generateShortId(prefix)
      expect(id.startsWith(prefix)).toBe(true)
      expect(id).toHaveLength(prefix.length + 8)
    })

    it('should generate ID with custom length', () => {
      const prefix = 'char_'
      const length = 12
      const id = IdGeneratorUtil.generateShortId(prefix, length)
      expect(id.startsWith(prefix)).toBe(true)
      expect(id).toHaveLength(prefix.length + length)
    })

    it('should generate different IDs on multiple calls', () => {
      const id1 = IdGeneratorUtil.generateShortId('test_')
      const id2 = IdGeneratorUtil.generateShortId('test_')
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateUuid', () => {
    it('should generate valid UUID v4', () => {
      const uuid = IdGeneratorUtil.generateUuid()
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should generate different UUIDs on multiple calls', () => {
      const uuid1 = IdGeneratorUtil.generateUuid()
      const uuid2 = IdGeneratorUtil.generateUuid()
      expect(uuid1).not.toBe(uuid2)
    })
  })

  describe('generateTimestampId', () => {
    it('should generate ID with timestamp and random part', () => {
      const id = IdGeneratorUtil.generateTimestampId('test_')
      expect(id.startsWith('test_')).toBe(true)
      expect(id).toMatch(/^test_[a-z0-9]+_[a-z0-9]{4}$/)
    })

    it('should generate different IDs on multiple calls', () => {
      const id1 = IdGeneratorUtil.generateTimestampId('test_')
      const id2 = IdGeneratorUtil.generateTimestampId('test_')
      expect(id1).not.toBe(id2)
    })
  })

  describe('generateNumericId', () => {
    it('should generate numeric ID with default length', () => {
      const id = IdGeneratorUtil.generateNumericId('num_')
      expect(id.startsWith('num_')).toBe(true)
      expect(id).toMatch(/^num_\d{6}$/)
    })

    it('should generate numeric ID with custom length', () => {
      const id = IdGeneratorUtil.generateNumericId('num_', 4)
      expect(id.startsWith('num_')).toBe(true)
      expect(id).toMatch(/^num_\d{4}$/)
    })
  })

  describe('generateCustomId', () => {
    it('should generate ID using custom charset', () => {
      const charset = 'ABC123'
      const id = IdGeneratorUtil.generateCustomId(charset, 'custom_', 6)
      expect(id.startsWith('custom_')).toBe(true)
      expect(id).toHaveLength(13) // 'custom_' (7) + 6
      expect(id.substring(7)).toMatch(/^[ABC123]{6}$/)
    })
  })

  describe('generateReadableId', () => {
    it('should generate readable ID without confusing characters', () => {
      const id = IdGeneratorUtil.generateReadableId('read_')
      expect(id.startsWith('read_')).toBe(true)
      expect(id).not.toContain('0')
      expect(id).not.toContain('O')
      expect(id).not.toContain('I')
      expect(id).not.toContain('l')
      expect(id).not.toContain('1')
    })
  })

  describe('generateSecureId', () => {
    it('should generate secure ID with mixed case and numbers', () => {
      const id = IdGeneratorUtil.generateSecureId('secure_', 16)
      expect(id.startsWith('secure_')).toBe(true)
      expect(id).toHaveLength(23) // 'secure_' (7) + 16
      expect(id.substring(7)).toMatch(/^[A-Za-z0-9]{16}$/)
    })
  })
})
