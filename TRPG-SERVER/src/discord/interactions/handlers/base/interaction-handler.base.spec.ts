import {
  InteractionHandler,
  ButtonInteractionHandler,
  SelectMenuInteractionHandler,
  ModalInteractionHandler
} from './interaction-handler.base'
import { ButtonInteraction, StringSelectMenuInteraction, ModalSubmitInteraction } from 'discord.js'

// テスト用の具象クラス
class TestButtonHandler extends ButtonInteractionHandler {
  getCustomIdPattern(): string {
    return 'test-button'
  }
  async execute(): Promise<void> {}
}

class TestSelectHandler extends SelectMenuInteractionHandler {
  getCustomIdPattern(): string {
    return 'test-select-'
  }
  async execute(): Promise<void> {}
}

class TestModalHandler extends ModalInteractionHandler {
  getCustomIdPattern(): RegExp {
    return /^test-modal-\d+$/
  }
  async execute(): Promise<void> {}
}

describe('InteractionHandler Base Classes', () => {
  describe('ButtonInteractionHandler', () => {
    let handler: TestButtonHandler

    beforeEach(() => {
      handler = new TestButtonHandler()
    })

    it('should be defined', () => {
      expect(handler).toBeDefined()
    })

    it('getInteractionType should return "button"', () => {
      expect(handler.getInteractionType()).toBe('button')
    })

    it('getCustomIdPattern should return the pattern', () => {
      expect(handler.getCustomIdPattern()).toBe('test-button')
    })

    describe('matches', () => {
      it('完全一致でtrueを返す', () => {
        expect(handler.matches('test-button')).toBe(true)
      })

      it('前方一致でtrueを返す', () => {
        expect(handler.matches('test-button-extra')).toBe(true)
      })

      it('異なる文字列でfalseを返す', () => {
        expect(handler.matches('other-button')).toBe(false)
      })
    })

    describe('getMatchScore', () => {
      it('完全一致で100を返す', () => {
        expect(handler.getMatchScore('test-button')).toBe(100)
      })

      it('前方一致で50以上99以下を返す', () => {
        const score = handler.getMatchScore('test-button-extra')
        expect(score).toBeGreaterThanOrEqual(50)
        expect(score).toBeLessThan(100)
      })

      it('マッチしない場合は0を返す', () => {
        expect(handler.getMatchScore('other-button')).toBe(0)
      })
    })

    describe('getDescription', () => {
      it('説明文字列を返す', () => {
        const desc = handler.getDescription()
        expect(desc).toContain('TestButtonHandler')
        expect(desc).toContain('button')
        expect(desc).toContain('test-button')
      })
    })
  })

  describe('SelectMenuInteractionHandler', () => {
    let handler: TestSelectHandler

    beforeEach(() => {
      handler = new TestSelectHandler()
    })

    it('should be defined', () => {
      expect(handler).toBeDefined()
    })

    it('getInteractionType should return "select"', () => {
      expect(handler.getInteractionType()).toBe('select')
    })

    it('getCustomIdPattern should return the pattern', () => {
      expect(handler.getCustomIdPattern()).toBe('test-select-')
    })

    describe('matches', () => {
      it('前方一致でtrueを返す（末尾-パターン）', () => {
        expect(handler.matches('test-select-123')).toBe(true)
        expect(handler.matches('test-select-abc')).toBe(true)
      })

      it('パターン自体と一致でtrueを返す', () => {
        expect(handler.matches('test-select-')).toBe(true)
      })
    })
  })

  describe('ModalInteractionHandler', () => {
    let handler: TestModalHandler

    beforeEach(() => {
      handler = new TestModalHandler()
    })

    it('should be defined', () => {
      expect(handler).toBeDefined()
    })

    it('getInteractionType should return "modal"', () => {
      expect(handler.getInteractionType()).toBe('modal')
    })

    it('getCustomIdPattern should return RegExp', () => {
      expect(handler.getCustomIdPattern()).toBeInstanceOf(RegExp)
    })

    describe('matches (正規表現)', () => {
      it('正規表現にマッチする場合trueを返す', () => {
        expect(handler.matches('test-modal-123')).toBe(true)
        expect(handler.matches('test-modal-999')).toBe(true)
      })

      it('正規表現にマッチしない場合falseを返す', () => {
        expect(handler.matches('test-modal-abc')).toBe(false)
        expect(handler.matches('test-modal-')).toBe(false)
        expect(handler.matches('other-modal-123')).toBe(false)
      })
    })

    describe('getMatchScore (正規表現)', () => {
      it('マッチする場合30を返す', () => {
        expect(handler.getMatchScore('test-modal-123')).toBe(30)
      })

      it('マッチしない場合0を返す', () => {
        expect(handler.getMatchScore('test-modal-abc')).toBe(0)
      })
    })
  })

  describe('Logger', () => {
    it('各ハンドラーにLoggerが設定されている', () => {
      const buttonHandler = new TestButtonHandler()
      const selectHandler = new TestSelectHandler()
      const modalHandler = new TestModalHandler()

      // protected propertyなのでanyでアクセス
      expect((buttonHandler as any).logger).toBeDefined()
      expect((selectHandler as any).logger).toBeDefined()
      expect((modalHandler as any).logger).toBeDefined()
    })
  })
})
