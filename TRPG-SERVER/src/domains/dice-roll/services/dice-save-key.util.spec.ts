import { resolveSaveChannelId, resolveModalSaveChannelId } from './dice-save-key.util'

/**
 * 履歴保存キー解決の純関数（E-6e で discord 層から移設した 2026-06-11 意味論）。
 * - resolveSaveChannelId: ボタン系（DiceRollLogicService）「スレッド内は実親チャンネル・それ以外は lookup キー」
 * - resolveModalSaveChannelId: モーダル系（CustomDiceModalService.saveRollHistory）の 4 段 fallback
 */
describe('resolveSaveChannelId（スレッド内は実親チャンネル・2026-06-11 修正）', () => {
  it('スレッド内は parentId（実親チャンネル）で保存する', () => {
    expect(resolveSaveChannelId({ channelId: 'ch-1', parentId: 'parent-1', isThread: true })).toBe('parent-1')
  })

  it('スレッド内でも parentId が null なら lookup キーへフォールバックする', () => {
    expect(resolveSaveChannelId({ channelId: 'ch-1', parentId: null, isThread: true })).toBe('ch-1')
  })

  it('スレッド内でも parentId が undefined なら lookup キーへフォールバックする', () => {
    expect(resolveSaveChannelId({ channelId: 'ch-1', isThread: true })).toBe('ch-1')
  })

  it('スレッド外は lookup キー（customId 由来）のまま保存する', () => {
    expect(resolveSaveChannelId({ channelId: 'ch-1', isThread: false })).toBe('ch-1')
  })

  it('スレッド外では parentId が与えられていても無視する', () => {
    expect(resolveSaveChannelId({ channelId: 'ch-1', parentId: 'parent-1', isThread: false })).toBe('ch-1')
  })
})

describe('resolveModalSaveChannelId（4 段 fallback）', () => {
  const fullCtx = {
    threadParentId: 'parent-1',
    characterChannelId: 'char-ch-1',
    extractedChannelId: 'extracted-1',
    currentChannelId: 'current-1'
  }

  it('スレッド実親チャンネルを最優先する', () => {
    expect(resolveModalSaveChannelId(fullCtx)).toBe('parent-1')
  })

  it('スレッド外（threadParentId なし）は character.discordChannelId を使う', () => {
    expect(resolveModalSaveChannelId({ ...fullCtx, threadParentId: null })).toBe('char-ch-1')
  })

  it('キャラ未解決時は customId 由来の抽出 ID へフォールバックする', () => {
    expect(resolveModalSaveChannelId({ ...fullCtx, threadParentId: null, characterChannelId: undefined })).toBe(
      'extracted-1'
    )
  })

  it('抽出 ID も無ければ現在チャンネル ID へフォールバックする', () => {
    expect(
      resolveModalSaveChannelId({
        threadParentId: null,
        characterChannelId: undefined,
        extractedChannelId: null,
        currentChannelId: 'current-1'
      })
    ).toBe('current-1')
  })

  it('すべて欠落している場合は null を返す（呼び出し元は保存スキップ）', () => {
    expect(resolveModalSaveChannelId({})).toBeNull()
    expect(
      resolveModalSaveChannelId({
        threadParentId: null,
        characterChannelId: undefined,
        extractedChannelId: null,
        currentChannelId: null
      })
    ).toBeNull()
  })

  it('空文字は falsy として次の段へフォールバックする（|| 意味論の固定）', () => {
    expect(resolveModalSaveChannelId({ ...fullCtx, threadParentId: '' })).toBe('char-ch-1')
  })
})
