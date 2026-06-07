type DiceCharacterSelectParsedCustomId = {
  messageId: string
  channelId: string
}

export const DICE_CHARACTER_SELECT_CUSTOM_ID_PATTERN = 'dice-char-select'

export const DiceCharacterSelectCustomId = {
  pattern: DICE_CHARACTER_SELECT_CUSTOM_ID_PATTERN,

  create(messageId: string, channelId: string): string {
    return `${DICE_CHARACTER_SELECT_CUSTOM_ID_PATTERN}*${messageId}*${channelId}`
  },

  template(): string {
    return `${DICE_CHARACTER_SELECT_CUSTOM_ID_PATTERN}*`
  },

  parse(customId: string): DiceCharacterSelectParsedCustomId | null {
    const [pattern, messageId, channelId] = customId.split('*')

    if (pattern !== DICE_CHARACTER_SELECT_CUSTOM_ID_PATTERN || !messageId || !channelId) {
      return null
    }

    return { messageId, channelId }
  }
} as const
