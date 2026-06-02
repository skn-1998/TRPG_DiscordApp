import { Test, TestingModule } from '@nestjs/testing'
import { PatternMatcherService } from './pattern-matcher.service'
import { InteractionHandler, ButtonInteractionHandler } from '../handlers/base/interaction-handler.base'
import { ButtonInteraction } from 'discord.js'

// テスト用のモックハンドラー
class MockExactHandler extends ButtonInteractionHandler {
  getCustomIdPattern(): string {
    return 'test-exact'
  }
  async execute(): Promise<void> {}
}

class MockPrefixHandler extends ButtonInteractionHandler {
  getCustomIdPattern(): string {
    return 'test-prefix-'
  }
  async execute(): Promise<void> {}
}

class MockRegexHandler extends ButtonInteractionHandler {
  getCustomIdPattern(): RegExp {
    return /^test-regex-\d+$/
  }
  async execute(): Promise<void> {}
}

describe('PatternMatcherService', () => {
  let service: PatternMatcherService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PatternMatcherService]
    }).compile()

    service = module.get<PatternMatcherService>(PatternMatcherService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  describe('matchPattern', () => {
    describe('完全一致', () => {
      it('完全一致の場合、score=100を返す', () => {
        const result = service.matchPattern('test-exact', 'test-exact')
        expect(result.matched).toBe(true)
        expect(result.type).toBe('exact')
        expect(result.score).toBe(100)
      })

      it('異なる文字列の場合、matchedがfalseを返す', () => {
        const result = service.matchPattern('different', 'test-exact')
        expect(result.matched).toBe(false)
      })
    })

    describe('前方一致', () => {
      it('前方一致の場合、適切なスコアを返す', () => {
        const result = service.matchPattern('test-prefix-123', 'test-prefix-')
        expect(result.matched).toBe(true)
        expect(result.type).toBe('startsWith')
        expect(result.score).toBeGreaterThan(50)
        expect(result.score).toBeLessThan(100)
      })

      it('前方が一致しない場合、matchedがfalseを返す', () => {
        const result = service.matchPattern('other-prefix-123', 'test-prefix-')
        expect(result.matched).toBe(false)
      })
    })

    describe('正規表現', () => {
      it('正規表現にマッチする場合、score=30を返す', () => {
        const result = service.matchPattern('test-regex-123', /^test-regex-\d+$/)
        expect(result.matched).toBe(true)
        expect(result.type).toBe('regex')
        expect(result.score).toBe(30)
      })

      it('正規表現にマッチしない場合、matchedがfalseを返す', () => {
        const result = service.matchPattern('test-regex-abc', /^test-regex-\d+$/)
        expect(result.matched).toBe(false)
      })
    })
  })

  describe('findBestMatch', () => {
    let exactHandler: MockExactHandler
    let prefixHandler: MockPrefixHandler
    let regexHandler: MockRegexHandler

    beforeEach(() => {
      exactHandler = new MockExactHandler()
      prefixHandler = new MockPrefixHandler()
      regexHandler = new MockRegexHandler()
    })

    it('完全一致のハンドラーを優先して返す', () => {
      const handlers = [prefixHandler, exactHandler]
      const result = service.findBestMatch('test-exact', handlers)
      expect(result).toBe(exactHandler)
    })

    it('前方一致のハンドラーを返す', () => {
      const handlers = [prefixHandler, regexHandler]
      const result = service.findBestMatch('test-prefix-abc', handlers)
      expect(result).toBe(prefixHandler)
    })

    it('正規表現マッチのハンドラーを返す', () => {
      const handlers = [regexHandler]
      const result = service.findBestMatch('test-regex-456', handlers)
      expect(result).toBe(regexHandler)
    })

    it('マッチするハンドラーがない場合、undefinedを返す', () => {
      const handlers = [exactHandler, prefixHandler]
      const result = service.findBestMatch('unknown-id', handlers)
      expect(result).toBeUndefined()
    })

    it('空のハンドラーリストの場合、undefinedを返す', () => {
      const result = service.findBestMatch('test', [])
      expect(result).toBeUndefined()
    })
  })

  describe('findAllMatches', () => {
    it('マッチする全てのハンドラーをスコア順で返す', () => {
      const exactHandler = new MockExactHandler()
      const prefixHandler = new MockPrefixHandler()

      // test-exactは両方にマッチ（exactとprefix）
      // ただしprefixHandlerのパターンは'test-prefix-'なので実際にはマッチしない
      const handlers = [prefixHandler, exactHandler]
      const results = service.findAllMatches('test-exact', handlers)

      expect(results).toHaveLength(1)
      expect(results[0].handler).toBe(exactHandler)
    })
  })

  describe('detectConflicts', () => {
    it('重複パターンを検出する', () => {
      const handler1 = new MockExactHandler()
      const handler2 = new MockExactHandler() // 同じパターン

      const conflicts = service.detectConflicts([handler1, handler2])
      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('duplicate')
    })

    it('異なるパターンの場合、競合なし', () => {
      const exactHandler = new MockExactHandler()
      const prefixHandler = new MockPrefixHandler()

      const conflicts = service.detectConflicts([exactHandler, prefixHandler])
      expect(conflicts).toHaveLength(0)
    })
  })

  describe('normalizePattern', () => {
    it('文字列パターンをそのまま返す', () => {
      const result = service.normalizePattern('test-pattern')
      expect(result).toBe('test-pattern')
    })

    it('正規表現パターンを文字列形式で返す', () => {
      const result = service.normalizePattern(/^test-\d+$/i)
      expect(result).toBe('/^test-\\d+$/i')
    })
  })

  describe('generateSummary', () => {
    it('ハンドラーのサマリーを生成する', () => {
      const exactHandler = new MockExactHandler()
      const summary = service.generateSummary([exactHandler])

      expect(summary).toContain('Interaction Handlers Summary')
      expect(summary).toContain('BUTTON')
      expect(summary).toContain('MockExactHandler')
      expect(summary).toContain('test-exact')
    })
  })
})
