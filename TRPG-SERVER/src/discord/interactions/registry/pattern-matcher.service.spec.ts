import { Test, TestingModule } from '@nestjs/testing'
import { PatternMatcherService } from './pattern-matcher.service'
import { ButtonInteractionHandler } from '../handlers/base/interaction-handler.base'

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

class MockBroadPrefixHandler extends ButtonInteractionHandler {
  getCustomIdPattern(): string {
    return 'test-'
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

  describe('findBestMatch の accept 判定', () => {
    describe('完全一致', () => {
      it('完全一致するハンドラーを返す', () => {
        const exactHandler = new MockExactHandler()

        expect(service.findBestMatch('test-exact', [exactHandler])).toBe(exactHandler)
      })

      it('異なる文字列の場合、undefinedを返す', () => {
        const exactHandler = new MockExactHandler()

        expect(service.findBestMatch('different', [exactHandler])).toBeUndefined()
      })
    })

    describe('前方一致', () => {
      it('前方一致するハンドラーを返す', () => {
        const prefixHandler = new MockPrefixHandler()

        expect(service.findBestMatch('test-prefix-123', [prefixHandler])).toBe(prefixHandler)
      })

      it('前方が一致しない場合、undefinedを返す', () => {
        const prefixHandler = new MockPrefixHandler()

        expect(service.findBestMatch('other-prefix-123', [prefixHandler])).toBeUndefined()
      })
    })

    describe('正規表現', () => {
      it('正規表現にマッチするハンドラーを返す', () => {
        const regexHandler = new MockRegexHandler()

        expect(service.findBestMatch('test-regex-123', [regexHandler])).toBe(regexHandler)
      })

      it('正規表現にマッチしない場合、undefinedを返す', () => {
        const regexHandler = new MockRegexHandler()

        expect(service.findBestMatch('test-regex-abc', [regexHandler])).toBeUndefined()
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
      const handlers = [new MockBroadPrefixHandler(), exactHandler]
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

  describe('findBestMatch の複数候補選択', () => {
    it('複数の前方一致候補から長いパターンのハンドラーを返す', () => {
      const broadPrefixHandler = new MockBroadPrefixHandler()
      const prefixHandler = new MockPrefixHandler()
      const handlers = [broadPrefixHandler, prefixHandler]

      expect(service.findBestMatch('test-prefix-123', handlers)).toBe(prefixHandler)
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
