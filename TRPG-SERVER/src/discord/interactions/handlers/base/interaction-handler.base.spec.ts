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

    describe('getMatchScore による本番 accept 判定', () => {
      it('完全一致を受理する', () => {
        expect(handler.getMatchScore('test-button')).toBeGreaterThan(0)
      })

      it('前方一致を受理する', () => {
        expect(handler.getMatchScore('test-button-extra')).toBeGreaterThan(0)
      })

      it('異なる文字列を拒否する', () => {
        expect(handler.getMatchScore('other-button')).toBe(0)
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

    describe('getMatchScore による本番 accept 判定', () => {
      it('前方一致を受理する（末尾-パターン）', () => {
        expect(handler.getMatchScore('test-select-123')).toBeGreaterThan(0)
        expect(handler.getMatchScore('test-select-abc')).toBeGreaterThan(0)
      })

      it('パターン自体との一致を受理する', () => {
        expect(handler.getMatchScore('test-select-')).toBeGreaterThan(0)
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

    describe('getMatchScore による本番 accept 判定（正規表現）', () => {
      it('正規表現にマッチする customId を受理する', () => {
        expect(handler.getMatchScore('test-modal-123')).toBeGreaterThan(0)
        expect(handler.getMatchScore('test-modal-999')).toBeGreaterThan(0)
      })

      it('正規表現にマッチしない customId を拒否する', () => {
        expect(handler.getMatchScore('test-modal-abc')).toBe(0)
        expect(handler.getMatchScore('test-modal-')).toBe(0)
        expect(handler.getMatchScore('other-modal-123')).toBe(0)
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
