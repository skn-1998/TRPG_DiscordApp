import { Test, TestingModule } from '@nestjs/testing'
import { Logger } from '@nestjs/common'
import { ModalSessionManagerService, ModalSessionData } from './modal-session-manager.service'
import { EmbedSectionType } from './character-embed-manager.service'

describe('ModalSessionManagerService', () => {
  let service: ModalSessionManagerService
  let module: TestingModule

  // 30分（クリーンアップ閾値）をミリ秒で
  const THIRTY_MINUTES = 30 * 60 * 1000
  // 決定化のための基準時刻（任意の固定値）
  const BASE_TIME = new Date('2026-06-02T00:00:00.000Z').getTime()

  const sectionType: EmbedSectionType = 'status'

  beforeEach(async () => {
    // Logger のノイズ抑制
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined)
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)

    // 時刻を決定化
    jest.useFakeTimers()
    jest.setSystemTime(BASE_TIME)

    const moduleRef = await Test.createTestingModule({
      providers: [ModalSessionManagerService]
    }).compile()

    service = moduleRef.get<ModalSessionManagerService>(ModalSessionManagerService)
    module = moduleRef
  })

  afterEach(async () => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    await module.close()
  })

  describe('createSession', () => {
    it('セッションを作成し sessionId を返す', () => {
      const sessionId = service.createSession('char-1', sectionType, 'hp')

      expect(typeof sessionId).toBe('string')
      const session = service.getSession(sessionId)
      expect(session).toEqual<ModalSessionData>({
        characterId: 'char-1',
        sectionType,
        fieldKey: 'hp',
        timestamp: BASE_TIME
      })
    })

    it('作成時の現在時刻を timestamp として記録する', () => {
      jest.setSystemTime(BASE_TIME + 12345)

      const sessionId = service.createSession('char-1', sectionType, 'hp')

      expect(service.getSession(sessionId)?.timestamp).toBe(BASE_TIME + 12345)
    })
  })

  describe('generateSessionId（createSession 経由で検証）', () => {
    it('4桁ゼロ埋めの連番を生成する', () => {
      const id1 = service.createSession('c', sectionType, 'f')
      const id2 = service.createSession('c', sectionType, 'f')
      const id3 = service.createSession('c', sectionType, 'f')

      expect(id1).toBe('0001')
      expect(id2).toBe('0002')
      expect(id3).toBe('0003')
    })

    it('10000 を超えると 0000 に巻き戻る', () => {
      let lastId = ''
      // 9999 回作成して 9999 まで進める
      for (let i = 0; i < 9999; i++) {
        lastId = service.createSession('c', sectionType, 'f')
      }
      expect(lastId).toBe('9999')

      // 10000 回目で巻き戻り
      const wrapped = service.createSession('c', sectionType, 'f')
      expect(wrapped).toBe('0000')
    })
  })

  describe('getSession', () => {
    it('存在するセッションのデータを返す', () => {
      const sessionId = service.createSession('char-1', 'skill', 'dex')

      const session = service.getSession(sessionId)

      expect(session).toEqual<ModalSessionData>({
        characterId: 'char-1',
        sectionType: 'skill',
        fieldKey: 'dex',
        timestamp: BASE_TIME
      })
    })

    it('存在しない sessionId には undefined を返す', () => {
      expect(service.getSession('9999')).toBeUndefined()
    })

    it('30分ちょうど経過したセッションはまだ取得できる（境界: 期限切れではない）', () => {
      const sessionId = service.createSession('char-1', sectionType, 'hp')

      // cutoff = now - 30分。timestamp < cutoff のみ削除されるため、ちょうど30分は残る
      jest.setSystemTime(BASE_TIME + THIRTY_MINUTES)

      expect(service.getSession(sessionId)).toBeDefined()
    })

    it('30分を1ms超えたセッションは期限切れで undefined を返す（境界）', () => {
      const sessionId = service.createSession('char-1', sectionType, 'hp')

      jest.setSystemTime(BASE_TIME + THIRTY_MINUTES + 1)

      expect(service.getSession(sessionId)).toBeUndefined()
    })

    it('期限切れセッションは取得時のクリーンアップでMapから除去される', () => {
      const expiredId = service.createSession('old', sectionType, 'hp')

      // 期限切れにしてから新しいセッションを作成
      jest.setSystemTime(BASE_TIME + THIRTY_MINUTES + 1)
      const freshId = service.createSession('new', sectionType, 'hp')

      // getSession 呼び出しで cleanup が走る
      service.getSession(freshId)

      expect(service.getSession(expiredId)).toBeUndefined()
      expect(service.getSession(freshId)).toBeDefined()
      // 期限切れ1件が除去され、有効な1件だけ残る
      expect(service.getSessionStats().total).toBe(1)
    })

    it('有効なセッションは期限切れクリーンアップの対象外', () => {
      const sessionId = service.createSession('char-1', sectionType, 'hp')

      // 29分経過（まだ有効）
      jest.setSystemTime(BASE_TIME + 29 * 60 * 1000)

      expect(service.getSession(sessionId)).toBeDefined()
    })
  })

  describe('removeSession', () => {
    it('指定したセッションを削除する', () => {
      const sessionId = service.createSession('char-1', sectionType, 'hp')
      expect(service.getSession(sessionId)).toBeDefined()

      service.removeSession(sessionId)

      expect(service.getSession(sessionId)).toBeUndefined()
    })

    it('存在しない sessionId を削除しても例外を投げない', () => {
      expect(() => service.removeSession('9999')).not.toThrow()
    })
  })

  describe('getSessionStats', () => {
    it('セッションが空のとき total は 0、oldestAge は 0', () => {
      expect(service.getSessionStats()).toEqual({ total: 0, oldestAge: 0 })
    })

    it('total に保持中のセッション数を返す', () => {
      service.createSession('c1', sectionType, 'f')
      service.createSession('c2', sectionType, 'f')

      expect(service.getSessionStats().total).toBe(2)
    })

    it('oldestAge に最古セッションからの経過時間を返す', () => {
      // 最古のセッション
      service.createSession('old', sectionType, 'f')

      // 10分後に新しいセッション
      jest.setSystemTime(BASE_TIME + 10 * 60 * 1000)
      service.createSession('new', sectionType, 'f')

      // さらに5分後に統計取得（最古から計15分経過）
      jest.setSystemTime(BASE_TIME + 15 * 60 * 1000)

      const stats = service.getSessionStats()
      expect(stats.total).toBe(2)
      expect(stats.oldestAge).toBe(15 * 60 * 1000)
    })
  })
})
