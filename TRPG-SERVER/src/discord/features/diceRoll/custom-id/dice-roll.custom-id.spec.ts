import { DiceCharacterSelectCustomId, DicePageCustomId } from './index'

describe('diceRoll custom-id contract', () => {
  const messageId = 'message-1'
  const channelId = 'channel-1'

  it.each([
    ['first', 'dice-page-first*message-1*channel-1'],
    ['prev', 'dice-page-prev*message-1*channel-1'],
    ['next', 'dice-page-next*message-1*channel-1'],
    ['last', 'dice-page-last*message-1*channel-1'],
    ['cancel', 'dice-page-cancel*message-1*channel-1'],
    ['select', 'dice-page-select*message-1*channel-1']
  ] as const)('dice page %s customId を生成し parse できる', (action, expected) => {
    const customId = DicePageCustomId.create(action, messageId, channelId)

    expect(customId).toBe(expected)
    expect(DicePageCustomId.parse(customId)).toEqual({ action, messageId, channelId })
  })

  it('dice-char-select customId を生成し parse できる', () => {
    const customId = DiceCharacterSelectCustomId.create(messageId, channelId)

    expect(customId).toBe('dice-char-select*message-1*channel-1')
    expect(DiceCharacterSelectCustomId.parse(customId)).toEqual({ messageId, channelId })
  })

  it('必要な情報が欠けた customId は null を返す', () => {
    expect(DicePageCustomId.parse('dice-page-prev')).toBeNull()
    expect(DicePageCustomId.parse('dice-prev*message-1*channel-1')).toBeNull()
    expect(DiceCharacterSelectCustomId.parse('dice-character-select*message-1*channel-1')).toBeNull()
  })
})
