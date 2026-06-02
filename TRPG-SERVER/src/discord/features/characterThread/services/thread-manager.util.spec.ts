import {
  buildThreadUrl,
  nextBackoffDelay,
  buildCreationCompletedPayload,
  buildCreationFailedPayload,
  CreationEventInput
} from './thread-manager.util'

/**
 * thread-manager.util の純粋関数テスト。モック不要で入出力のみ検証する。
 */

const baseInput: CreationEventInput = {
  threadId: 'thread-1',
  characterId: 'char-1',
  characterName: 'テスト探索者',
  channelId: 'channel-1',
  creatorId: 'creator-1',
  guildId: 'guild-1'
}

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

  describe('buildCreationCompletedPayload', () => {
    it('threadId を discordThreadId にも複製し、注入した threadUrl/timestamp/source を含む', () => {
      const ts = new Date('2026-06-02T00:00:00.000Z')
      const payload = buildCreationCompletedPayload(baseInput, 'https://example/thread-1', ts)

      expect(payload).toEqual({
        threadId: 'thread-1',
        discordThreadId: 'thread-1',
        threadUrl: 'https://example/thread-1',
        characterId: 'char-1',
        characterName: 'テスト探索者',
        channelId: 'channel-1',
        creatorId: 'creator-1',
        guildId: 'guild-1',
        timestamp: ts,
        source: 'thread-manager-service'
      })
    })
  })

  describe('buildCreationFailedPayload', () => {
    it('注入した tempThreadId/error/timestamp/source を含む', () => {
      const ts = new Date('2026-06-02T00:00:00.000Z')
      const { threadId: _omit, ...input } = baseInput
      const payload = buildCreationFailedPayload(input, 'temp-12345', 'boom', ts)

      expect(payload).toEqual({
        threadId: 'temp-12345',
        characterId: 'char-1',
        characterName: 'テスト探索者',
        channelId: 'channel-1',
        creatorId: 'creator-1',
        guildId: 'guild-1',
        error: 'boom',
        timestamp: ts,
        source: 'thread-manager-service'
      })
    })
  })
})
