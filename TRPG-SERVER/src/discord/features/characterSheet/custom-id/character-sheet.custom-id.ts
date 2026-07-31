import {
  HUB_GROUP_BROWSER_CUSTOM_ID_PATTERN,
  HUB_GROUP_SELECT_CUSTOM_ID_PATTERN,
  HUB_PANEL_CUSTOM_ID_PATTERN,
  RESOURCE_DELTA_CUSTOM_ID_PATTERN,
  ROLL_PALETTE_CUSTOM_ID_PATTERN,
  createHubGroupBrowserCustomId,
  createHubGroupSelectCustomId,
  createHubPanelCustomId,
  createResourceDeltaCustomId,
  createRollPaletteCustomId
} from '@trpg/sheet-projection'

export { HUB_GROUP_MENU_CUSTOM_ID_PATTERN } from '@trpg/sheet-projection'

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
    const customId = createRollPaletteCustomId(channelId, key)
    if (customId === null) invalidCustomIdPart('channelId or key')
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
    const customId = createResourceDeltaCustomId(channelId, key, delta)
    if (customId === null) invalidCustomIdPart('channelId, key, or delta')
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
    const customId = createHubGroupSelectCustomId(channelId)
    if (customId === null) invalidCustomIdPart('channelId')
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
    const customId = createHubPanelCustomId(channelId, groupId, page)
    if (customId === null) invalidCustomIdPart('channelId, groupId, or page')
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
    const customId = createHubGroupBrowserCustomId(channelId, page)
    if (customId === null) invalidCustomIdPart('channelId or page')
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
