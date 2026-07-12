const CHANNEL_ID_SOURCE = '[0-9]+'
const PALETTE_KEY_SOURCE = '[a-z0-9]+'
const DECIMAL_DELTA_SOURCE = '-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?'
const GROUP_ID_SOURCE = '[a-z0-9]+'
const PAGE_SOURCE = '[1-9][0-9]*'

export const ROLL_PALETTE_CUSTOM_ID_PATTERN = new RegExp(`^roll_(${CHANNEL_ID_SOURCE})_(${PALETTE_KEY_SOURCE})$`)

export const RESOURCE_DELTA_CUSTOM_ID_PATTERN = new RegExp(
  `^res_(${CHANNEL_ID_SOURCE})_(${PALETTE_KEY_SOURCE})_(${DECIMAL_DELTA_SOURCE})$`
)
export const HUB_GROUP_SELECT_CUSTOM_ID_PATTERN = new RegExp(`^hub_group_(${CHANNEL_ID_SOURCE})$`)
export const HUB_PANEL_CUSTOM_ID_PATTERN = new RegExp(
  `^hub_panel_(${CHANNEL_ID_SOURCE})_(${GROUP_ID_SOURCE})_(${PAGE_SOURCE})$`
)
export const HUB_GROUP_BROWSER_CUSTOM_ID_PATTERN = new RegExp(`^hub_groups_(${CHANNEL_ID_SOURCE})_(${PAGE_SOURCE})$`)
export const HUB_GROUP_MENU_CUSTOM_ID_PATTERN = new RegExp(
  `^(?:hub_group_(${CHANNEL_ID_SOURCE})|hub_groups_(${CHANNEL_ID_SOURCE})_(${PAGE_SOURCE}))$`
)

/** v1.x で kind:check / kind:declare に割り当てる予約 prefix。 */
export const CHECK_CUSTOM_ID_RESERVED_PREFIX = 'chk_'
export const DECLARE_CUSTOM_ID_RESERVED_PREFIX = 'dec_'

export interface ParsedRollPaletteCustomId {
  channelId: string
  key: string
}

export interface ParsedResourceDeltaCustomId extends ParsedRollPaletteCustomId {
  delta: number
}

export interface ParsedHubGroupSelectCustomId {
  channelId: string
}

export interface ParsedHubPanelCustomId extends ParsedHubGroupSelectCustomId {
  groupId: string
  page: number
}

export interface ParsedHubGroupBrowserCustomId extends ParsedHubGroupSelectCustomId {
  page: number
}

function invalidCustomIdPart(name: string): never {
  throw new Error(`invalid ${name} for character-sheet customId`)
}

export const RollPaletteCustomId = {
  pattern: ROLL_PALETTE_CUSTOM_ID_PATTERN,

  create(channelId: string, key: string): string {
    const customId = `roll_${channelId}_${key}`
    if (!ROLL_PALETTE_CUSTOM_ID_PATTERN.test(customId)) invalidCustomIdPart('channelId or key')
    return customId
  },

  parse(customId: string): ParsedRollPaletteCustomId | null {
    const match = ROLL_PALETTE_CUSTOM_ID_PATTERN.exec(customId)
    if (match === null) return null
    return { channelId: match[1], key: match[2] }
  }
} as const

export const ResourceDeltaCustomId = {
  pattern: RESOURCE_DELTA_CUSTOM_ID_PATTERN,

  create(channelId: string, key: string, delta: number): string {
    if (!Number.isFinite(delta)) invalidCustomIdPart('delta')
    const normalizedDelta = Object.is(delta, -0) ? 0 : delta
    const customId = `res_${channelId}_${key}_${normalizedDelta}`
    if (!RESOURCE_DELTA_CUSTOM_ID_PATTERN.test(customId)) invalidCustomIdPart('channelId, key, or delta')
    return customId
  },

  parse(customId: string): ParsedResourceDeltaCustomId | null {
    const match = RESOURCE_DELTA_CUSTOM_ID_PATTERN.exec(customId)
    if (match === null) return null
    const delta = Number(match[3])
    if (!Number.isFinite(delta)) return null
    return { channelId: match[1], key: match[2], delta }
  }
} as const

export const HubGroupSelectCustomId = {
  pattern: HUB_GROUP_SELECT_CUSTOM_ID_PATTERN,

  create(channelId: string): string {
    const customId = `hub_group_${channelId}`
    if (!HUB_GROUP_SELECT_CUSTOM_ID_PATTERN.test(customId)) invalidCustomIdPart('channelId')
    return customId
  },

  parse(customId: string): ParsedHubGroupSelectCustomId | null {
    const match = HUB_GROUP_SELECT_CUSTOM_ID_PATTERN.exec(customId)
    return match === null ? null : { channelId: match[1] }
  }
} as const

export const HubPanelCustomId = {
  pattern: HUB_PANEL_CUSTOM_ID_PATTERN,

  create(channelId: string, groupId: string, page: number): string {
    if (!Number.isSafeInteger(page) || page < 1) invalidCustomIdPart('page')
    const customId = `hub_panel_${channelId}_${groupId}_${page}`
    if (!HUB_PANEL_CUSTOM_ID_PATTERN.test(customId)) invalidCustomIdPart('channelId or groupId')
    return customId
  },

  parse(customId: string): ParsedHubPanelCustomId | null {
    const match = HUB_PANEL_CUSTOM_ID_PATTERN.exec(customId)
    if (match === null) return null
    const page = Number(match[3])
    if (!Number.isSafeInteger(page)) return null
    return { channelId: match[1], groupId: match[2], page }
  }
} as const

export const HubGroupBrowserCustomId = {
  pattern: HUB_GROUP_BROWSER_CUSTOM_ID_PATTERN,

  create(channelId: string, page: number): string {
    if (!Number.isSafeInteger(page) || page < 1) invalidCustomIdPart('page')
    const customId = `hub_groups_${channelId}_${page}`
    if (!HUB_GROUP_BROWSER_CUSTOM_ID_PATTERN.test(customId)) invalidCustomIdPart('channelId')
    return customId
  },

  parse(customId: string): ParsedHubGroupBrowserCustomId | null {
    const match = HUB_GROUP_BROWSER_CUSTOM_ID_PATTERN.exec(customId)
    if (match === null) return null
    const page = Number(match[2])
    if (!Number.isSafeInteger(page)) return null
    return { channelId: match[1], page }
  }
} as const
