export type DicePageAction = 'first' | 'prev' | 'next' | 'last' | 'cancel' | 'select'

type DicePageParsedCustomId = {
  action: DicePageAction
  messageId: string
  channelId: string
}

export const DICE_PAGE_CUSTOM_ID_PATTERNS: Record<DicePageAction, string> = {
  first: 'dice-page-first',
  prev: 'dice-page-prev',
  next: 'dice-page-next',
  last: 'dice-page-last',
  cancel: 'dice-page-cancel',
  select: 'dice-page-select'
}

const DICE_PAGE_ACTION_BY_PATTERN = Object.fromEntries(
  Object.entries(DICE_PAGE_CUSTOM_ID_PATTERNS).map(([action, pattern]) => [pattern, action])
) as Record<string, DicePageAction>

export const DicePageCustomId = {
  patterns: DICE_PAGE_CUSTOM_ID_PATTERNS,

  create(action: DicePageAction, messageId: string, channelId: string): string {
    return `${DICE_PAGE_CUSTOM_ID_PATTERNS[action]}*${messageId}*${channelId}`
  },

  first(messageId: string, channelId: string): string {
    return this.create('first', messageId, channelId)
  },

  prev(messageId: string, channelId: string): string {
    return this.create('prev', messageId, channelId)
  },

  next(messageId: string, channelId: string): string {
    return this.create('next', messageId, channelId)
  },

  last(messageId: string, channelId: string): string {
    return this.create('last', messageId, channelId)
  },

  cancel(messageId: string, channelId: string): string {
    return this.create('cancel', messageId, channelId)
  },

  select(messageId: string, channelId: string): string {
    return this.create('select', messageId, channelId)
  },

  template(action: DicePageAction): string {
    return `${DICE_PAGE_CUSTOM_ID_PATTERNS[action]}*`
  },

  parse(customId: string): DicePageParsedCustomId | null {
    const [pattern, messageId, channelId] = customId.split('*')
    const action = DICE_PAGE_ACTION_BY_PATTERN[pattern]

    if (!action || !messageId || !channelId) {
      return null
    }

    return { action, messageId, channelId }
  }
} as const
