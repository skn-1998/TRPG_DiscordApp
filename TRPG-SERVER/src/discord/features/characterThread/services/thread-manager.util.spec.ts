import { buildThreadUrl, nextBackoffDelay } from './thread-manager.util'

/**
 * thread-manager.util の純粋関数テスト。モック不要で入出力のみ検証する。
 */

describe('thread-manager.util', () => {
  describe('buildThreadUrl', () => {
    it('guildId/threadId から Discord スレッド URL を生成する', () => {
      expect(buildThreadUrl('guild-1', 'thread-99')).toBe('https://discord.com/channels/guild-1/thread-99')
    })
  })

  describe('nextBackoffDelay', () => {
    it('現在値の 2 倍を返す', () => {
      expect(nextBackoffDelay(100)).toBe(200)
      expect(nextBackoffDelay(200)).toBe(400)
      expect(nextBackoffDelay(0)).toBe(0)
    })
  })

  // E-3d: buildCreationFailedPayload は dead emit 撤去に伴い削除（テストも撤去）
  // E-3f: 作成完了イベント payload の組立関数も dead emit 撤去に伴い削除（テストも撤去）
})
